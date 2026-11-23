/**
 * One-turn routes: compile a mask for free, so shapes can be inspected by hand
 * before a single paid call is made.
 *
 * `POST /api/one-turn/compile` takes intake answers and returns the spec, the
 * compiled mask, and the per-section token weight. It never calls a model, which
 * is what makes the whole refinement loop free.
 *
 * @module @deepseek-ai/dsh-one-turn
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { compile, maskAudit } from './compile.ts'
import { interview, shapeChoices } from './intake.ts'
import { normalise, refusalText } from './normalise.ts'
import type { IntakeAnswers } from './spec.ts'

/** Required services: the HTTP server the routes hang off. */
export const inject = ['webServer']

/** Answer one JSON request. */
function respond(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(text)),
    'cache-control': 'no-store',
  })
  res.end(text)
}

/** Read and bound a request body. */
async function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.byteLength
    if (size > limit) throw new Error('body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Read one string field from an unknown object. */
function str(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

/** Read one string-array field from an unknown object. */
function list(source: Record<string, unknown>, key: string): string[] {
  const value = source[key]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') return value.split('\n').map(line => line.trim()).filter(line => line !== '')
  return []
}

/**
 * Register the one-turn routes.
 * @param ctx - the plugin context.
 */
export function apply(ctx: Context): void {
  // The interview as data, so any surface can render it and never drift.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/intake', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      respond(res, 200, { questions: interview(), shapes: shapeChoices() })
    },
  })

  // Compile only: free, deterministic, and the whole point of the split.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/compile', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const answers: IntakeAnswers = {
          goal: str(parsed, 'goal'),
          ...(str(parsed, 'shape') === '' ? {} : { shape: str(parsed, 'shape') }),
          ...(str(parsed, 'audience') === '' ? {} : { audience: str(parsed, 'audience') }),
          mustHave: list(parsed, 'mustHave'),
          nonGoals: list(parsed, 'nonGoals'),
          ...(str(parsed, 'reference') === '' ? {} : { reference: str(parsed, 'reference') }),
          ...(str(parsed, 'data') === '' ? {} : { data: str(parsed, 'data') }),
          acceptance: list(parsed, 'acceptance'),
          ...(str(parsed, 'notes') === '' ? {} : { notes: str(parsed, 'notes') }),
        }
        const normalised = normalise(answers)
        if (!normalised.ok) {
          respond(res, 422, {
            ok: false,
            refusal: normalised.refusal,
            explain: refusalText(normalised.refusal),
            spentUsd: 0,
          })
          return
        }
        const compiled = compile(normalised.spec)
        respond(res, 200, {
          ok: true,
          spec: normalised.spec,
          mask: compiled.text,
          audit: maskAudit(compiled),
          sections: compiled.sections,
          tokens: compiled.tokens,
          characters: compiled.characters,
          spentUsd: 0,
        })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // A browsable view of the supported shapes, for the intake screen.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/shapes', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      respond(res, 200, { shapes: shapeChoices() })
    },
  })
}
