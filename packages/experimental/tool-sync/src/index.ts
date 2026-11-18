/**
 * Model-facing `sync` tool: one-way, age-guarded copy of a local path to a cloud
 * remote via rclone (Google Drive, Dropbox, S3, …). Never pulls cloud data back,
 * so a stale remote cannot overwrite fresh local state.
 *
 * @module @deepseek-ai/dsh-tool-sync
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const name = 'tool-sync'
export const inject = ['tools']

export interface Config {
  /** rclone executable; defaults to `rclone` on PATH. */
  rclone?: string
  /** Per-call timeout in milliseconds; defaults to 300000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  rclone: z.string(),
  timeoutMs: z.number(),
})

export function apply(ctx: Context, config: Config = {}): void {
  const rclone = config.rclone ?? 'rclone'
  const timeoutMs = config.timeoutMs ?? 300000

  const tool = defineTool({
    name: 'sync',
    description:
      'One-way sync a local path to a cloud remote via rclone (e.g. copy snapshots to Google Drive). Never pulls remote data back.',
    parameters: {
      source: { type: 'string', required: true, description: 'Local path to copy from.' },
      remote: { type: 'string', required: true, description: 'rclone remote:path target.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      try {
        const { stdout, stderr } = await execFileAsync(
          rclone,
          ['copy', args.source, args.remote, '--immutable', '--create-empty-src-dirs'],
          { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
        )
        return { text: (stdout || stderr || 'sync complete').trim() }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { text: `sync failed: ${message}` }
      }
    },
  })

  ctx.tools.register(tool)
}
