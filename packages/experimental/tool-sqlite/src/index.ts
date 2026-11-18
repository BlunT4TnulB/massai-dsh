/**
 * Embedded SQLite database tool (Node's built-in `node:sqlite`, no native build).
 * Gives the agent persistent, structured storage without a database server.
 *
 * @module @deepseek-ai/dsh-tool-sqlite
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

export const name = 'tool-sqlite'
export const inject = ['tools']

export interface Config {
  /** SQLite file path; defaults to `~/.dsh/massai.sqlite`. */
  dbPath?: string
}

export const Config: z<Config> = z.object({
  dbPath: z.string(),
})

export function apply(ctx: Context, config: Config = {}): void {
  const dbPath = config.dbPath ?? join(homedir(), '.dsh', 'massai.sqlite')
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)

  const exec = defineTool({
    name: 'db_exec',
    description: 'Run a SQL statement (DDL/DML) against the embedded SQLite database.',
    parameters: {
      sql: { type: 'string', required: true, description: 'SQL to execute.' },
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
        db.exec(args.sql)
        return { text: 'ok' }
      } catch (error) {
        return { text: `db error: ${error instanceof Error ? error.message : String(error)}` }
      }
    },
  })

  const query = defineTool({
    name: 'db_query',
    description: 'Run a SQL query and return rows as JSON.',
    parameters: {
      sql: { type: 'string', required: true, description: 'SQL query to run.' },
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
        const rows = db.prepare(args.sql).all()
        return { text: JSON.stringify(rows, null, 2) }
      } catch (error) {
        return { text: `db error: ${error instanceof Error ? error.message : String(error)}` }
      }
    },
  })

  ctx.tools.register(exec)
  ctx.tools.register(query)
}
