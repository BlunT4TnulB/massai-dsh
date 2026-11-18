/**
 * Account connectors: store and list account credentials through DSH's own
 * credential vault (the `credentials` service). The agent can connect
 * GitHub / Google Drive / Postgres / DeepSeek by storing a token securely;
 * values are never logged or returned.
 *
 * @module @deepseek-ai/dsh-account-connect
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

export const name = 'account-connect'
export const inject = ['tools', 'credentials']

const DEFAULT_ACCOUNTS = [
  'DEEPSEEK_API_KEY',
  'GITHUB_PAT',
  'GOOGLE_DRIVE_SA',
  'POSTGRES_URL',
]

export interface Config {
  accounts?: string[]
}

export const Config: z<Config> = z.object({
  accounts: z.array(z.string()),
})

export function apply(ctx: Context, config: Config = {}): void {
  const accounts = config.accounts ?? DEFAULT_ACCOUNTS

  const connect = defineTool({
    name: 'connect_account',
    description:
      'Securely store an account credential in the vault. Values are never echoed back.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Environment-variable-style name, e.g. GITHUB_PAT.',
      },
      value: { type: 'string', required: true, description: 'The secret value to store.' },
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
        const ref = credentialRef(args.name)
        await ctx.credentials.set(ref, args.value)
        return { text: `connected ${args.name} (stored in vault)` }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { text: `connect failed: ${message}` }
      }
    },
  })

  const list = defineTool({
    name: 'list_accounts',
    description: 'List which accounts are connected (configured in the vault).',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string', required: true } },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute() {
      const lines: string[] = []
      for (const name of accounts) {
        try {
          const info = await ctx.credentials.describe(credentialRef(name))
          lines.push(`${name}: ${info.configured ? 'connected' : 'not connected'}`)
        } catch {
          lines.push(`${name}: unavailable`)
        }
      }
      return { text: lines.join('\n') }
    },
  })

  ctx.tools.register(connect)
  ctx.tools.register(list)
}
