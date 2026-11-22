/**
 * Durable storage for the numbers that must outlive a container.
 *
 * Render's free disk is ephemeral: every deploy wipes the session logs, so the
 * usage meter, the memory records and the imported conversations all reset. That
 * is fine for a demo and wrong for a product — a user's history disappearing on
 * a Tuesday afternoon is the kind of thing nobody forgives.
 *
 * Neon speaks SQL over plain HTTPS, so this needs no driver dependency: one
 * `fetch` per call against `<db-host>/sql`. The whole module is dormant until
 * `DATABASE_URL` exists, and every failure is reported rather than swallowed so
 * `/api/db/status` can tell the truth.
 *
 * @module @deepseek-ai/dsh-hosted-signin/persistence
 */

/** One measured model call, the same shape the file reader produces. */
export interface UsageRow {
  at: number
  session: string
  /** Whose prompt this was: `guest-<uuid>`, a Clerk user id, or the owner. */
  userId: string
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** The connection string, or an empty string when persistence is off. */
export function databaseUrl(): string {
  return (process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? '').trim()
}

/** Whether this deployment has been given a database. */
export function databaseConfigured(): boolean {
  return databaseUrl() !== ''
}

/** The last error seen, so a status page can explain a silent outage. */
let lastError: string | undefined

/** What the last successful statement was, for the status page. */
let lastOk: number | undefined

/**
 * Run one statement against Neon's HTTP SQL endpoint.
 * @param query - SQL with `$1`-style placeholders.
 * @param params - positional parameters.
 * @returns the returned rows (empty for statements that return none).
 */
async function runSql(query: string, params: readonly unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const url = databaseUrl()
  if (url === '') throw new Error('DATABASE_URL is not set')
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    throw new Error('DATABASE_URL is not a valid URL')
  }
  const response = await fetch(`${origin}/sql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'neon-connection-string': url },
    body: JSON.stringify({ query, params }),
  })
  const body = await response.json() as { rows?: Array<Record<string, unknown>>; message?: string }
  if (!response.ok) {
    const message = body.message ?? `HTTP ${response.status}`
    lastError = message
    throw new Error(message)
  }
  lastError = undefined
  lastOk = Date.now()
  return body.rows ?? []
}

/**
 * Create the tables this deployment needs, if they are not there yet.
 * Idempotent, so it is safe to call on every boot.
 */
export async function ensureSchema(): Promise<void> {
  if (!databaseConfigured()) return
  await runSql(`
    CREATE TABLE IF NOT EXISTS usage_points (
      at          BIGINT      NOT NULL,
      session     TEXT        NOT NULL,
      model       TEXT        NOT NULL,
      input       INTEGER     NOT NULL DEFAULT 0,
      output      INTEGER     NOT NULL DEFAULT 0,
      cache_read  INTEGER     NOT NULL DEFAULT 0,
      cache_write INTEGER     NOT NULL DEFAULT 0,
      PRIMARY KEY (at, session, model)
    )
  `)
  await runSql('ALTER TABLE usage_points ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT \'\'')
  await runSql(`
    CREATE TABLE IF NOT EXISTS memory_records (
      at      BIGINT NOT NULL,
      cwd     TEXT   NOT NULL,
      session TEXT   NOT NULL,
      body    TEXT   NOT NULL,
      PRIMARY KEY (at, session)
    )
  `)
}

/** The in-flight or finished schema creation, so it runs at most once. */
let ensured: Promise<void> | undefined

/**
 * Ensure the schema before the first real use. Idempotent; failures are
 * swallowed here and reported by {@link databaseStatus}.
 */
async function ensureOnce(): Promise<void> {
  ensured ??= ensureSchema().catch(() => { /* reported by /api/db/status */ })
  await ensured
}

/**
 * Store one measured call. Re-sending the same point is harmless.
 * @param row - the point to persist.
 */
export async function recordUsage(row: UsageRow): Promise<void> {
  if (!databaseConfigured()) return
  await ensureOnce()
  await runSql(
    `INSERT INTO usage_points (at, session, user_id, model, input, output, cache_read, cache_write)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (at, session, model) DO NOTHING`,
    [row.at, row.session, row.userId, row.model, row.input, row.output, row.cacheRead, row.cacheWrite],
  )
}

/**
 * Read every stored point, oldest first.
 * @param limit - safety cap on rows returned.
 * @returns stored points, or an empty list when persistence is off.
 */
export async function readUsageRows(limit = 20000): Promise<UsageRow[]> {
  if (!databaseConfigured()) return []
  await ensureOnce()
  const rows = await runSql(
    `SELECT at, session, user_id, model, input, output, cache_read, cache_write
     FROM usage_points ORDER BY at ASC LIMIT $1`,
    [limit],
  )
  return rows.map(row => ({
    at: Number(row.at),
    session: String(row.session),
    userId: String(row.user_id ?? ''),
    model: String(row.model),
    input: Number(row.input),
    output: Number(row.output),
    cacheRead: Number(row.cache_read),
    cacheWrite: Number(row.cache_write),
  }))
}

/**
 * Every row since a timestamp — the shape the budget gate and the spend table use.
 * @param sinceMs - epoch ms lower bound (inclusive).
 * @returns rows, oldest first.
 */
export async function readUsageSince(sinceMs: number): Promise<UsageRow[]> {
  if (!databaseConfigured()) return []
  await ensureOnce()
  const rows = await runSql(
    `SELECT at, session, user_id, model, input, output, cache_read, cache_write
     FROM usage_points WHERE at >= $1 ORDER BY at ASC LIMIT 20000`,
    [sinceMs],
  )
  return rows.map(row => ({
    at: Number(row.at),
    session: String(row.session),
    userId: String(row.user_id ?? ''),
    model: String(row.model),
    input: Number(row.input),
    output: Number(row.output),
    cacheRead: Number(row.cache_read),
    cacheWrite: Number(row.cache_write),
  }))
}

/**
 * What the status route reports: configured, reachable, how much is stored, and
 * the last error if the last attempt failed.
 */
export async function databaseStatus(): Promise<{
  configured: boolean
  ok: boolean
  error?: string
  usageRows?: number
  lastOk?: string
}> {
  if (!databaseConfigured()) return { configured: false, ok: false, error: 'DATABASE_URL is not set' }
  try {
    await ensureOnce()
    const rows = await runSql('SELECT count(*)::int AS n FROM usage_points')
    const reported = lastOk === undefined
      ? { configured: true, ok: true, usageRows: Number(rows[0]?.n ?? 0) }
      : { configured: true, ok: true, usageRows: Number(rows[0]?.n ?? 0), lastOk: new Date(lastOk).toISOString() }
    return reported
  } catch (error) {
    return { configured: true, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** The last error, for callers that need it without another round trip. */
export function lastDatabaseError(): string | undefined {
  return lastError
}
