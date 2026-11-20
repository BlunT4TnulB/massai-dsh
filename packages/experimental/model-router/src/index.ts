/**
 * Cost-aware DeepSeek model router — decision engine, automatic per-request
 * switch, and a model-facing tool.
 *
 * The switch rides the `llm/stream` waterfall: every request passes through it
 * with its options in hand, so the model can be chosen from the *actual* work
 * about to happen (prompt size, keywords, a struggling tool loop) instead of a
 * guess made far from the request. Cheap is the default; quality is spent only
 * where it buys something.
 *
 * @module @deepseek-ai/dsh-model-router
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import z from '@deepseek-ai/schemastery'
import { choose, loadState, observe, saveState, summarize, type Features } from './learning.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'model-router'
export const inject = ['tools']

const DEFAULT_CHEAP_MODEL = 'deepseek-flash'
const DEFAULT_QUALITY_MODEL = 'deepseek-v4-pro'
const DEFAULT_ESCALATE_KEYWORDS = [
  'refactor', 'debug', 'design', 'architecture', 'complex', 'hard',
  'audit', 'review', 'migrate', 'optimize', 'reason', 'analyze',
  'think hard', 'carefully', 'why does', 'root cause',
]
/** Prompt size, in estimated tokens, above which cheap is no longer honest. */
const DEFAULT_CEILING_TOKENS = 45_000
/** Consecutive failed tool results that mean the current model is struggling. */
const DEFAULT_ERROR_STREAK = 2

export interface Config {
  cheapModel?: string
  qualityModel?: string
  escalateKeywords?: string[]
  /**
   * `auto` lets the router move either way; `escalate-only` refuses to downgrade
   * a choice the user made; `off` keeps the user's pick untouched.
   */
  mode?: 'auto' | 'escalate-only' | 'off'
  ceilingTokens?: number
  errorStreak?: number
  /** Model used whenever the prompt carries an image (the vision-capable tier). */
  visionModel?: string
}

export const Config: z<Config> = z.object({
  cheapModel: z.string(),
  qualityModel: z.string(),
  escalateKeywords: z.array(z.string()),
  mode: z.union(['auto', 'escalate-only', 'off']),
  ceilingTokens: z.number(),
  errorStreak: z.number(),
  visionModel: z.string(),
})

export interface RouteResult {
  model: string
  reason: string
}

/** Signals read from the request about to be sent. */
export interface Signals {
  /** Rough prompt size in tokens (characters / 4). */
  promptTokens: number
  /** Whether a routing keyword appears in the newest user message. */
  keyword: string | undefined
  /** Failed tool results at the tail of the history. */
  errorStreak: number
}

/**
 * Whether any message carries an image block.
 * @param messages - the step's messages.
 * @returns true when the prompt is multimodal.
 */
function hasImage(messages: ReadonlyArray<{ content?: unknown }>): boolean {
  for (const message of messages) {
    const content = message.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part !== null && typeof part === 'object' && (part as { type?: unknown }).type === 'image') return true
    }
  }
  return false
}

/** Flatten one message's content into searchable text. */
function textOf(message: { content?: unknown; role?: string }): string {
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        const text = (part as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      })
      .join(' ')
  }
  return ''
}

/**
 * Read the routing signals out of a request.
 * @param options - the request about to be sent.
 * @param config - router configuration.
 * @returns measured signals.
 */
export function signalsOf(options: { messages?: ReadonlyArray<{ content?: unknown; role?: string }>; system?: string }, config: Config = {}): Signals {
  const keywords = config.escalateKeywords ?? DEFAULT_ESCALATE_KEYWORDS
  const messages = options.messages ?? []
  const chars = messages.reduce((sum, message) => sum + textOf(message).length, 0)
    + (options.system?.length ?? 0)
  const promptTokens = Math.round(chars / 4)
  let keyword: string | undefined
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message === undefined || message.role !== 'user') continue
    const lower = textOf(message).toLowerCase()
    keyword = keywords.find(candidate => lower.includes(candidate))
    break
  }
  let errorStreak = 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message === undefined) continue
    if (message.role !== 'tool') break
    const lower = textOf(message).toLowerCase()
    if (/(^|\W)(error|failed|failure|exception|traceback)(\W|$)/.test(lower)) errorStreak += 1
    else break
  }
  return { promptTokens, keyword, errorStreak }
}

/**
 * Decide which model serves this request.
 * @param options - the request about to be sent.
 * @param config - router configuration.
 * @returns the chosen model and why.
 */
