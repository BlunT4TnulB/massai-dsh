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
import { currentLibrary, hydrateLibrary } from './library.ts'
import { catalogOf, skillsFor } from './skills.ts'
import { ensureStoreSchema, storeConfigured, trialStats } from './store.ts'
import { listObjects, r2Configured, storageCheck } from './r2.ts'
import {
  adoptProject, createProject, deleteProject, listProjects, projectsConfigured, readProject,
  saveProjectFiles, setProjectStatus, setProjectVisibility, shelf, usageOf,
  type ProjectFile, type ProjectStatus, type ProjectVisibility,
} from './projects.ts'
import { projectsPageHtml } from './projects-page.ts'
import { hydrateVoice, readVoice, writeVoice, type Voice } from './voice.ts'
import { nextStep } from './suggest.ts'
import { normalise, refusalText } from './normalise.ts'
import type { IntakeAnswers } from './spec.ts'

/** Required services: the HTTP server the routes hang off. */
export const inject = ['webServer']


/** Read one cookie value from the request. */
function cookieValue(req: IncomingMessage, name: string): string {
  const raw = String(req.headers.cookie ?? '')
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

/**
 * Who is asking. A guest has an id in a readable cookie; the operator has the
 * owner token. Everyone else has nothing, and gets nothing but the shelf.
 */
function callerOf(req: IncomingMessage): { readonly id: string; readonly owner: boolean } | undefined {
  const ownerToken = process.env.DSH_WEB_TOKEN ?? ''
  if (ownerToken !== '' && String(req.headers['x-one-turn-token'] ?? '') === ownerToken) {
    return { id: 'owner', owner: true }
  }
  const uid = cookieValue(req, 'dsh_uid')
  if (uid !== '') return { id: uid, owner: false }
  return undefined
}

/** Parse a file list from an unknown body field. */
function filesFrom(value: unknown): ProjectFile[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const file = item as { path?: unknown; content?: unknown }
    if (typeof file.path !== 'string' || typeof file.content !== 'string') return []
    const path = file.path.replace(/^\.\//, '')
    if (path === '' || path.startsWith('/') || path.includes('..')) return []
    return [{ path, content: file.content }]
  })
}

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
      const library = await hydrateLibrary()
      process.stderr.write(`one-turn: store ${storeConfigured() ? 'durable' : 'file-only'}, ${lessons} lesson(s), ${library} library project(s)\n`)
      // The shelf changes when someone publishes, so refresh the profile hourly.
      const timer = setInterval(() => { void hydrateLibrary().catch(() => undefined) }, 60 * 60 * 1000)
      if (typeof timer.unref === 'function') timer.unref()
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
        // A successful build is saved immediately when storage is available, so
        // "it worked" and "it is kept" are the same moment.
        let saved: { id: string; name: string } | undefined
        if (record.accepted && projectsConfigured()) {
          try {
            const project = await createProject({
              owner: str(parsed, 'owner') === '' ? 'owner' : str(parsed, 'owner'),
              name: str(parsed, 'name') === '' ? (normalised.spec.goal.slice(0, 60) || 'Untitled build') : str(parsed, 'name'),
              shape: normalised.spec.shape,
              entry: normalised.spec.outputContract.entry,
              files: record.files.map(file => ({ path: file.path, content: file.content })),
              origin: `trial:${record.id}`,
            })
            if (project !== undefined) saved = { id: project.id, name: project.name }
          } catch { /* a save failure must not fail the build */ }
        }
        respond(res, 200, {
          ok: true,
          trial: record,
          audit: maskAudit(compiled),
          trialsRoot: trialsRoot(),
          ceilingUsd: maxTrialUsd(),
          ...(saved === undefined ? {} : { savedProject: saved }),
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
          library: currentLibrary() ?? null,
        })
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // Storage health: write a probe, read it back, delete it. Owner-only because it
  // costs an operation and names the bucket.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/storage', auth: 'anonymous',
    handler: async (req, res) => {
      const owner = process.env.DSH_WEB_TOKEN ?? ''
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const isOwner = owner !== '' && String(req.headers['x-one-turn-token'] ?? '') === owner
      if (req.method === 'GET' && !isOwner) { respond(res, 401, { error: 'owner token required' }); return }
      if (req.method === 'GET') {
        try {
          respond(res, 200, {
            configured: r2Configured(),
            bucket: process.env.R2_BUCKET ?? '',
            keys: r2Configured() ? await listObjects(url.searchParams.get('prefix') ?? '', 20) : [],
          })
        } catch (error) {
          respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
        return
      }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      if (!isOwner) { respond(res, 401, { error: 'owner token required' }); return }
      try {
        respond(res, 200, await storageCheck())
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // Projects: the durable home for the thing a person made.
  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/create', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const caller = callerOf(req)
      if (caller === undefined) { respond(res, 401, { error: 'no session: start a free preview first' }); return }
      try {
        // The operator may import a whole repository; a guest may save a page.
        const parsed = JSON.parse(await readBody(req, caller.owner ? 2_000_000 : 256_000)) as Record<string, unknown>
        const files = filesFrom(parsed['files'])
        if (files.length === 0) { respond(res, 400, { error: 'no files supplied' }); return }
        const project = await createProject({
          // The operator may file an import under their own name; a guest may not.
          owner: caller.owner && str(parsed, 'owner') !== '' ? str(parsed, 'owner') : caller.id,
          name: str(parsed, 'name') === '' ? 'Untitled' : str(parsed, 'name'),
          shape: str(parsed, 'shape') === '' ? 'single-page-site' : str(parsed, 'shape'),
          entry: str(parsed, 'entry') === '' ? (files[0]?.path ?? 'index.html') : str(parsed, 'entry'),
          files,
          ...(str(parsed, 'origin') === '' ? {} : { origin: str(parsed, 'origin') }),
          // A guest may never publish; only the operator can create a shelf item directly.
          ...(caller.owner && str(parsed, 'visibility') === 'shelf' ? { visibility: 'shelf' as ProjectVisibility } : {}),
        })
        if (project === undefined) { respond(res, 503, { error: 'storage is not configured yet' }); return }
        respond(res, 200, { ok: true, project })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/list', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const caller = callerOf(req)
      if (caller === undefined) { respond(res, 200, { projects: [], usage: { projects: 0, bytes: 0 } }); return }
      try {
        respond(res, 200, { projects: await listProjects(caller.id), usage: await usageOf(caller.id) })
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/detail', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const id = url.searchParams.get('id') ?? ''
      if (id === '') { respond(res, 400, { error: 'id is required' }); return }
      try {
        const project = await readProject(id)
        if (project === undefined) { respond(res, 404, { error: 'no such project' }); return }
        const caller = callerOf(req)
        const mine = caller !== undefined && (caller.id === project.owner || caller.owner)
        // Someone else's project is readable only when it was deliberately published.
        // Status alone is not enough: an imported repository is not a shelf item.
        if (!mine && project.visibility !== 'shelf') {
          respond(res, 403, { error: 'this project is private' }); return
        }
        respond(res, 200, { ok: true, project, mine })
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/save', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const caller = callerOf(req)
      if (caller === undefined) { respond(res, 401, { error: 'no session' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      try {
        const parsed = JSON.parse(await readBody(req, caller.owner ? 2_000_000 : 256_000)) as Record<string, unknown>
        const project = await saveProjectFiles(
          url.searchParams.get('id') ?? str(parsed, 'id'), caller.id, filesFrom(parsed['files']))
        if (project === undefined) { respond(res, 404, { error: 'not found, or not yours' }); return }
        respond(res, 200, { ok: true, project })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/status', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const caller = callerOf(req)
      if (caller === undefined) { respond(res, 401, { error: 'no session' }); return }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const id = str(parsed, 'id')
        const status = str(parsed, 'status') as ProjectStatus
        const allowed: readonly ProjectStatus[] = ['active', 'paused', 'adoptable', 'deleted']
        if (!allowed.includes(status)) { respond(res, 400, { error: 'unknown status' }); return }
        const ok = status === 'deleted'
          ? await deleteProject(id, caller.id)
          : await setProjectStatus(id, caller.id, status)
        respond(res, ok ? 200 : 404, ok ? { ok: true, status } : { error: 'not found, or not yours' })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/shelf', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        respond(res, 200, { projects: await shelf(), configured: projectsConfigured() })
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/adopt', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const caller = callerOf(req)
      if (caller === undefined) { respond(res, 401, { error: 'no session' }); return }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const project = await adoptProject(str(parsed, 'id'), caller.id)
        respond(res, project === undefined ? 404 : 200,
          project === undefined ? { error: 'not adoptable' } : { ok: true, project })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // Publishing is deliberate and reversible. Nothing arrives on the public shelf by
  // accident — imported code starts private, and only this route changes that.
  ctx.webServer.register({
    kind: 'exact', path: '/api/projects/publish', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const caller = callerOf(req)
      if (caller === undefined) { respond(res, 401, { error: 'no session' }); return }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const visibility = str(parsed, 'visibility') === 'shelf' ? 'shelf' : 'private'
        const ok = await setProjectVisibility(str(parsed, 'id'), caller.id, visibility)
        respond(res, ok ? 200 : 404, ok ? { ok: true, visibility } : { error: 'not found, or not yours' })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // The page: the same data as the API, rendered so a person can actually see it.
  ctx.webServer.register({
    kind: 'exact', path: '/projects', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(projectsPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })


  // /library is the community shelf, presented as the library it is. Same data,
  // one predictable address to share.
  ctx.webServer.register({
    kind: 'exact', path: '/library', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(projectsPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })


  // The skill catalog: what the workshop has demonstrably built, and what a given
  // request would reach for. Free — it is the context the mask gets before a call.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/skills', auth: 'anonymous',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { respond(res, 405, { error: 'method not allowed' }); return }
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const goal = url.searchParams.get('goal') ?? ''
      const shape = url.searchParams.get('shape') ?? ''
      const catalog = catalogOf()
      respond(res, 200, {
        catalog,
        matched: goal === '' ? [] : skillsFor(goal, shape),
        count: catalog.length,
      })
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
