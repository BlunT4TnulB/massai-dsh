/**
 * Hosted-link concierge sign-in: one HTTP route that stores a visitor's DeepSeek
 * API key under a fresh per-session user id and mints their browser session,
 * so every later request from that session resolves their own key
 * (see dsh-user-credentials + deepseek-auth per-user).
 *
 * @module @deepseek-ai/dsh-hosted-signin
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { logoPreviewHtml } from './logo-preview.ts'
import { adminPageHtml } from './admin-page.ts'
import { guidePageHtml } from './guide.ts'
import { localGuidePageHtml } from './local-guide.ts'
import { listWorkers, recordWorker, workerTokenAccepted, workersPageHtml } from './workers.ts'
import { modelsPageHtml, ratesPageHtml, usagePageHtml } from './usage-page.ts'
import { frontendApiOf, verifyClerkSession } from './clerk.ts'
import { loginPreviewHtml } from './login-preview.ts'
import { startPageHtml } from './start-page.ts'
import { feedbackPageHtml, recentNotes, recentPageHtml, saveNote, thanksPageHtml } from './feedback.ts'

export const name = 'hosted-signin'
export const inject = ['credentials', 'webServer', 'browserAuth']

const SCOPE = 'massai-user'
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const
const MARK_PATH = '/massai-mark.jpg'
const CREST_PATH = '/massai-crest.svg'

/**
 * Read one brand asset beside the built package. Served anonymously because
 * the concierge page that shows it precedes sign-in.
 */
function brandAsset(file: string, fallbackType: string): { body: Buffer; type: string } | undefined {
  try {
    return { body: readFileSync(new URL(`../assets/${file}`, import.meta.url)), type: fallbackType }
  } catch {
    return undefined
  }
}

/** The session minter the authentication-token plugin exposes. */
interface SessionMinter {
  mintSession(req: IncomingMessage, res: ServerResponse, secure: boolean, userId: string, location?: string): void
}

/** Read + parse a small request body (JSON or URL-encoded form). */
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

/** Read a body into a field map (URL-encoded form or JSON object). */
async function readFields(req: IncomingMessage): Promise<Map<string, string>> {
  const text = await readBody(req)
  const fields = new Map<string, string>()
  const contentType = req.headers['content-type'] ?? ''
  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(text === '' ? '{}' : text) as Record<string, unknown>
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') fields.set(key, value)
    }
    return fields
  }
  for (const [key, value] of new URLSearchParams(text)) fields.set(key, value)
  return fields
}

/** Extract the apiKey from a JSON or form-encoded body. */
function apiKeyOf(text: string, contentType: string | undefined): string {
  if (text.trim() === '') return ''
  if (contentType?.includes('application/json') === true) {
    const parsed = JSON.parse(text) as Record<string, unknown>
    return typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : ''
  }
  return (new URLSearchParams(text).get('apiKey') ?? '').trim()
}

function respond(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(payload))
}

