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
import { accessPageHtml, mapPageHtml } from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { logoPreviewHtml } from './logo-preview.ts'
import { adminPageHtml } from './admin-page.ts'
import { guidePageHtml } from './guide.ts'
import { localGuidePageHtml } from './local-guide.ts'
import { appendImported, IMPORTED_PROJECT, importPageHtml } from './import-page.ts'
import {
  countryForUser, countryHeaderOf, countryOf, freeGeminiAllowed, REGION_GATED_PROVIDERS, rememberCountry,
} from './geo.ts'
import { applyKoFiEvent, parseKoFiBody } from './kofi.ts'
import { aupPageHtml, privacyPageHtml, supportPageHtml, termsPageHtml } from './legal.ts'
import { deepSeekBalance, lowBalanceUsd, publishBalance, refreshBalance } from './billing.ts'
import { comfortCookie, comfortFromCookie, comfortPageHtml, isMaster, preset, type ComfortTier } from './comfort.ts'
import { agentsOf, classifyToolCall, countsOf, focusOf, readActivity, recordActivity, trailOf } from './activity.ts'
import { flowerPageHtml } from './flower-page.ts'
import { limitsPageHtml } from './limits-page.ts'
import { mePageHtml } from './me-page.ts'
import { providersPageHtml } from './providers-page.ts'
import { forgetRecord, memoryPageHtml } from './memory-page.ts'
import { listWorkers, recordWorker, workerTokenAccepted, workersPageHtml } from './workers.ts'
import { complete, enqueue, nextJob, relayStatus, workerConnected } from './worker-relay.ts'
import {
  creditLedger, creditTotal, databaseConfigured, databaseStatus, ensureSchema, eraseUserData, grantCredit, guestCounters, readUsageRows, recordUsage,
} from './persistence.ts'
import { admitGuestSession, guestKeyOf } from './abuse.ts'
import { budgetReport, checkBudget } from './budget.ts'
import { costOf, readUsage } from './usage.ts'
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


