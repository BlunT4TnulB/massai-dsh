/**
 * Cost-aware DeepSeek model router (decision engine + model-facing tool).
 *
 * Routes a task to the cheapest suitable model: `deepseek-flash` for simple,
 * fast work and `deepseek-v4-pro` for complex, quality-critical work. This is
 * the routing *policy*; wiring it into the LLM resolution seam (automatic
 * per-request routing + failover) is the Phase 3 adapter build.
 *
 * @module @deepseek-ai/dsh-model-router
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'model-router'
export const inject = ['tools']

const DEFAULT_CHEAP_MODEL = 'deepseek-flash'
const DEFAULT_QUALITY_MODEL = 'deepseek-v4-pro'
const DEFAULT_ESCALATE_KEYWORDS = [
  'refactor', 'debug', 'design', 'architecture', 'complex', 'hard',
  'audit', 'review', 'migrate', 'optimize', 'reason', 'analyze',
]
const ESCALATE_MIN_LENGTH = 500

export interface Config {
  cheapModel?: string
  qualityModel?: string
  escalateKeywords?: string[]
}

export const Config: z<Config> = z.object({
  cheapModel: z.string(),
  qualityModel: z.string(),
  escalateKeywords: z.array(z.string()),
})

export interface RouteResult {
  model: string
  reason: string
}

/** Pure routing decision: simple/cheap tasks → cheap model, complex → quality model. */
export function route(task: string, config: Config = {}): RouteResult {
  const cheap = config.cheapModel ?? DEFAULT_CHEAP_MODEL
  const quality = config.qualityModel ?? DEFAULT_QUALITY_MODEL
  const keywords = config.escalateKeywords ?? DEFAULT_ESCALATE_KEYWORDS
  const text = task.toLowerCase()
  const complex = keywords.some(keyword => text.includes(keyword)) || task.length > ESCALATE_MIN_LENGTH
  return complex
    ? { model: quality, reason: `escalated to ${quality} (complex task)` }
    : { model: cheap, reason: `routed to ${cheap} (cheap/fast task)` }
}

export function apply(ctx: Context, config: Config = {}): void {
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

  ctx.tools.register(tool)
}
