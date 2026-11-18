/**
 * Generic HTTP request tool. Optionally authenticates with a stored credential
 * from the vault (injected as a Bearer token), so the secret never enters the
 * model's context.
 *
 * @module @deepseek-ai/dsh-tool-http
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef, resolveCredentialRef } from '@deepseek-ai/dsh-credentials'

export const name = 'tool-http'
export const inject = ['tools', 'credentials']

export interface Config {
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  timeoutMs: z.number(),
})

export function apply(ctx: Context, config: Config = {}): void {
  const timeoutMs = config.timeoutMs ?? 30000

  const tool = defineTool({
    name: 'http_request',
    description:
      'Make an HTTP request. Optionally send a vault credential as a Bearer token.',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL.' },
      method: { type: 'string', description: 'GET/POST/PUT/PATCH/DELETE (default GET).' },
      credential: {
        type: 'string',
        description: 'Vault credential name to send as Bearer token, e.g. GITHUB_PAT.',
      },
      headers: { type: 'string', description: 'JSON object of extra headers.' },
      body: { type: 'string', description: 'Request body (POST/PUT/PATCH).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string', required: true } },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      try {
        const method = (args.method ?? 'GET').toUpperCase()
        const headers: Record<string, string> = {}
        if (args.headers) Object.assign(headers, JSON.parse(args.headers))
        if (args.credential) {
          const token = await resolveCredentialRef(ctx, credentialRef(args.credential))
          if (token) headers.Authorization = `Bearer ${token}`
        }
        if (args.body && headers['Content-Type'] === undefined) {
          headers['Content-Type'] = 'application/json'
        }
        const resp = await fetch(args.url, {
          method,
          headers,
          ...(args.body === undefined ? {} : { body: args.body }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        const text = await resp.text()
        return { text: `HTTP ${resp.status}\n${text.slice(0, 20000)}` }
      } catch (error) {
        return { text: `http error: ${error instanceof Error ? error.message : String(error)}` }
      }
    },
  })

  ctx.tools.register(tool)
}
