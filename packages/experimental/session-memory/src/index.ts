/**
 * Cross-session memory: after a session does real work, distill it once with the
 * strong model and keep that record. New sessions in the same project start with
 * the useful part of what came before — decisions, files, traps — instead of
 * beginning from zero.
 *
 * The trade is deliberate: one summarization call at the end of a substantial
 * session buys a shorter, better-informed start for every session after it.
 *
 * @module @deepseek-ai/dsh-session-memory
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'

export const name = 'session-memory'

/** Plugin configuration. */
export interface Config {
  /** Whether recall/injection is active. */
  enabled?: boolean
  /** Model that writes the durable record (defaults to the cheap tier). */
  summaryModel?: string
  /** Provider for that model. */
  summaryProvider?: string
  /** Minimum user turns before a session is worth remembering. */
  minTurns?: number
  /** How many past records to recall (newest first). */
  recallEntries?: number
  /** Character budget for the injected recall block. */
  recallChars?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean(),
  summaryModel: z.string(),
  summaryProvider: z.string(),
  minTurns: z.number(),
  recallEntries: z.number(),
  recallChars: z.number(),
})

/** One durable record of past work. */
interface MemoryRecord {
  /** When it was written (ms since epoch). */
  at: number
  /** Project directory the work happened in. */
  cwd: string
  /** Session that produced it. */
  session: string
  /** The distilled account. */
  text: string
}

/** Where memory lives. */
function memoryDir(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'memory')
}

/** Per-project file, named after the directory. */
function memoryPath(cwd: string): string {
  const slug = cwd.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80) || 'root'
  return join(memoryDir(), `${slug}.jsonl`)
}

/**
 * Read every record for one project.
 * @param cwd - project directory.
 * @returns records, oldest first.
 */
/** Records imported from other assistants; recalled in every project. */
function readImported(): MemoryRecord[] {
  const path = join(memoryDir(), '_imported.jsonl')
  if (!existsSync(path)) return []
  const out: MemoryRecord[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      const parsed = JSON.parse(line) as MemoryRecord
      if (typeof parsed.text === 'string') out.push(parsed)
    } catch {
      /* skip a torn line */
    }
  }
  return out
}

function readRecords(cwd: string): MemoryRecord[] {
  const path = memoryPath(cwd)
  if (!existsSync(path)) return []
  const out: MemoryRecord[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      const parsed = JSON.parse(line) as MemoryRecord
      if (typeof parsed.text === 'string') out.push(parsed)
    } catch {
      /* a torn line is skipped, never fatal */
    }
  }
  return out
}

/**
 * Append one record atomically.
 * @param cwd - project directory.
 * @param record - the distilled account.
 */
