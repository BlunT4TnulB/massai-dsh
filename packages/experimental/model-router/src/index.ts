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
import { createUserMessage } from '@deepseek-ai/dsh-llm'
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
  /** Only route on this provider; local/other routes keep the user's choice. */
  routeProvider?: string
  /** A free local provider (gateway → Ollama) used for small work when set. */
  localProvider?: string
  /** Model id on the local provider. */
  localModel?: string
  /** New-turn size under which local work is attempted first. */
  localMaxTokens?: number
  /** Prompts a guest session may send; 0 disables the cap. */
  guestPromptLimit?: number
}

export const Config: z<Config> = z.object({
  cheapModel: z.string(),
  qualityModel: z.string(),
  escalateKeywords: z.array(z.string()),
  mode: z.union(['auto', 'escalate-only', 'off']),
  ceilingTokens: z.number(),
  errorStreak: z.number(),
  visionModel: z.string(),
  routeProvider: z.string(),
  localProvider: z.string(),
  localModel: z.string(),
  localMaxTokens: z.number(),
  guestPromptLimit: z.number(),
})

/** One candidate route with its relative price (1 = cheap cloud tier). */
export interface Arm {
  /** Stable arm id used by the learner. */
  id: string
  /** Provider route. */
  provider: string
  /** Model id. */
  model: string
  /** Relative price: local is near-free, cheap is 1, quality is 2. */
  price: number
}

/**
 * The arms this deployment may choose between, cheapest first.
 * @param config - router configuration.
 * @returns candidate arms including the local route when configured.
 */
export function armsOf(config: Config = {}): Arm[] {
  const arms: Arm[] = []
  const local = config.localProvider
  if (local !== undefined && local !== '' && (process.env.DSH_LOCAL_ENABLED ?? '1') !== '0') {
    arms.push({ id: `${local}/auto`, provider: local, model: config.localModel ?? 'auto', price: 0.02 })
  }
  arms.push({
    id: `deepseek-official/${config.cheapModel ?? DEFAULT_CHEAP_MODEL}`,
    provider: config.routeProvider ?? 'deepseek-official',
    model: config.cheapModel ?? DEFAULT_CHEAP_MODEL,
    price: 1,
  })
  arms.push({
    id: `deepseek-official/${config.qualityModel ?? DEFAULT_QUALITY_MODEL}`,
    provider: config.routeProvider ?? 'deepseek-official',
    model: config.qualityModel ?? DEFAULT_QUALITY_MODEL,
    price: 2,
  })
  return arms
}

export interface RouteResult {
  model: string
  reason: string
  /** Provider to use, when the router moves across providers (local vs cloud). */
  provider?: string
}

