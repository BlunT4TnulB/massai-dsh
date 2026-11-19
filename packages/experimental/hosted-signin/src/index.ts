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

export const name = 'hosted-signin'
export const inject = ['credentials', 'webServer', 'browserAuth']

const SCOPE = 'massai-user'
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const
const MARK_PATH = '/massai-mark.jpg'

/**
 * The Massai mark bytes, read once beside the built package. Served
 * anonymously because the concierge page that shows it precedes sign-in.
 */
function massaiMark(): Buffer | undefined {
  try {
    return readFileSync(new URL('../assets/massai-mark.jpg', import.meta.url))
  } catch {
    return undefined
  }
}

/** The session minter the authentication-token plugin exposes. */
interface SessionMinter {
  mintSession(req: IncomingMessage, res: ServerResponse, secure: boolean, userId: string): void
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
  // Anonymous brand asset for the concierge page (see the webserver's welcome HTML).
  ctx.webServer.register({
    kind: 'exact', path: MARK_PATH, auth: 'anonymous',
    handler: (req, res) => {
      const mark = massaiMark()
      if (mark === undefined) { res.writeHead(404); res.end(); return }
      res.writeHead(200, {
        'content-type': 'image/jpeg',
        'content-length': String(mark.byteLength),
        'cache-control': 'public, max-age=86400',
      })
      res.end(req.method === 'HEAD' ? undefined : mark)
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
        minter.mintSession(req, res, ctx.webServer.protocol === 'https:', userId)
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
