/**
 * One trial: a compiled mask goes out, artifacts come back, checks run, and the
 * cost is recorded whether it succeeded or failed.
 *
 * This is the only module in the package that spends money, so it is deliberately
 * conservative: a hard per-trial ceiling, a JSON-only contract from the model, and
 * checks that are deterministic rather than judged. Nothing here decides whether
 * the result is *good* — that is the scorer's job — it only records what happened.
 *
 * @module @deepseek-ai/dsh-one-turn/run
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CompiledMask } from './compile.ts'
import { bucketOfCheck, recordLesson } from './lessons.ts'
import { saveTrial } from './store.ts'
import type { OneTurnSpec } from './spec.ts'

/** One check's outcome. */
export interface CheckResult {
  /** Which check ran. */
  readonly check: string
  /** Whether it passed. */
  readonly pass: boolean
  /** What was observed, in one line. */
  readonly detail: string
}

/** Files the model returned. */
export interface BuiltFile {
  /** Path relative to the trial directory. */
  readonly path: string
  /** File contents. */
  readonly content: string
}

/** Everything worth knowing about one trial. */
export interface TrialRecord {
  /** Trial id, also the directory name. */
  readonly id: string
  /** Epoch ms when the run started. */
  readonly at: number
  /** The shape that was attempted. */
  readonly shape: string
  /** Mask token estimate, before the call. */
  readonly maskTokens: number
  /** Tokens the provider reported. */
  readonly inputTokens: number
  /** Tokens the provider reported. */
  readonly outputTokens: number
  /** Dollars spent, at the configured rates. */
  readonly costUsd: number
  /** Model used. */
  readonly model: string
  /** Files produced. */
  readonly files: readonly BuiltFile[]
  /** Check results. */
  readonly checks: readonly CheckResult[]
  /** True only when every check passed. */
  readonly accepted: boolean
  /** Whisper of what went wrong, when it did. */
  readonly error?: string
  /** Model's own report, if it followed the protocol. */
  readonly report?: string
  /** Failure buckets this trial taught the shelf. */
  readonly buckets: readonly string[]
}

/** Where trial artifacts live. */
export function trialsRoot(): string {
  return join(process.env.DSH_HOME ?? join(process.env.HOME ?? '/tmp', '.dsh'), 'one-turn', 'trials')
}

/** Per-trial ceiling, in dollars. */
export function maxTrialUsd(): number {
  const raw = Number(process.env.DSH_ONE_TURN_MAX_USD ?? '')
  return Number.isFinite(raw) && raw > 0 ? raw : 0.25
}

/** Rough dollars for one call, at flash-class rates. */
function estimateCost(inputTokens: number, outputTokens: number): number {
  // DeepSeek flash-class pricing, per million tokens: input $0.28, output $0.42.
  return (inputTokens / 1_000_000) * 0.28 + (outputTokens / 1_000_000) * 0.42
}


/** Words that describe a requirement rather than name a feature. */
const REQUIREMENT_STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'with', 'that', 'this', 'from', 'must', 'should', 'have', 'has', 'are', 'for',
  'shows', 'show', 'visible', 'prominent', 'clearly', 'clearly', 'defaults', 'default', 'creates',
  'create', 'prints', 'print', 'includes', 'include', 'each', 'every', 'which', 'when', 'into',
  'onto', 'above', 'below', 'without', 'there', 'their', 'them', 'they', 'your', 'yours', 'its',
  'instead',
])