export function decide(options: { messages?: ReadonlyArray<{ content?: unknown; role?: string }>; system?: string; model: string }, config: Config = {}): RouteResult {
  const cheap = config.cheapModel ?? DEFAULT_CHEAP_MODEL
  const quality = config.qualityModel ?? DEFAULT_QUALITY_MODEL
  const ceiling = config.ceilingTokens ?? DEFAULT_CEILING_TOKENS
  const streakLimit = config.errorStreak ?? DEFAULT_ERROR_STREAK
  const signals = signalsOf(options, config)
  const heaviest = (model: string): boolean => !model.includes('flash')
  // Capability beats cost: a text-only model cannot receive an image at all, so
  // a multimodal prompt pins the step to the vision-capable tier.
  if (hasImage(options.messages ?? [])) {
    const vision = config.visionModel ?? cheap
    return { model: vision, reason: `pinned to ${vision} (prompt carries an image; it is the vision-capable tier)` }
  }

  if (signals.keyword !== undefined) {
    return { model: quality, reason: `escalated to ${quality} (asks for "${signals.keyword}")` }
  }
  if (signals.errorStreak >= streakLimit) {
    return { model: quality, reason: `escalated to ${quality} (${signals.errorStreak} failed tool results in a row)` }
  }
  if (signals.promptTokens > ceiling) {
    return { model: quality, reason: `escalated to ${quality} (${Math.round(signals.promptTokens / 1000)}k-token context)` }
  }
  if (heaviest(options.model)) {
    return { model: cheap, reason: `dropped to ${cheap} (small context, no hard signals — ${Math.round(signals.promptTokens / 1000)}k tokens)` }
  }
  return { model: options.model, reason: `kept ${options.model} (cheap is enough)` }
}

/**
 * Pure routing decision for a described task (kept for the model-facing tool).
 * @param task - the task text.
 * @param config - router configuration.
 * @returns the chosen model and why.
 */
export function route(task: string, config: Config = {}): RouteResult {
  const fake = { model: config.cheapModel ?? DEFAULT_CHEAP_MODEL, messages: [{ content: task }] }
  return decide(fake, config)
}

export function apply(ctx: Context, config: Config = {}): void {
  const mode = config.mode ?? 'auto'
  // Learned statistics, loaded once and kept in memory; every observed step is
  // persisted so the router keeps improving across restarts.
  const learner = loadState()
  const previous = new Map<string, { features: Features; model: string }>()
  if (mode !== 'off') {
    // The per-step seam: the agent has already chosen a route for this step, and
    // `agent.model.select` records a switch that the harness announces to the
    // conversation — so a downgrade is visible, never silent.
    ctx.on('agent/pre-step', async ({ agent, messages, modelSelection }, next): Promise<PreStepDecision> => {
      try {
        if (modelSelection?.model !== undefined) {
          const signals = signalsOf({ messages: messages as never }, config)
          const features: Features = {
            size: signals.promptTokens < 10_000 ? 0 : signals.promptTokens < 30_000 ? 1 : signals.promptTokens < (config.ceilingTokens ?? DEFAULT_CEILING_TOKENS) ? 2 : 3,
            keyword: signals.keyword !== undefined,
            struggling: signals.errorStreak >= (config.errorStreak ?? DEFAULT_ERROR_STREAK),
          }
          // The tail of the history is the outcome of the PREVIOUS step.
          const last = previous.get(agent.id)
          if (last !== undefined) {
            observe(learner, last.features, last.model, { failed: signals.errorStreak > 0 })
            saveState(learner)
          }
          previous.set(agent.id, { features, model: modelSelection.model })
          const learned = choose(learner, features, [config.cheapModel ?? DEFAULT_CHEAP_MODEL, config.qualityModel ?? DEFAULT_QUALITY_MODEL])
          const decision = learned !== undefined
            ? { model: learned.arm, reason: learned.reason }
            : decide({ model: modelSelection.model, messages: messages as never })
          const wantsCheaper = decision.model.includes('flash') && !modelSelection.model.includes('flash')
          if (mode === 'escalate-only' && wantsCheaper) return next()
          if (decision.model !== modelSelection.model) {
            const carryEffort = modelSelection.reasoningEffort !== undefined && !decision.model.includes('flash')
            const selection = carryEffort
              ? { provider: modelSelection.provider, model: decision.model, reasoningEffort: modelSelection.reasoningEffort }
              : { provider: modelSelection.provider, model: decision.model }
            ;(agent as Agent).model.select(selection)
            ctx.logger?.info?.('model-router', '%s -> %s: %s', modelSelection.model, decision.model, decision.reason)
          }
        }
      } catch {
        /* routing must never break a step */
      }
      return next()
    })
  }

  const tool = defineTool({
    name: 'route_model',
    description:
      'Recommend the cheapest suitable DeepSeek model for a task: deepseek-flash for simple/fast work, deepseek-v4-pro for complex/quality-critical work.',
    parameters: {
      task: { type: 'string', required: true, description: 'The task to route.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          model: { type: 'string', required: true },
          reason: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `${value.model} — ${value.reason}` }],
    },
    async execute(args) {
      return route(args.task, config)
    },
  })

  const stats = defineTool({
    name: 'model_routing_stats',
    description: 'Report what the model router has learned: for each kind of step, how often the cheap and quality models finished without a tool error.',
    parameters: {},
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          steps: { type: 'number', required: true },
          lines: { type: 'array', items: { type: 'string' }, required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.lines.length === 0
          ? `No routing evidence yet (${String(value.steps)} observed steps).`
          : `${String(value.steps)} observed steps:\n${value.lines.join('\n')}`,
      }],
    },
    async execute() {
      return { steps: learner.steps, lines: summarize(learner) }
    },
  })

  ctx.tools.register(tool)
  ctx.tools.register(stats)
}