/** The worker token from `x-worker-token` or a standard `Authorization: Bearer`. */
function workerTokenOf(req: IncomingMessage): string | undefined {
  const direct = req.headers['x-worker-token']
  if (typeof direct === 'string') return direct
  const authorization = req.headers.authorization
  if (typeof authorization !== 'string') return undefined
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return match?.[1]
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
    ['/massai-badge.svg', 'massai-badge.svg', 'image/svg+xml'],
    ['/massai-face.svg', 'massai-face.svg', 'image/svg+xml'],
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
    handler: async (req, res) => {
      const spend = await budgetReport().catch(() => undefined)
      const guests = await guestCounters().catch(() => [])
      const credits = await creditLedger().catch(() => [])
      // Visiting the console refreshes the gauge; the interval below keeps it warm.
      const fuel = await refreshBalance(process.env.DEEPSEEK_API_KEY ?? '').catch(() => undefined)
      const html = Buffer.from(adminPageHtml(spend, guests, credits, fuel === undefined
        ? undefined
        : {
            available: fuel.available, usd: fuel.usd, currency: fuel.currency,
            low: lowBalanceUsd(), at: fuel.at,
            ...(fuel.error === undefined ? {} : { error: fuel.error }),
          }))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Relay: the worker polls for work here (long-poll, so it passes NAT).
  ctx.webServer.register({
    kind: 'exact', path: '/api/workers/next', auth: 'anonymous',
    handler: async (req, res) => {
      const token = workerTokenOf(req)
      if (!workerTokenAccepted(token)) { respond(res, 404, { error: 'not found' }); return }
      const workerName = typeof req.headers['x-worker-name'] === 'string' ? req.headers['x-worker-name'] : ''
      const job = await nextJob(workerName)
      if (job === undefined) { res.writeHead(204, { 'cache-control': 'no-store' }); res.end(); return }
      respond(res, 200, { id: job.id, body: job.body })
    },
  })
  // Relay: the worker posts its answer here.
  ctx.webServer.register({
    kind: 'exact', path: '/api/workers/answer', auth: 'anonymous',
    handler: async (req, res) => {
      const token = workerTokenOf(req)
      if (!workerTokenAccepted(token)) { respond(res, 404, { error: 'not found' }); return }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const raw = await readBody(req)
        const payload = JSON.parse(raw === '' ? '{}' : raw) as { id?: unknown; error?: unknown; body?: unknown; worker?: unknown }
        const id = typeof payload.id === 'string' ? payload.id : ''
        const error = typeof payload.error === 'string' ? payload.error : undefined
        if (id === '') { respond(res, 400, { error: 'id is required' }); return }
        const delivered = error !== undefined && error !== ''
          ? complete(id, { ok: false, error }, typeof payload.worker === 'string' ? payload.worker : '')
          : complete(id, { ok: true, body: payload.body ?? {} }, typeof payload.worker === 'string' ? payload.worker : '')
        respond(res, delivered ? 200 : 409, { ok: delivered, relay: relayStatus() })
      } catch (admissionError) {
        respond(res, 400, { error: admissionError instanceof Error ? admissionError.message : String(admissionError) })
      }
    },
  })
  // Relay: an OpenAI-compatible endpoint answered by whichever worker is connected.
  ctx.webServer.register({
    kind: 'exact', path: '/api/local/v1/chat/completions', auth: 'anonymous',
    handler: async (req, res) => {
      const token = workerTokenOf(req)
      if (!workerTokenAccepted(token)) { respond(res, 404, { error: 'not found' }); return }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      if (!workerConnected()) {
        respond(res, 503, { error: 'no local worker is connected right now' })
        return
      }
      try {
        const raw = await readBody(req)
        const parsed: unknown = raw === '' ? {} : JSON.parse(raw)
        // `model` is either "auto" (any machine) or a machine name — so a client
        // can ask for the big GPU by name.
        const requested = (parsed as { model?: unknown }).model
        const target = typeof requested === 'string' && requested !== 'auto' ? requested : undefined
        const answer = await enqueue(parsed, target)
        respond(res, 200, answer)
      } catch (relayError) {
        respond(res, 503, { error: relayError instanceof Error ? relayError.message : String(relayError) })
      }
    },
  })
  // What the agent has learned, in the open.
  ctx.webServer.register({
    kind: 'exact', path: '/memory', auth: 'required',
    handler: (req, res) => {
      const html = Buffer.from(memoryPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })

  // Durable usage: the container's disk is wiped on every deploy, so each
  // measured call is also written to the database when one is configured.
  if (databaseConfigured()) {
    void ensureSchema().catch(() => { /* reported by /api/db/status */ })
  }
  // `session/event` is a real harness hook; typed through a narrow cast so this
  // package does not have to import the agent type graph (which drags the
  // attachment packages into its tsconfig project).
  const onSessionEvent = ctx.on.bind(ctx) as unknown as (
    name: string,
    handler: (session: { id: string }, event: unknown) => void,
  ) => void
  onSessionEvent('session/event', (session, event) => {
    // Live activity: a tool call is the honest unit of "the agent is doing X".
    // Classification looks only at the tool name and argument text, never content.
    const typed = event as { type?: string; data?: { name?: string; arguments?: unknown } }
    if (typed.type === 'tool/call') {
      const name = String(typed.data?.name ?? '')
      const rawArguments = typeof typed.data?.arguments === 'string'
        ? typed.data.arguments
        : JSON.stringify(typed.data?.arguments ?? {})
      classifyToolCall(name, rawArguments, String(session.id))
    }
    if (!databaseConfigured()) return
    const data = (event as { data?: { usage?: Record<string, number>; message?: { source?: { model?: string } }; model?: string } }).data
    const usage = data?.usage
    if (usage === undefined) return
    void recordUsage({
      at: Number((event as { time?: number }).time ?? Date.now()),
      session: String(session.id),
      userId: String((session as { header?: { userId?: string } }).header?.userId ?? ''),
      model: data?.message?.source?.model ?? data?.model ?? 'unknown',
      input: Number(usage.inputTokens ?? 0),
      output: Number(usage.outputTokens ?? 0),
      cacheRead: Number(usage.cacheReadTokens ?? 0),
      cacheWrite: Number(usage.cacheWriteTokens ?? 0),
    }).catch(() => { /* reported by /api/db/status */ })
  })


  // The money gate. Runs before the step so an over-budget call never reaches
  // the provider. One courtesy turn explains it, then the step is refused.
  const onPreStep = ctx.on.bind(ctx) as unknown as (
    name: string,
    handler: (
      payload: {
        agent: { session: { header?: { userId?: string } } }
        modelSelection?: { provider?: string }
      },
      next: () => Promise<unknown>,
    ) => Promise<unknown>,
  ) => void
  const explained = new Set<string>()
  onPreStep('agent/pre-step', async ({ agent, ...rest }, next) => {
    if (!databaseConfigured()) return next()
    const userId = String(agent.session.header?.userId ?? '')
    const verdict = await checkBudget(userId).catch(() => ({ allowed: true } as const))
    if (verdict.allowed) return next()
    const key = userId === '' ? '(unattributed)' : userId
    if (!explained.has(key)) {
      explained.add(key)
      const notice = {
        role: 'user' as const,
        source: { kind: 'user' as const },
        content: [{ type: 'text' as const, text: `[budget note — not the user speaking] ${verdict.reason} `
          + 'Reply in at most two short sentences with that, and do not attempt the request.' }],
      }
      return { kind: 'enter', messages: [...((rest as { messages?: unknown[] }).messages ?? []), notice] }
    }
    return { kind: 'reject' }
  })


  // Credit ledger: a tip becomes somebody's allowance, as a thank-you. Owner-only, because it
  // is money. Positive to top up, negative to correct.
  ctx.webServer.register({
    kind: 'exact', path: '/api/credits/grant', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const fields = await readFields(req)
        const userId = (fields.get('userId') ?? '').trim()
        const usd = Number(fields.get('usd') ?? '0')
        const note = (fields.get('note') ?? 'manual').slice(0, 120)
        if (userId === '' || !Number.isFinite(usd) || usd === 0) {
          respond(res, 400, { error: 'userId and a non-zero usd are required' }); return
        }
        const balance = await grantCredit(userId, usd, note)
        const wantsJson = String(req.headers.accept ?? '').includes('application/json')
        if (wantsJson) { respond(res, 200, { ok: true, userId, balance }); return }
        res.writeHead(303, { location: '/admin', 'cache-control': 'no-store' })
        res.end()
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // One switch to stop new guests without a deploy: for when a link goes further
  // than expected and the ledger needs a breath.
  ctx.webServer.register({
    kind: 'exact', path: '/api/guest/freeze', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const fields = await readFields(req)
      const on = (fields.get('on') ?? '1') !== '0'
      process.env.DSH_GUEST_FROZEN = on ? '1' : ''
      const wantsJson = String(req.headers.accept ?? '').includes('application/json')
      if (wantsJson) { respond(res, 200, { ok: true, frozen: on }); return }
      res.writeHead(303, { location: '/admin', 'cache-control': 'no-store' })
      res.end()
    },
  })


  // The pages the provider's terms require us to have: AI disclosure, privacy,
  // acceptable use — plus the erasure route that makes the privacy one true.
  for (const [path, html] of [
    ['/terms', termsPageHtml()],
    ['/privacy', privacyPageHtml()],
    ['/aup', aupPageHtml()],
    ['/support', supportPageHtml(process.env.KO_FI_URL ?? '')],
  ] as Array<[string, string]>) {
    ctx.webServer.register({
      kind: 'exact', path, auth: 'anonymous',
      handler: (req, res) => {
        const body = Buffer.from(html)
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': String(body.byteLength),
          'cache-control': 'public, max-age=600',
        })
        res.end(req.method === 'HEAD' ? undefined : body)
      },
    })
  }

  // /limits is rendered per visitor so the comfort choice applies: a person who
  // asked for no tips does not get a tips section.
  ctx.webServer.register({
    kind: 'exact', path: '/limits', auth: 'anonymous',
    handler: (req, res) => {
      const comfort = comfortFromCookie(String(req.headers.cookie ?? ''))
      const body = Buffer.from(limitsPageHtml(comfort.tips))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(body.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  })

  // Right to erasure: wipes this account's usage ledger, credit and counters.
  // Projects and files follow when project storage lands.
  ctx.webServer.register({
    kind: 'exact', path: '/api/account/erase', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const fields = await readFields(req)
      const userId = (fields.get('userId') ?? '').trim()
      const confirm = (fields.get('confirm') ?? '').trim()
      if (userId === '' || confirm !== 'erase') {
        respond(res, 400, { error: 'userId and confirm=erase are required' }); return
      }
      try {
        const wiped = await eraseUserData(userId)
        const wantsJson = String(req.headers.accept ?? '').includes('application/json')
        if (wantsJson) { respond(res, 200, { ok: true, ...wiped }); return }
        res.writeHead(303, { location: '/admin', 'cache-control': 'no-store' })
        res.end()
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // Ko-fi webhook: a tip becomes an allowance with nobody typing anything.
  // Ko-fi can only authenticate with the verification token in the payload, so
  // that is checked before a dollar is credited; anything unmatched lands under
  // `unmatched:<tx>` for the owner to assign in the console.
  ctx.webServer.register({
    kind: 'exact', path: '/api/kofi/webhook', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const raw = await readBody(req)
        const event = parseKoFiBody(raw, String(req.headers['content-type'] ?? ''))
        if (event === undefined) { respond(res, 400, { error: 'unparseable body' }); return }
        const outcome = await applyKoFiEvent(event)
        respond(res, outcome.accepted ? 200 : 401, outcome)
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // What a supporter needs in order to be credited: their id, their spend, their
  // credit. `?userId=` is a UUID-shaped key, and only aggregates are returned.
  ctx.webServer.register({
    kind: 'exact', path: '/api/me', auth: 'anonymous',
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'https://placeholder')
      const userId = (url.searchParams.get('userId') ?? '').trim()
      if (!/^(guest-[0-9a-f-]{8,}|email:.+|user_[A-Za-z0-9]+)$/.test(userId)) {
        respond(res, 400, { error: 'a valid userId is required' }); return
      }
      try {
        const report = await budgetReport()
        const mine = report.users.find(user => user.userId === userId)
        respond(res, 200, {
          userId,
          month: report.month,
          spentUsd: Number((mine?.cost ?? 0).toFixed(4)),
          calls: mine?.calls ?? 0,
          creditUsd: Number((await creditTotal(userId)).toFixed(2)),
          allowanceUsd: report.userCap,
        })
      } catch (error) {
        respond(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })


  // Regional gate for free-tier providers. Runs before the step decides anything
  // else, and switches rather than rejects: a visitor in the EEA still gets a
  // workshop, just not the one provider whose terms forbid the free tier there.
  onPreStep('agent/pre-step', async ({ agent, modelSelection }, next) => {
    const userId = String(agent.session.header?.userId ?? '')
    const country = countryForUser(userId)
    if (country === '' || freeGeminiAllowed(country)) return next()
    const provider = modelSelection?.provider ?? ''
    if (!REGION_GATED_PROVIDERS.has(provider)) return next()
    try {
      await (agent as unknown as {
        model: { select: (selection: { provider: string; model: string }) => Promise<unknown> }
      }).model.select({ provider: 'deepseek-official', model: 'deepseek-flash' })
    } catch { /* if the switch fails, the step proceeds on the original route */ }
    return next()
  })


  // A one-line answer to "is the proxy actually telling us where the visitor is?".
  // It echoes the visitor's own country and nothing else — no address, no hash.
  ctx.webServer.register({
    kind: 'exact', path: '/api/geo', auth: 'anonymous',
    handler: (req, res) => {
      const country = countryOf(req)
      respond(res, 200, {
        country: country === '' ? null : country,
        source: country === '' ? 'no proxy header' : `${countryHeaderOf(req)} header`,
        freeGemini: freeGeminiAllowed(country),
        strict: (process.env.DSH_GEO_STRICT ?? '') === '1',
      })
    },
  })


  // The personal page: your id (needed for a tip to reach you), your spend, your
  // credit. Client-side, because the id lives in a readable cookie.
  ctx.webServer.register({
    kind: 'exact', path: '/me', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(mePageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })

  // Crawlers: the public pages only. Signed-in areas are excluded.
  ctx.webServer.register({
    kind: 'exact', path: '/robots.txt', auth: 'anonymous',
    handler: (req, res) => {
      const origin = (process.env.PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '')
      const body = Buffer.from([
        'User-agent: *',
        'Allow: /$',
        'Allow: /limits',
        'Allow: /support',
        'Allow: /terms',
        'Allow: /privacy',
        'Allow: /aup',
        'Allow: /providers',
        'Allow: /local',
        'Allow: /guide',
        'Allow: /models',
        'Allow: /rates',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /memory',
        'Disallow: /me',
        '',
      ].join('\n'))
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': String(body.byteLength) })
      res.end(req.method === 'HEAD' ? undefined : body)
      void origin
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: '/sitemap.xml', auth: 'anonymous',
    handler: (req, res) => {
      const origin = ((process.env.PUBLIC_ORIGIN ?? 'https://massai-dsh.onrender.com').trim().replace(/\/+$/, ''))
      const paths = ['/', '/limits', '/support', '/guide', '/local', '/providers', '/models', '/rates', '/terms', '/privacy', '/aup']
      const body = Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + paths.map(p => `  <url><loc>${origin}${p}</loc></url>`).join('\n')
        + '\n</urlset>\n')
      res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', 'content-length': String(body.byteLength) })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  })


  // Refresh the balance every ten minutes and publish it for the door. A door
  // that knows the tank is empty can say so instead of letting people walk into
  // a failure they cannot explain.
  const balanceTimer = setInterval(() => {
    void refreshBalance(process.env.DEEPSEEK_API_KEY ?? '').catch(() => undefined)
  }, 10 * 60 * 1000)
  // `dispose` is a lifecycle event that the narrow Events map in this package's
  // type graph does not declare, so the listener registers through a cast rather
  // than dragging the whole agent package in (same reason as the session hooks).
  const onDispose = ctx.on.bind(ctx) as unknown as (event: 'dispose', listener: () => void) => () => void
  onDispose('dispose', () => { clearInterval(balanceTimer) })
  void deepSeekBalance(process.env.DEEPSEEK_API_KEY ?? '')
    .then(reading => publishBalance(reading))
    .catch(() => undefined)




  // The immersive flower: the mark as a place you can turn, zoom and click through.
  ctx.webServer.register({
    kind: 'exact', path: '/flower', auth: 'anonymous',
    handler: (req, res) => {
      const comfort = comfortFromCookie(String(req.headers.cookie ?? ''))
      const html = Buffer.from(flowerPageHtml(isMaster(comfort)))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })


  // The live view: what the workshop is doing, for the flower to turn toward.
  // Coarse by design — a capability and a few words, nothing about the content.
  ctx.webServer.register({
    kind: 'exact', path: '/api/one-turn/activity', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        const now = Date.now()
        respond(res, 200, {
          focus: focusOf(now) ?? null,
          events: readActivity(now),
          trail: trailOf(now),
          counts: countsOf(now),
          agents: agentsOf(now),
          windowMinutes: 10,
        })
        return
      }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      const owner = process.env.DSH_WEB_TOKEN ?? ''
      if (owner === '' || String(req.headers['x-one-turn-token'] ?? '') !== owner) {
        respond(res, 401, { error: 'owner token required' }); return
      }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const skill = String(parsed['skill'] ?? 'general')
        recordActivity(skill, String(parsed['label'] ?? skill))
        respond(res, 200, { ok: true, focus: focusOf() ?? null })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // The map: the seven destinations, drawn as the flower of life. Server rendered
  // because navigation must not depend on a script arriving.
  ctx.webServer.register({
    kind: 'exact', path: '/map', auth: 'anonymous',
    handler: (req, res) => {
      const comfort = comfortFromCookie(String(req.headers.cookie ?? ''))
      const html = Buffer.from(mapPageHtml(isMaster(comfort)))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })

  // How much help is on screen. One cookie, no account, changeable from any page.
  ctx.webServer.register({
    kind: 'exact', path: '/api/comfort', auth: 'anonymous',
    handler: async (req, res) => {
      const current = comfortFromCookie(String(req.headers.cookie ?? ''))
      if (req.method === 'GET' || req.method === 'HEAD') {
        respond(res, 200, { comfort: current })
        return
      }
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>
        const tierRaw = parsed['tier']
        const base = typeof tierRaw === 'string' && (tierRaw === 'guided' || tierRaw === 'practised' || tierRaw === 'master')
          ? preset(tierRaw as ComfortTier)
          : current
        // Only the boolean switches can come from the client; the tier is handled above.
        const bool = (key: 'disclaimers' | 'tips' | 'legal' | 'examples' | 'hints' | 'badges'): boolean =>
          typeof parsed[key] === 'boolean' ? parsed[key] as boolean : base[key]
        const comfort = {
          tier: base.tier,
          disclaimers: bool('disclaimers'),
          tips: bool('tips'),
          legal: bool('legal'),
          examples: bool('examples'),
          hints: bool('hints'),
          badges: bool('badges'),
        }
        res.setHeader('set-cookie', comfortCookie(comfort))
        respond(res, 200, { ok: true, comfort })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // The page behind the switches.
  ctx.webServer.register({
    kind: 'exact', path: '/settings', auth: 'anonymous',
    handler: (req, res) => {
      const comfort = comfortFromCookie(String(req.headers.cookie ?? ''))
      const html = Buffer.from(comfortPageHtml(comfort))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })


  // /limits honours the comfort choice: people who asked for no tips get none.
  ctx.webServer.register({
    kind: 'exact', path: '/api/limits/render', auth: 'anonymous',
    handler: (req, res) => {
      const comfort = comfortFromCookie(String(req.headers.cookie ?? ''))
      const html = Buffer.from(limitsPageHtml(comfort.tips))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(html.byteLength), 'cache-control': 'no-store' })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })

  // Is the database configured and reachable? One honest answer, owner-only.
  ctx.webServer.register({
    kind: 'exact', path: '/api/db/status', auth: 'required',
    handler: async (_req, res) => {
      try {
        respond(res, 200, await databaseStatus())
      } catch (error) {
        respond(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  })

  // The access room: keys, accounts and sign-in, moved off the front door.
  ctx.webServer.register({
    kind: 'exact', path: '/access', auth: 'anonymous',
    handler: (req, res) => {
      const html = Buffer.from(accessPageHtml(undefined, String(req.headers.cookie ?? '')))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Every backend, what it costs, and where its free tier ends.
  ctx.webServer.register({
    kind: 'exact', path: '/providers', auth: 'anonymous',
    handler: async (req, res) => {
      // A running total, straight from the usage meter the router writes.
      let summary: { calls: number; cost: number; since?: string } | undefined
      try {
        // Prefer the durable rows; the local logs are the pre-database fallback
        // and reset on every deploy.
        const durable = databaseConfigured() ? await readUsageRows() : []
        const points = durable.length > 0 ? durable : readUsage()
        if (points.length > 0) {
          const oldest = points.reduce((a, b) => (a.at <= b.at ? a : b))
          summary = {
            calls: points.length,
            cost: points.reduce((sum, point) => sum + costOf(point), 0),
            since: new Date(oldest.at).toISOString().slice(0, 10),
          }
        }
      } catch { /* the page still renders without the strip */ }
      const html = Buffer.from(providersPageHtml(summary))
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  // Bring a conversation in from any other assistant: summarise once, remember.
  ctx.webServer.register({
    kind: 'exact', path: '/import', auth: 'required',
    handler: (req, res) => {
      const html = Buffer.from(importPageHtml())
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(html.byteLength),
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  })
  ctx.webServer.register({
    kind: 'exact', path: '/api/import/paste', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const fields = await readFields(req)
        const transcript = (fields.get('transcript') ?? '').trim()
        const title = (fields.get('title') ?? '').trim().slice(0, 120)
        if (transcript.length < 80) {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
          res.end(importPageHtml('bad:That is too short to summarise — paste the actual exchange.'))
          return
        }
        const llm = ctx.get('llm') as { stream(options: { provider: string; model: string; messages: unknown[] }): AsyncIterable<{ type: string; text?: string }> } | undefined
        const summariser = process.env.DSH_SUMMARY_MODEL ?? 'deepseek-v4-pro'
        let summary = ''
        if (llm !== undefined) {
          const prompt = [
            'Summarise this conversation for an engineer who will continue the work later.',
            'Reply with exactly these sections, at most three short lines each:',
            'WORK: what was decided or built.',
            'PITFALLS: what failed, what was wrong, what to avoid.',
            'TOOLS: commands, libraries or approaches that worked.',
            'NEXT: the next step.',
            'Be concrete. No preamble.',
            title === '' ? '' : `Subject: ${title}`,
            '',
            transcript.slice(0, 24_000),
          ].filter(line => line !== '').join('\n')
          try {
            for await (const chunk of llm.stream({
              provider: 'deepseek-official',
              model: summariser,
              messages: [{ role: 'user', content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }],
            })) {
              if (chunk.type === 'text-delta') summary += chunk.text ?? ''
            }
          } catch { /* fall through to the raw fallback below */ }
        }
        const text = summary.trim() === '' ? transcript.slice(0, 3_000) : summary.trim()
        const stored = appendImported({
          at: Date.now(),
          cwd: IMPORTED_PROJECT,
          session: `import:${title === '' ? 'conversation' : title}`,
          text: text.slice(0, 2_000),
        })
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(importPageHtml(stored
          ? 'ok:Imported. Your next session will recall it.'
          : 'bad:It was summarised but could not be stored — check the disk.'))
      } catch (error) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(importPageHtml(`bad:${error instanceof Error ? error.message : String(error)}`))
      }
    },
  })
  // Forget one learned record. A memory you cannot remove is a liability.
  ctx.webServer.register({
    kind: 'exact', path: '/api/memory/forget', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const raw = await readBody(req)
        const payload = JSON.parse(raw === '' ? '{}' : raw) as { project?: unknown; at?: unknown; session?: unknown }
        if (typeof payload.project !== 'string' || typeof payload.at !== 'number' || typeof payload.session !== 'string') {
          respond(res, 400, { error: 'project, at and session are required' })
          return
        }
        const result = forgetRecord(payload.project, payload.at, payload.session)
        respond(res, result === undefined ? 404 : 200, result === undefined ? { error: 'not found' } : result)
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  // Owner-triggered relay check: send one real prompt through a connected worker.
  ctx.webServer.register({
    kind: 'exact', path: '/api/workers/test', auth: 'required',
    handler: async (req, res) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      try {
        const started = Date.now()
        const answer = await enqueue({
          model: 'auto',
          messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
        }) as { choices?: Array<{ message?: { content?: string } }> }
        const text = answer.choices?.[0]?.message?.content ?? ''
        respond(res, 200, { ok: true, answer: text, milliseconds: Date.now() - started })
      } catch (error) {
        respond(res, 503, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  // Try-before-you-key: a guest session that spends the owner's key, capped.
  ctx.webServer.register({
    kind: 'exact', path: '/api/preview', auth: 'anonymous',
    handler: async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'GET') { respond(res, 405, { error: 'method not allowed' }); return }
      if ((process.env.DSH_GUEST_FROZEN ?? '') !== '') {
        res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end('<!doctype html><meta charset="utf-8"><title>Massai — preview paused</title>'
          + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e10;'
          + 'color:#F2F2F4;font-family:system-ui,sans-serif;padding:2rem}a{color:#7ee2a8}</style>'
          + '<div style="max-width:30rem"><h1 style="font-size:1.2rem">The free preview is paused</h1>'
          + '<p style="color:#a9a9b3;line-height:1.6">Not because of you — the shared budget needed a breath. '
          + 'Your own key works right now and is never affected.</p>'
          + '<p><a href="/access">Continue with my own key →</a> &nbsp;·&nbsp; <a href="/limits">what this can and cannot do →</a></p></div>')
        return
      }
      // Only possible when the deployment carries its own key to spend.
      if ((process.env.DEEPSEEK_API_KEY ?? '') === '') {
        respond(res, 503, { error: 'this deployment has no preview key' })
        return
      }
      const minter = ctx.get('browserAuth') as
        | { mintSessionCookie(req: IncomingMessage, res: { setHeader(name: string, value: string): void }, secure: boolean, userId: string): boolean }
        | undefined
      if (minter === undefined) { respond(res, 503, { error: 'session service unavailable' }); return }
      // A cookie can be cleared; the visitor-derived key cannot. Three guest
      // sessions per network+browser per day, so the "new incognito window"
      // loop stops being free.
      const admission = await admitGuestSession(guestKeyOf(req))
      if (!admission.allowed) {
        res.writeHead(429, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(`<!doctype html><meta charset="utf-8"><title>Massai — preview limit</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e10;color:#F2F2F4;
font-family:system-ui,sans-serif;padding:2rem}div{max-width:30rem}a{color:#7ee2a8}</style>
<div><h1 style="font-size:1.2rem">That is enough previews for today</h1>
<p style="color:#a9a9b3;line-height:1.6">This network has used its ${admission.limit} free previews for today
(${admission.used} requested). The workshop's budget is small and shared, so it is metered per network as
well as per browser.</p>
<p style="color:#a9a9b3;line-height:1.6">You can keep going right now with your own key — it takes a minute
and costs cents.</p>
<p><a href="/access">Continue with my own key →</a> &nbsp;·&nbsp; <a href="/limits">what this can and cannot do →</a></p>
<p style="color:#6f6f78;font-size:.8rem">The limit resets at midnight UTC.</p></div>`)
        return
      }
      const guest = `guest-${randomUUID()}`
      // Free Gemini is not offered in the EEA, UK or Switzerland (Google's terms
      // require the paid tier there). The country has to be captured now: model
      // calls are made by this server, not by the visitor's browser.
      rememberCountry(guest, countryOf(req))
      if (!minter.mintSessionCookie(req, res, ctx.webServer.protocol === 'https:', guest)) {
        respond(res, 400, { error: 'missing Host authority' }); return
      }
      // Their own id, readable by the page so /me can show it and they can paste
      // it into a Ko-fi note. Appended, not set: the session cookie was written
      // with setHeader a moment ago and would otherwise be replaced. Not a
      // credential — it is just their own name for themselves.
      res.appendHeader('set-cookie',
        `dsh_uid=${guest}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`)
      res.writeHead(303, { location: '/', 'cache-control': 'no-store' })
      res.end()
    },
  })
  // Local agents: machines report in here so they appear inside Massai.
  ctx.webServer.register({
    kind: 'exact', path: '/api/workers/heartbeat', auth: 'anonymous',
    handler: async (req, res) => {
      // Answer 404 unless the shared token matches: a scanner cannot learn the
      // route exists, and a missing configuration looks like a plain miss.
      const token = workerTokenOf(req)
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
      const html = Buffer.from(workersPageHtml(relayStatus()))
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