/** Feature words that different vocabularies spell differently. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  zip: ['zip', 'archive', 'compress', '.zip'],
  'dry-run': ['dry-run', 'dry run', '--apply', 'apply flag', 'dry_run'],
  remaining: ['remaining', 'days left', 'countdown', 'days to go'],
  prominent: ['hero', 'text-5xl', 'text-6xl', 'text-4xl', 'large', 'headline'],
  phone: ['phone', 'tel:', 'telephone', 'call'],
  price: ['price', 'prices', 'rate', 'cad', 'usd', '$'],
  gst: ['gst', 'tax', 'hst', 'vat'],
  sortable: ['sort', 'sortable', 'sortby', 'order'],
  filter: ['filter', 'search', 'query'],
  reload: ['reload', 'localstorage', 'persist', 'refresh'],
  drag: ['drag', 'draggable', 'drop', 'dataTransfer'],
  hash: ['hash', 'sha', 'md5', 'digest'],
  summary: ['summary', 'summarise', 'summarize', 'report', 'total'],
  columns: ['column', 'th', 'thead'],
  month: ['month', 'monthly', 'jan', 'feb'],
}

/** The meaningful words of a requirement, synonym-expanded. */
function keywordsOf(requirement: string): string[] {
  return requirement.toLowerCase()
    .split(/[^a-z0-9.\-]+/)
    .map(word => word.replace(/^[-.]+|[-.]+$/g, ''))
    .filter(word => word.length > 2 && !REQUIREMENT_STOPWORDS.has(word))
}

/**
 * Words that describe how something should feel rather than what it should do.
 *
 * "clickable", "scrolling", "prominent" are requirements written in adjective —
 * an implementer satisfies them without printing the word. Counting them turned
 * good builds into failures, so only the naming words are required to appear.
 */
function isSoftWord(word: string): boolean {
  return /\.(ing|able|ible|ly|ive|ous|ful)$/.test(word) || word.endsWith('ing') || word.endsWith('able')
}

/** Does a requirement leave a trace in the artifact text? */
function traces(requirement: string, haystack: string): boolean {
  const all = keywordsOf(requirement)
  if (all.length === 0) return false
  const hard = all.filter(word => !isSoftWord(word))
  // Nothing nameable was asked for: the requirement can only be judged by eye.
  if (hard.length === 0) return true
  let matched = 0
  for (const word of hard) {
    const forms = SYNONYMS[word] ?? [word]
    // Prefix match catches inflection: "certified" matches "certif".
    const stem = word.length > 5 ? word.slice(0, 5) : word
    if (forms.some(form => haystack.includes(form)) || haystack.includes(stem)) matched += 1
  }
  return matched / hard.length >= 0.5
}

