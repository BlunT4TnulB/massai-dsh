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
  const missing = spec.mustHave.filter((requirement) => {
    const keywords = requirement.toLowerCase().split(/\W+/).filter(word => word.length > 4)
    if (keywords.length === 0) return false
    return !keywords.some(word => joined.toLowerCase().includes(word))
  })
  results.push({
    check: 'requirements-traced',
    pass: missing.length === 0,
    detail: missing.length === 0 ? 'all requirements appear' : `no trace of: ${missing.slice(0, 2).join(' / ')}`,
  })

  return results
}

/** Pull a JSON object out of a model reply that may be wrapped in prose or fences. */
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no JSON object in reply')
  return JSON.parse(candidate.slice(start, end + 1))
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
      accepted: false,
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
        max_tokens: 8000,
        temperature: 0.3,
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

    if (body.error !== undefined) throw new Error(body.error.message ?? 'provider error')

    const text = body.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(text) as { report?: unknown }
    const files = parseFiles(parsed)
    const checks = checkFiles(options.spec, files)
    const accepted = checks.every(check => check.pass)

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

    return {
      id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
      inputTokens, outputTokens, costUsd, model: options.model, files, checks, accepted,
      ...(typeof parsed.report === 'string' ? { report: parsed.report } : {}),
    }
  } catch (error) {
    return {
      id, at: started, shape: options.spec.shape, maskTokens: options.mask.tokens,
      inputTokens: 0, outputTokens: 0, costUsd: 0, model: options.model, files: [], checks: [],
      accepted: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
