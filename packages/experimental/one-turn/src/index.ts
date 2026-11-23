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
import { maxTrialUsd, runTrial, trialsRoot } from './run.ts'
import { interview, probes, shapeChoices } from './intake.ts'
import { isAmbiguous, readings } from './ambiguity.ts'
import { extrapolate, extrapolationBlock } from './extrapolator/index.ts'
import { hydrateLessons, lessonsFor, readLessons, recordLesson } from './lessons.ts'
import { ensureStoreSchema, storeConfigured, trialStats } from './store.ts'
import { hydrateVoice, readVoice, writeVoice, type Voice } from './voice.ts'
import { nextStep } from './suggest.ts'
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
  // One boot step: the tables exist, and the learning shelf is in memory so the
  // mask compiler can stay a pure synchronous function.
  void (async () => {
    try {
      await ensureStoreSchema()
      const lessons = await hydrateLessons()
      await hydrateVoice()
      process.stderr.write(`one-turn: store ${storeConfigured() ? 'durable' : 'file-only'}, ${lessons} lesson(s) loaded\n`)
    } catch (error) {
      process.stderr.write(`one-turn: store boot failed: ${error instanceof Error ? error.message : String(error)}\n`)
    }
  })()

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
          details: list(parsed, 'details'),
          neverInvent: list(parsed, 'neverInvent'),
          styleWords: list(parsed, 'styleWords'),
          ...(str(parsed, 'techLimits') === '' ? {} : { techLimits: str(parsed, 'techLimits') }),
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


  // Run one trial: the only route in this package that spends money, so it is
  // guarded by the owner token rather than by a session cookie, and it reports
  // cost whether it succeeded or failed.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/run', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const owner = process.env.DSH_WEB_TOKEN ?? ''
      if (owner === '' || String(req.headers['x-one-turn-token'] ?? '') !== owner) {
        respond(res, 401, { error: 'owner token required' }); return
      }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const normalised = normalise({
          goal: str(parsed, 'goal'),
          ...(str(parsed, 'shape') === '' ? {} : { shape: str(parsed, 'shape') }),
          ...(str(parsed, 'audience') === '' ? {} : { audience: str(parsed, 'audience') }),
          mustHave: list(parsed, 'mustHave'),
          nonGoals: list(parsed, 'nonGoals'),
          details: list(parsed, 'details'),
          neverInvent: list(parsed, 'neverInvent'),
          styleWords: list(parsed, 'styleWords'),
          ...(str(parsed, 'techLimits') === '' ? {} : { techLimits: str(parsed, 'techLimits') }),
          ...(str(parsed, 'reference') === '' ? {} : { reference: str(parsed, 'reference') }),
          ...(str(parsed, 'data') === '' ? {} : { data: str(parsed, 'data') }),
          acceptance: list(parsed, 'acceptance'),
        })
        if (!normalised.ok) {
          respond(res, 422, { ok: false, refusal: normalised.refusal, spentUsd: 0 })
          return
        }
        const compiled = compile(normalised.spec)
        const record = await runTrial({
          spec: normalised.spec,
          mask: compiled,
          apiKey: process.env.DEEPSEEK_API_KEY ?? '',
          model: str(parsed, 'model') === '' ? 'deepseek-chat' : str(parsed, 'model'),
          id: str(parsed, 'id') === '' ? `trial-${Date.now()}` : str(parsed, 'id'),
        })
        respond(res, 200, {
          ok: true,
          trial: record,
          audit: maskAudit(compiled),
          trialsRoot: trialsRoot(),
          ceilingUsd: maxTrialUsd(),
        })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // Follow-up questions earned by what was answered so far. The interview is the
  // cheapest part of the system and the one that decides whether the build fails,
  // so it is allowed to ask more — never more than three times.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/probe', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      respond(res, 200, {
        probes: probes({
          goal: url.searchParams.get('goal') ?? '',
          ...(url.searchParams.get('shape') === null ? {} : { shape: url.searchParams.get('shape') ?? '' }),
        }),
      })
    },
  })


  // One question at a time, leading with an opinion. The interview should feel
  // like a colleague who has built this before — because it has, and it remembers.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/next', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const goal = url.searchParams.get('goal') ?? ''
      const shape = url.searchParams.get('shape') ?? undefined
      // `answered` is a comma list of keys already filled in.
      const answered: Record<string, string> = {}
      for (const key of (url.searchParams.get('answered') ?? '').split(',')) {
        if (key.trim() !== '') answered[key.trim()] = 'answered'
      }
      const step = nextStep(answered, { goal, ...(shape === undefined || shape === '' ? {} : { shape }) })
      respond(res, 200, { step })
    },
  })

  // The shelf: what this shape has taught us, and what it is still learning.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/lessons', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const shape = url.searchParams.get('shape')
      respond(res, 200, {
        shape: shape ?? null,
        lessons: shape === null ? readLessons() : lessonsFor(shape),
      })
    },
  })

  // Record a lesson by hand, for the failures a check cannot see (a human saying
  // "no, that is not it" is a lesson too).
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/lesson', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const owner = process.env.DSH_WEB_TOKEN ?? ''
      if (owner === '' || String(req.headers['x-one-turn-token'] ?? '') !== owner) {
        respond(res, 401, { error: 'owner token required' }); return
      }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const shape = str(parsed, 'shape')
        const bucket = str(parsed, 'bucket')
        if (shape === '' || bucket === '') { respond(res, 400, { error: 'shape and bucket are required' }); return }
        recordLesson({ shape, bucket, ...(str(parsed, 'note') === '' ? {} : { note: str(parsed, 'note') }) })
        respond(res, 200, { ok: true, lessons: lessonsFor(shape) })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // What this request could mean. Free, and the fastest way to see whether a
  // request needs one question or can be decided and recorded.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/readings', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const goal = url.searchParams.get('goal') ?? ''
      const shape = url.searchParams.get('shape')
      const list = readings(goal, shape === null || shape === '' ? undefined : shape as never)
      respond(res, 200, {
        ambiguous: isAmbiguous(goal, shape === null || shape === '' ? undefined : shape as never),
        readings: list,
        decision: list[0] === undefined ? '' : `interpretation taken: ${list[0].means}`,
      })
    },
  })

  // The voice: the workshop's own reference points, stored as material.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/voice', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') { respond(res, 200, { voice: readVoice() }); return }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const owner = process.env.DSH_WEB_TOKEN ?? ''
      if (owner === '' || String(req.headers['x-one-turn-token'] ?? '') !== owner) {
        respond(res, 401, { error: 'owner token required' }); return
      }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const base = readVoice()
        const raw = (parsed['voice'] ?? {}) as Record<string, unknown>
        const voice: Voice = {
          name: typeof raw['name'] === 'string' ? raw['name'] : base.name,
          character: typeof raw['character'] === 'string' ? raw['character'] : base.character,
          references: Array.isArray(raw['references'])
            ? raw['references'].filter((item): item is string => typeof item === 'string')
            : base.references,
          enabled: raw['enabled'] !== false,
          neverPrint: Array.isArray(raw['neverPrint'])
            ? raw['neverPrint'].filter((item): item is string => typeof item === 'string')
            : base.neverPrint,
        }
        writeVoice(voice)
        respond(res, 200, { ok: true, voice })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // The Extrapolator, on its own: what would be filled in for this request, and
  // which parts would stay visibly blank. Free, and the fastest way to judge
  // whether a request is ready for a paid build.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/extrapolate', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const goal = url.searchParams.get('goal') ?? ''
      const shapeParam = url.searchParams.get('shape')
      const normalised = normalise({
        goal,
        ...(shapeParam === null || shapeParam === '' ? {} : { shape: shapeParam }),
      })
      if (!normalised.ok) {
        respond(res, 422, { ok: false, refusal: normalised.refusal, spentUsd: 0 })
        return
      }
      const filled = extrapolate({ goal, ...(shapeParam === null ? {} : { shape: shapeParam }) }, normalised.spec.shape)
      respond(res, 200, {
        ok: true,
        shape: normalised.spec.shape,
        filled,
        block: extrapolationBlock(filled),
        marked: filled.filter(item => item.marked).length,
        spentUsd: 0,
      })
    },
  })


  // Storage status: is the learning loop durable, and what has it learned?
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/store', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const stats = await trialStats()
        respond(res, 200, {
          ...stats,
          lessonsInMemory: readLessons().length,
          voiceStored: readVoice().name,
        })
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
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