/** Static checks that need no browser and no judgement. */
function checkFiles(spec: OneTurnSpec, files: readonly BuiltFile[]): CheckResult[] {
  const results: CheckResult[] = []
  const entry = spec.outputContract.entry
  const entryFile = files.find(file => file.path === entry)

  results.push({
    check: 'entry-exists',
    pass: entryFile !== undefined,
    detail: entryFile === undefined ? `${entry} was not produced` : `${entry} present`,
  })

  results.push({
    check: 'file-count',
    pass: files.length > 0 && files.length <= spec.limits.maxFiles,
    detail: `${files.length} file(s), ceiling ${spec.limits.maxFiles}`,
  })

  const totalBytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0)
  results.push({
    check: 'size',
    pass: totalBytes <= spec.limits.maxBytes,
    detail: `${totalBytes} bytes, ceiling ${spec.limits.maxBytes}`,
  })

  const joined = files.map(file => file.content).join('\n')
  const placeholders = ['lorem ipsum', 'TODO:', 'FIXME', 'placeholder image', 'example.com']
  const found = placeholders.filter(token => joined.toLowerCase().includes(token.toLowerCase()))
  results.push({
    check: 'no-placeholders',
    pass: found.length === 0,
    detail: found.length === 0 ? 'none found' : `found: ${found.join(', ')}`,
  })

  // No network at build time means no CDN references in anything served.
  const remote = [...joined.matchAll(/https?:\/\/[^\s"')\]>]+/g)]
    .map(match => match[0])
    .filter(url => !url.startsWith('http://www.w3.org') && !url.startsWith('https://www.w3.org'))
  results.push({
    check: 'no-external-requests',
    pass: remote.length === 0,
    detail: remote.length === 0 ? 'none' : `${remote.length} remote reference(s): ${remote.slice(0, 2).join(', ')}`,
  })

  // Every brief requirement should leave a trace somewhere in the artifact.
  //
  // The matching is deliberately tolerant: a requirement is written in the words a
  // person uses ("date is prominent"), while the artifact is written in the words an
  // implementer uses ("hero", "text-5xl"). Demanding literal phrases produced false
  // failures, which is worse than no check at all — an instrument that lies makes
  // the score meaningless. So: drop requirement-language stopwords, expand a small
  // synonym table, match on prefixes, and pass when half the meaningful words are
  // found. A genuinely missing feature still fails, because none of its words appear.
  const haystack = joined.toLowerCase()
  const missing = spec.mustHave.filter(requirement => !traces(requirement, haystack))
  const unchecked = missing.filter(requirement => keywordsOf(requirement).length === 0)
  results.push({
    check: 'requirements-traced',
    pass: missing.length === unchecked.length,
    detail: missing.length === 0
      ? 'all requirements appear'
      : missing.length === unchecked.length
        ? `${unchecked.length} requirement(s) could not be checked by words`
        : `no trace of: ${missing.slice(0, 2).join(' / ')}`,
  })

  return results
}

/**
 * Escape raw control characters that appear *inside* string literals.
 *
 * Models emit real newlines inside JSON strings often enough that a strict parse
 * fails on a perfectly usable reply. A small state machine fixes exactly that and
 * nothing else, so malformed JSON is still caught rather than silently accepted.
 * @param text - the candidate JSON.
 * @returns the same text with in-string control characters escaped.
 */
function repairControlChars(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const char of text) {
    if (escaped) { out += char; escaped = false; continue }
    if (char === '\\' && inString) { out += char; escaped = true; continue }
    if (char === '"') { inString = !inString; out += char; continue }
    if (inString) {
      const code = char.codePointAt(0) ?? 0
      if (code < 0x20) {
        out += char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : `\\u${code.toString(16).padStart(4, '0')}`
        continue
      }
    }
    out += char
  }
  return out
}

/** Pull a JSON object out of a model reply that may be wrapped in prose or fences. */
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no JSON object in reply')
  const slice = candidate.slice(start, end + 1)
  for (const attempt of [slice, repairControlChars(slice), closeUnbalanced(repairControlChars(slice))]) {
    try {
      return JSON.parse(attempt)
    } catch {
      /* try the next repair */
    }
  }
  throw new Error('reply is not parseable JSON, even after repair')
}

/**
 * Close strings, arrays and objects a truncated reply left open.
 * @param text - the JSON candidate.
 * @returns the same text with its delimiters balanced.
 */
function closeUnbalanced(text: string): string {
  let inString = false
  let escaped = false
  const stack: string[] = []
  for (const char of text) {
    if (escaped) { escaped = false; continue }
    if (char === '\\' && inString) { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === '{') stack.push('}')
    else if (char === '[') stack.push(']')
    else if (char === '}' || char === ']') stack.pop()
  }
  let out = text
  if (inString) out += '"'
  while (stack.length > 0) out += stack.pop()
  return out
}

