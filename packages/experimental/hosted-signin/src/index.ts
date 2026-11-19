/**
 * Hosted-link BYOK sign-in: one HTTP route that stores a visitor's DeepSeek
 * API key under their session peer id, so every later request from that session
 * resolves their own key (see dsh-user-credentials + deepseek-auth per-user).
 *
 * @module @deepseek-ai/dsh-hosted-signin
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialKey } from '@deepseek-ai/dsh-credentials'

export const name = 'hosted-signin'
export const inject = ['credentials', 'webServer']

const SCOPE = 'massai-user'
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const

/** Read + parse a small JSON request body. */
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8')
  return text.trim() === '' ? {} : JSON.parse(text) as Record<string, unknown>
}

function respond(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(payload))
}

export function apply(ctx: Context): void {
  ctx.webServer.register({
    kind: 'exact', path: '/api/signin', auth: 'required',
    handler: async (req, res, peer) => {
      if (req.method !== 'POST') { respond(res, 405, { error: 'method not allowed' }); return }
      if (peer === undefined) { respond(res, 401, { error: 'unauthorized' }); return }
      try {
        const body = await readJson(req)
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
        if (apiKey === '') { respond(res, 400, { error: 'apiKey is required' }); return }
        await ctx.credentials.modifyRecord(credentialKey(SCOPE, peer.id), async () => ({ kind: 'api-key', key: apiKey }))
        respond(res, 200, { ok: true })
      } catch (error) {
        respond(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