/** Signals read from the request about to be sent. */
export interface Signals {
  /** Rough prompt size in tokens, whole context (characters / 4). */
  promptTokens: number
  /** Rough size of the NEWEST user message — the work being asked for now. */
  newTokens: number
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
  let newTokens = 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message === undefined || message.role !== 'user') continue
    const text = textOf(message)
    newTokens = Math.round(text.length / 4)
    const lower = text.toLowerCase()
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
  return { promptTokens, newTokens, keyword, errorStreak }
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
  // Local-first: small, unremarkable work goes to the free model on this machine
  // when a local route is configured. Hard signals keep the cloud route.
  const local = config.localProvider
  if (local !== undefined && local !== '' && signals.keyword === undefined
    && signals.errorStreak === 0
    && signals.newTokens < (config.localMaxTokens ?? 2_500)) {
    return {
      model: config.localModel ?? 'auto',
      provider: local,
      reason: `local ${local} (${String(signals.newTokens)} new tokens, nothing hard) — free`,
    }
  }
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
  if (signals.newTokens > ceiling) {
    return { model: quality, reason: `escalated to ${quality} (${Math.round(signals.newTokens / 1000)}k tokens of new work)` }
  }
  if (heaviest(options.model)) {
    return { model: cheap, reason: `dropped to ${cheap} (${Math.round(signals.newTokens / 1000)}k new tokens, no hard signals)` }
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
  const previous = new Map<string, { features: Features; arm: string }>()
  if (mode !== 'off') {
    // The per-step seam: the agent has already chosen a route for this step, and
    // `agent.model.select` records a switch that the harness announces to the
    // conversation — so a downgrade is visible, never silent.
    ctx.on('agent/pre-step', async ({ agent, messages, modelSelection }, next): Promise<PreStepDecision> => {
      try {
        // Only steer the DeepSeek route. A local model is already the cheapest
        // thing available, and a third-party route may not share these tiers.
        const routeProvider = config.routeProvider ?? 'deepseek-official'
        const localProvider = config.localProvider ?? ''
        const steerable = modelSelection?.provider === routeProvider
          || (localProvider !== '' && modelSelection?.provider === localProvider)
        // Guests get a taste, not a free tier: past the cap the step is rejected
        // so a preview cannot quietly spend the deployment's key forever.
        const guestLimit = config.guestPromptLimit ?? 0
        const sessionUserId = (agent.session.header as { userId?: string }).userId ?? ''
        if (guestLimit > 0 && sessionUserId.startsWith('guest-')) {
          let prompts = 0
          for (let seq = 0; seq < agent.session.seq; seq += 1) {
            const record = agent.session.eventAt(seq as never) as { type?: string } | undefined
            if (record?.type === 'user/message') prompts += 1
          }
          if (prompts > guestLimit) {
            // A guest who spends the last prompt of the preview gets one
            // courtesy turn: the model is told to say the preview has ended and
            // where to continue. After that the step is rejected, so the
            // deployment's key cannot be spent indefinitely.
            if (prompts === guestLimit + 1) {
              const notice = createUserMessage({
                source: { kind: 'user' },
                content: [{
                  type: 'text',
                  text: '[preview ended — this is a system note, not the user speaking] '
                    + 'The free preview for this visitor is over. Reply in at most two short sentences: '
                    + 'say the preview has ended, that their work is saved, and that they can keep going by '
                    + 'signing in or adding their own DeepSeek key at /access. Do not attempt the request.',
                }],
              })
              return { kind: 'enter', messages: [...(messages as never[]), notice as never] }
            }
            return { kind: 'reject' }
          }
        }
        if (modelSelection?.model !== undefined && steerable) {
          const signals = signalsOf({ messages: messages as never }, config)
          const features: Features = {
            size: signals.newTokens < 2_000 ? 0 : signals.newTokens < 10_000 ? 1 : signals.newTokens < (config.ceilingTokens ?? DEFAULT_CEILING_TOKENS) ? 2 : 3,
            keyword: signals.keyword !== undefined,
            struggling: signals.errorStreak >= (config.errorStreak ?? DEFAULT_ERROR_STREAK),
          }
          const arms = armsOf(config)
          const priceOf = (armId: string): number => arms.find(arm => arm.id === armId)?.price ?? 1
          // The tail of the history is the outcome of the PREVIOUS step.
          const last = previous.get(agent.id)
          if (last !== undefined) {
            observe(learner, last.features, last.arm, { failed: signals.errorStreak > 0 }, priceOf(last.arm))
            saveState(learner)
          }
          // Policy overrides first: capability and hard signals outrank price.
          const hard = hasImage(messages as never)
            || signals.keyword !== undefined
            || signals.errorStreak >= (config.errorStreak ?? DEFAULT_ERROR_STREAK)
            || signals.newTokens > (config.ceilingTokens ?? DEFAULT_CEILING_TOKENS)
          const learnerArms = hard ? arms.filter(arm => arm.price > 0.5) : arms
          const learned = choose(learner, features, learnerArms.map(arm => arm.id))
          let decision: RouteResult
          if (learned !== undefined) {
            const arm = arms.find(candidate => candidate.id === learned.arm)
            decision = arm === undefined
              ? decide({ model: modelSelection.model, messages: messages as never }, config)
              : { provider: arm.provider, model: arm.model, reason: learned.reason }
          } else {
            decision = decide({ model: modelSelection.model, messages: messages as never }, config)
          }
          previous.set(agent.id, { features, arm: decision.provider === undefined
            ? `${routeProvider}/${decision.model}`
            : `${decision.provider}/${decision.model}` })
          const nextProvider = decision.provider ?? modelSelection.provider
          if (decision.model !== modelSelection.model || nextProvider !== modelSelection.provider) {
            const carryEffort = modelSelection.reasoningEffort !== undefined && !decision.model.includes('flash') && nextProvider === modelSelection.provider
            const selection = carryEffort
              ? { provider: nextProvider, model: decision.model, reasoningEffort: modelSelection.reasoningEffort }
              : { provider: nextProvider, model: decision.model }
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