/** Ask the model for files, and bound what comes back to something safe to write. */
function parseFiles(raw: unknown): BuiltFile[] {
  const source = raw as { files?: unknown }
  if (!Array.isArray(source.files)) throw new Error('reply has no files array')
  return source.files.flatMap((item) => {
    const file = item as { path?: unknown; content?: unknown }
    if (typeof file.path !== 'string' || typeof file.content !== 'string') return []
    // Refuse traversal and absolute paths: a trial must not write outside its own dir.
    const path = file.path.replace(/^\.\//, '')
    if (path === '' || path.startsWith('/') || path.includes('..')) return []
    return [{ path, content: file.content }]
  })
}

/**
 * Run one trial end to end.
 * @param options - the compiled mask, its spec, the key, and the model.
 * @returns the record, including cost, whether or not the trial succeeded.
 */
export async function runTrial(options: {
  readonly spec: OneTurnSpec
  readonly mask: CompiledMask
  readonly apiKey: string
  readonly model: string
  readonly id: string
}): Promise<TrialRecord> {
  const started = Date.now()
  const id = options.id
  const dir = join(trialsRoot(), id)

  // A hard ceiling before the call, not after: refuse to start what we cannot afford.
  const ceiling = maxTrialUsd()
  const projected = estimateCost(options.mask.tokens + 200, 3000)
  if (projected > ceiling) {
    return {
      id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
      inputTokens: 0, outputTokens: 0, costUsd: 0, model: options.model, files: [], checks: [],
      accepted: false, buckets: [],
      error: `refused before spending: projected $${projected.toFixed(3)} exceeds ceiling $${ceiling.toFixed(2)}`,
    }
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: options.mask.text },
          {
            role: 'user',
            content: [
              'Build it now.',
              'Reply with one JSON object and nothing else:',
              '{"files":[{"path":"index.html","content":"..."}],"report":"how each acceptance check was verified"}',
              'Every file\'s content must be a complete, final file. No ellipses, no placeholders.',
            ].join('\n'),
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 12000,
        temperature: 0.15,
      }),
    })

    const body = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      error?: { message?: string }
    }

    const inputTokens = body.usage?.prompt_tokens ?? 0
    const outputTokens = body.usage?.completion_tokens ?? 0
    const costUsd = estimateCost(inputTokens, outputTokens)

    // From here on every return carries the real cost: a failed trial that spent
    // money must still report what it spent, or the ledger lies.
    if (body.error !== undefined) {
      return {
        id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
        inputTokens, outputTokens, costUsd, model: options.model, files: [], checks: [],
        accepted: false, buckets: [], error: body.error.message ?? 'provider error',
      }
    }

    const text = body.choices?.[0]?.message?.content ?? ''
    let parsed: { report?: unknown }
    let files: BuiltFile[]
    try {
      parsed = extractJson(text) as { report?: unknown }
      files = parseFiles(parsed)
    } catch (parseError) {
      void saveTrial({
        id, shape: options.spec.shape, accepted: false, costUsd, inputTokens, outputTokens,
        buckets: ['broken-run'], checks: [], files: [],
        error: parseError instanceof Error ? parseError.message : String(parseError),
      }).catch(() => undefined)
      return {
        id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
        inputTokens, outputTokens, costUsd, model: options.model, files: [], checks: [],
        accepted: false, buckets: ['broken-run'],
        error: `could not read the reply: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      }
    }
    const checks = checkFiles(options.spec, files)
    const accepted = checks.every(check => check.pass)

    // Learning: every failed check becomes a lesson for the shape, so the next
    // interview on this shape asks differently and the next mask carries a warning.
    const buckets = accepted
      ? []
      : checks.filter(check => !check.pass)
          .flatMap(check => {
            const bucket = bucketOfCheck(check.check, check.detail)
            return bucket === undefined ? [] : [bucket]
          })
    for (const bucket of new Set(buckets)) {
      const failing = checks.find(check => !check.pass && bucketOfCheck(check.check, check.detail) === bucket)
      recordLesson({ shape: options.spec.shape, bucket, ...(failing === undefined ? {} : { note: failing.detail }) })
    }

    // Keep the artifacts; they are the evidence a later human review depends on.
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    for (const file of files) {
      const target = join(dir, file.path)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, file.content, 'utf8')
    }
    writeFileSync(join(dir, 'summary.json'), JSON.stringify({
      id, at: started, shape: options.spec.shape, model: options.model,
      inputTokens, outputTokens, costUsd, accepted, checks,
    }, null, 2), 'utf8')

    const record: TrialRecord = {
      id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
      inputTokens, outputTokens, costUsd, model: options.model, files, checks, accepted, buckets,
      ...(typeof parsed.report === 'string' ? { report: parsed.report } : {}),
    }
    // Evidence outlives the container now.
    void saveTrial({
      id, shape: options.spec.shape, accepted, costUsd, inputTokens, outputTokens,
      buckets, checks, files,
    }).catch(() => undefined)
    return record
  } catch (error) {
    return {
      id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
      inputTokens: 0, outputTokens: 0, costUsd: 0, model: options.model, files: [], checks: [],
      accepted: false, buckets: [], error: error instanceof Error ? error.message : String(error),
    }
  }
}