export function apply(ctx: Context): void {
  // Anonymous brand assets for the concierge page (see the webserver's welcome HTML).
  for (const [path, file, type] of [
    [MARK_PATH, 'massai-mark.jpg', 'image/jpeg'],
    [CREST_PATH, 'massai-crest.svg', 'image/svg+xml'],
    ['/favicon-16.png', 'icons/favicon-16.png', 'image/png'],
    ['/favicon-32.png', 'icons/favicon-32.png', 'image/png'],
    ['/favicon-48.png', 'icons/favicon-48.png', 'image/png'],
    ['/apple-touch-icon.png', 'icons/massai-180.png', 'image/png'],
    ['/icon-192.png', 'icons/massai-192.png', 'image/png'],
    ['/icon-512.png', 'icons/massai-512.png', 'image/png'],
    ['/og-image.png', 'icons/og-image.png', 'image/png'],
  ] as const) {
    ctx.webServer.register({
      kind: 'exact', path, auth: 'anonymous',
      handler: (req, res) => {
        const asset = brandAsset(file, type)
        if (asset === undefined) { res.writeHead(404); res.end(); return }
        res.writeHead(200, {
          'content-type': asset.type,
          'content-length': String(asset.body.byteLength),
          'cache-control': 'public, max-age=86400',
        })
        res.end(req.method === 'HEAD' ? undefined : asset.body)
      },
    })
  }
  // Clerk session exchange: the browser hands us its Clerk JWT, we verify it
  // against the instance JWKS and mint our own session keyed to the Clerk user.
  ctx.webServer.register({
    kind: 'exact', path: '/api/clerk/signin', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const host = frontendApiOf(process.env.CLERK_PUBLISHABLE_KEY)
      if (host === undefined) { respond(res, 501, { error: 'clerk is not configured' }); return }
      try {
        const fields = await readFields(req)
        const token = (fields.get('token') ?? '').trim()
        if (token === '') { respond(res, 400, { error: 'token is required' }); return }
        const session = await verifyClerkSession(token, host)
        if (session === undefined) { respond(res, 401, { error: 'invalid session token' }); return }
        const minter = ctx.get('browserAuth') as
          { mintSessionCookie(req: IncomingMessage, res: ServerResponse, secure: boolean, userId: string): boolean } | undefined
        if (minter === undefined) { respond(res, 503, { error: 'session service unavailable' }); return }
        const userId = `c-${session.userId}`
        if (!minter.mintSessionCookie(req, res, ctx.webServer.protocol === 'https:', userId)) {
          respond(res, 400, { error: 'missing Host authority' }); return
        }
        respond(res, 200, { ok: true, userId })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  // Clerk Frontend API proxy: lets Clerk's cookies live on this origin. Needs the
  // instance secret key; without it the route reports that it is unconfigured.
  ctx.webServer.register({
    kind: 'prefix', path: '/api/__clerk', auth: 'anonymous',
    handler: async (req, res) => {
      const host = frontendApiOf(process.env.CLERK_PUBLISHABLE_KEY)
      const secret = process.env.CLERK_SECRET_KEY
      if (host === undefined || secret === undefined || secret === '') {
        respond(res, 501, { error: 'clerk proxy is not configured' })
        return
      }
      try {
        const url = new URL(req.url ?? '/', `https://${host}`)
        const target = `https://${host}${url.pathname.replace(/^\/api\/__clerk/, '')}${url.search}`
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (value === undefined) continue
          if (['host', 'content-length', 'connection', 'accept-encoding'].includes(name)) continue
          headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        headers.set('Clerk-Proxy-Url', `https://${req.headers.host ?? 'localhost'}/api/__clerk`)
        headers.set('Clerk-Secret-Key', secret)
        const upstream = await fetch(target, {
          method: req.method ?? 'GET',
          headers,
          ...chunks.length === 0 ? {} : { body: Buffer.concat(chunks) },
        })
        const body = Buffer.from(await upstream.arrayBuffer())
        const out: Record<string, string> = {}
        upstream.headers.forEach((value, name) => {
          if (['content-encoding', 'transfer-encoding', 'connection', 'keep-alive', 'content-length'].includes(name)) return
          out[name] = value
        })
        const cookies = upstream.headers.getSetCookie?.() ?? []
        res.writeHead(upstream.status, {
          ...out,
          'content-length': String(body.byteLength),
          ...cookies.length === 0 ? {} : { 'set-cookie': cookies },
        })
        res.end(req.method === 'HEAD' ? undefined : body)
      } catch (error) {
        respond(res, 502, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  // Measured usage timeline and the rate card.
  for (const [path, render] of [
    ['/usage', usagePageHtml],
    ['/rates', ratesPageHtml],
    ['/models', modelsPageHtml],
  ] as const) {
    ctx.webServer.register({
      kind: 'exact', path, auth: path === '/rates' ? 'anonymous' : 'required',
      handler: (req, res) => {
        const html = Buffer.from(render())
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': String(html.byteLength),
          'cache-control': 'no-store',
        })
        res.end(req.method === 'HEAD' ? undefined : html)
      },
    })
  }
  // Owner console: presence-only status, notes wall, session census, quick links.
  ctx.webServer.register({
    kind: 'exact', path: '/admin', auth: 'required',
    handler: (req, res) => {
      const html = Buffer.from(adminPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Local agents: machines report in here so they appear inside Massai.
  ctx.webServer.register({
    kind: 'exact', path: '/api/workers/heartbeat', auth: 'anonymous',
    handler: async (req, res) => {
      // Answer 404 unless the shared token matches: a scanner cannot learn the
      // route exists, and a missing configuration looks like a plain miss.
      const token = typeof req.headers['x-worker-token'] === 'string' ? req.headers['x-worker-token'] : undefined
      if (!workerTokenAccepted(token)) { respond(res, 404, { error: 'not found' }); return }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const fields = await readFields(req)
        const name = (fields.get('name') ?? '').trim().slice(0, 80)
        const model = (fields.get('model') ?? '').trim().slice(0, 80)
        if (name === '' || model === '') { respond(res, 400, { error: 'name and model are required' }); return }
        const latency = Number(fields.get('latencyMs') ?? '')
        recordWorker({
          name,
          model,
          endpoint: (fields.get('endpoint') ?? '').trim().slice(0, 200),
          ...(Number.isFinite(latency) && latency > 0 ? { latencyMs: latency } : {}),
          ...(fields.get('note') === null || (fields.get('note') ?? '') === '' ? {} : { note: (fields.get('note') ?? '').slice(0, 200) }),
          ...(fields.get('served') === null ? {} : { served: Number(fields.get('served') ?? 0) }),
        })
        respond(res, 200, { ok: true, workers: listWorkers().length })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  // The owner's view of every machine that has reported in.
  ctx.webServer.register({
    kind: 'exact', path: '/workers', auth: 'required',
    handler: (req, res) => {
      const html = Buffer.from(workersPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // The local-models guide: hardware, scenarios, and a live savings calculator.
  ctx.webServer.register({
    kind: 'exact', path: '/local', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(localGuidePageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // The public plain-language guide: no account, no key, no repo needed.
  ctx.webServer.register({
    kind: 'exact', path: '/guide', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(guidePageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Sign-in card preview: the Clerk layout in our tokens, before Clerk is wired.
  ctx.webServer.register({
    kind: 'exact', path: '/login-preview', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(loginPreviewHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Visitor notes: anyone can leave one; the owner reads them semi-live.
  ctx.webServer.register({
    kind: 'exact', path: '/feedback', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(feedbackPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  ctx.webServer.register({
    kind: 'exact', path: '/api/feedback', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const fields = await readFields(req)
        const text = (fields.get('text') ?? '').trim().slice(0, 1000)
        if (text === '') { respond(res, 400, { error: 'text is required' }); return }
        const email = (fields.get('email') ?? '').trim().slice(0, 200)
        saveNote({ at: new Date().toISOString(), text, ...email === '' ? {} : { email } })
        const html = Buffer.from(thanksPageHtml())
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(html.byteLength), 'cache-control': 'no-store' })
        res.end(html)
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  // Owner export: pull the notes wall off before a redeploy (JSONL, one note per line).
  ctx.webServer.register({
    kind: 'exact', path: '/feedback/export.jsonl', auth: 'required',
    handler: (req, res) => {
      const body = Buffer.from(recentNotes(500).slice().reverse().map(note => `${JSON.stringify(note)}\n`).join(''))
      res.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'content-length': String(body.byteLength),
        'content-disposition': 'attachment; filename="massai-notes.jsonl"',
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  })
  ctx.webServer.register({
    kind: 'exact', path: '/feedback/recent', auth: 'required',
    handler: (req, res) => {
      const html = Buffer.from(recentPageHtml(recentNotes(50)))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(html.byteLength), 'cache-control': 'no-store' })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Guided first step after sign-in: four cards, no vocabulary required.
  ctx.webServer.register({
    kind: 'exact', path: '/start', auth: 'required',
    handler: (req, res) => {
      const html = Buffer.from(startPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Owner-facing concept sheet for the Massai mark (anonymous, opt-in by URL).
  ctx.webServer.register({
    kind: 'exact', path: '/logo-preview', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(logoPreviewHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  ctx.webServer.register({
    kind: 'exact', path: '/api/signin', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const text = await readBody(req)
        const apiKey = apiKeyOf(text, req.headers['content-type'])
        if (apiKey === '') { respond(res, 400, { error: 'apiKey is required' }); return }
        // The credential key's segment must start with a letter; prefix the uuid.
        const userId = `u-${randomUUID()}`
        await ctx.credentials.modifyRecord(credentialKey(SCOPE, userId), async () => ({ kind: 'api-key', key: apiKey }))
        const minter = ctx.get('browserAuth') as SessionMinter | undefined
        if (minter === undefined) { respond(res, 503, { error: 'session service unavailable' }); return }
        minter.mintSession(req, res, ctx.webServer.protocol === 'https:', userId, './start')
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
