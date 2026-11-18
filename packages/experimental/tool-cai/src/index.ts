/**
 * Model-facing `cai` tool: delegates a self-contained coding task to the cai
 * DeepSeek agent (autonomous loop: read/write/edit/bash/grep/web, planning,
 * streaming, resume, MCP) and returns its final answer.
 *
 * @module @deepseek-ai/dsh-tool-cai
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const name = 'tool-cai'
export const inject = ['tools']

export interface Config {
  /** `cai` executable; defaults to `cai` on PATH. */
  command?: string
  /** Default working directory when the call omits one. */
  workdir?: string
  /** Per-call timeout in milliseconds; defaults to 300000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  command: z.string(),
  workdir: z.string(),
  timeoutMs: z.number(),
})

export function apply(ctx: Context, config: Config = {}): void {
  const command = config.command ?? 'cai'
  const timeoutMs = config.timeoutMs ?? 300000

  const tool = defineTool({
    name: 'cai',
    description:
      'Delegate a self-contained coding task to the cai DeepSeek agent (autonomous: reads/edits files, runs commands, plans, verifies). Returns its final answer.',
    parameters: {
      task: { type: 'string', required: true, description: 'The task to hand to cai.' },
      workdir: { type: 'string', description: 'Working directory override.' },
      model: { type: 'string', description: 'Model override, e.g. deepseek-flash.' },
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
      const argv: string[] = [args.task]
      const workdir = args.workdir ?? config.workdir
      if (workdir) argv.push('--workdir', workdir)
      if (args.model) argv.push('--model', args.model)
      try {
        const { stdout, stderr } = await execFileAsync(command, argv, {
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024,
        })
        return { text: (stdout || stderr || '').trim() }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { text: `cai failed: ${message}` }
      }
    },
  })

  ctx.tools.register(tool)
}
