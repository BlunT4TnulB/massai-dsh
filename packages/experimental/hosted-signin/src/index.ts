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
import { startPageHtml } from './start-page.ts'

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