function appendRecord(cwd: string, record: MemoryRecord): void {
  try {
    const path = memoryPath(cwd)
    mkdirSync(dirname(path), { recursive: true })
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
    const temporary = `${path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, `${existing}${JSON.stringify(record)}\n`, 'utf8')
    renameSync(temporary, path)
  } catch {
    /* memory is an optimisation; losing a record must never break a turn */
  }
}

/** Flatten message content into text for the summarizer. */
function textOf(message: unknown): string {
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join(' ')
}

/**
 * Distil one session into a durable record with the configured model.
 * @param ctx - host context with the llm runtime.
 * @param config - plugin configuration.
 * @param agent - the session's agent.
 * @param messages - the conversation so far.
 * @returns the record text, or undefined when the call failed or found nothing.
 */
async function distill(
  ctx: { llm: { stream(options: GenerateOptions<string>): AsyncIterable<StreamChunk> } },
  config: Config,
  messages: readonly unknown[],
): Promise<string | undefined> {
  const transcript = messages
    .slice(-40)
    .map(message => textOf(message))
    .filter(text => text !== '')
    .join('\n---\n')
    .slice(0, 24_000)
  if (transcript.length < 200) return undefined
  const prompt = [
    'Summarise this work session for a teammate who will continue the project later.',
    'Reply with exactly these four sections, each at most three short lines:',
    '',
    'WORK: what was built or changed, and which files matter.',
    'PITFALLS: mistakes made, dead ends, and traps — say what failed and what fixed it.',
    'TOOLS: which commands or tools actually worked for what (e.g. "npm test --filter x to isolate").',
    'NEXT: the single next step.',
    '',
    'Be concrete. No preamble, no praise, no restating the question. Omit a section only if it is empty.',
    '',
    transcript,
  ].join('\n')
  let text = ''
  try {
    for await (const chunk of ctx.llm.stream({
      provider: config.summaryProvider ?? 'deepseek-official',
      model: config.summaryModel ?? 'deepseek-flash',
      messages: [createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } })],
    })) {
      if (chunk.type === 'text-delta') text += chunk.text
    }
  } catch {
    return undefined
  }
  const trimmed = text.trim()
  return trimmed === '' ? undefined : trimmed.slice(0, 2_000)
}

export function apply(ctx: Context, config: Config = {}): void {
  if (config.enabled === false) return
  const minTurns = config.minTurns ?? 6
  const recallEntries = config.recallEntries ?? 3
  const recallChars = config.recallChars ?? 1_200
  /** Agents that already received their recall block. */
  const recalled = new Set<string>()
  /** Agents that already wrote a record this session. */
  const recorded = new Set<string>()

  ctx.on('agent/pre-step', async ({ agent }, next): Promise<PreStepDecision> => {
    try {
      const cwd = agent.session.header.cwd ?? process.cwd()
      if (!recalled.has(agent.id)) {
        recalled.add(agent.id)
        // Imported conversations apply everywhere, so they ride along with the
        // project's own records — newest first, still inside the character budget.
        const records = [...readRecords(cwd), ...readImported().slice(-2)]
        if (records.length > 0) {
          let block = 'Prior work in this project. Use it; do not rediscover it.\n'
          for (const record of records) {
            const day = new Date(record.at).toISOString().slice(0, 10)
            // Keep the section labels: PITFALLS is the part that stops a repeat
            // mistake, and it is the cheapest line in the whole context.
            const body = record.text
              .split('\n')
              .map(line => line.trim())
              .filter(line => line !== '')
              .join(' | ')
            const entry = `• ${day}: ${body}\n`
            if (block.length + entry.length > recallChars) break
            block += entry
          }
          if (block.length > 60) {
            const decision = await next()
            if (decision.kind === 'reject') return decision
            return {
              ...decision,
              messages: [...decision.messages, createUserMessage({
                content: [{ type: 'text', text: block }],
                source: { kind: 'user' },
              })],
            }
          }
        }
      }
    } catch {
      /* recall must never break a step */
    }
    return next()
  })

  // Once per substantial session, write the durable record. `session/event` is
  // a plain event (no continuation), so the work is fire-and-forget.
  type SessionLike = {
    header: { cwd?: string }
    seq: number
    id: unknown
    eventAt(seq: never): unknown
  }
  ctx.on('session/event', (sessionRow, sessionEvent) => {
    const session = sessionRow as unknown as SessionLike
    const event = sessionEvent as { type?: string }
    void (async () => {
      try {
        if (event.type !== 'turn/end') return
        if (session.seq < minTurns) return
        const key = String(session.id)
        if (recorded.has(key)) return
        recorded.add(key)
        const cwd = session.header.cwd ?? process.cwd()
        const messages: unknown[] = []
        for (let seq = 0; seq < session.seq; seq += 1) {
          const record = session.eventAt(seq as never) as { type?: string; data?: { message?: unknown } } | undefined
          if (record?.type === 'user/message' || record?.type === 'assistant/message') {
            const message = record.data?.message
            if (message !== undefined) messages.push(message)
          }
        }
        const text = await distill(ctx.get('llm') as never, config, messages)
        if (text !== undefined) appendRecord(cwd, { at: Date.now(), cwd, session: key, text })
      } catch {
        /* memory writes must never break a turn */
      }
    })()
  })
}
