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
  // `postgresql://` is not a special scheme, so `new URL(conn).origin` is the
  // string "null" — the host has to be taken from `hostname` and the endpoint
  // built as https, which is what Neon's SQL-over-HTTP expects.
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('DATABASE_URL is not a valid URL')
  }
  if (host === '') throw new Error('DATABASE_URL has no host')
  const response = await fetch(`https://${host}/sql`, {
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
    CREATE TABLE IF NOT EXISTS credits (
      id      BIGSERIAL   PRIMARY KEY,
      at      BIGINT      NOT NULL,
      user_id TEXT        NOT NULL,
      usd     DOUBLE PRECISION NOT NULL,
      note    TEXT        NOT NULL DEFAULT ''
    )
  `)
  await runSql('CREATE INDEX IF NOT EXISTS credits_user_idx ON credits (user_id)')
  await runSql(`
    CREATE TABLE IF NOT EXISTS guest_sessions (
      guest_key TEXT    NOT NULL,
      day       TEXT    NOT NULL,
      count     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guest_key, day)
    )
  `)
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
 * Count one guest session for a key on a day, atomically.
 * @param guestKey - the durable visitor-derived key.
 * @param day - `YYYY-MM-DD`.
 * @returns the count after this increment.
 */
export async function bumpGuestCounter(guestKey: string, day: string): Promise<number> {
  if (!databaseConfigured()) return 0
  await ensureOnce()
  const rows = await runSql(
    `INSERT INTO guest_sessions (guest_key, day, count) VALUES ($1, $2, 1)
     ON CONFLICT (guest_key, day) DO UPDATE SET count = guest_sessions.count + 1
     RETURNING count`,
    [guestKey, day],
  )
  return Number(rows[0]?.count ?? 1)
}

/**
 * Guest sessions per day, busiest first — the abuse report.
 * @param day - `YYYY-MM-DD`; omit for every day recorded.
 * @returns rows for the owner console.
 */
export async function guestCounters(day?: string): Promise<Array<{ guestKey: string; day: string; count: number }>> {
  if (!databaseConfigured()) return []
  await ensureOnce()
  const rows = day === undefined
    ? await runSql('SELECT guest_key, day, count FROM guest_sessions ORDER BY day DESC, count DESC LIMIT 50')
    : await runSql('SELECT guest_key, day, count FROM guest_sessions WHERE day = $1 ORDER BY count DESC LIMIT 50', [day])
  return rows.map(row => ({ guestKey: String(row.guest_key), day: String(row.day), count: Number(row.count) }))
}

/**
 * Add credit to one person's allowance — the "someone bought Massai a coffee"
 * path. Positive to top up, negative to correct a mistake.
 * @param userId - whose allowance to raise (`guest-…`, a Clerk id, or an email).
 * @param usd - dollars to add.
 * @param note - why, for the ledger (`ko-fi 1234`, `manual`, `refund`).
 * @returns the new balance.
 */
export async function grantCredit(userId: string, usd: number, note = ''): Promise<number> {
  if (!databaseConfigured()) return 0
  await ensureOnce()
  await runSql('INSERT INTO credits (at, user_id, usd, note) VALUES ($1, $2, $3, $4)', [Date.now(), userId, usd, note])
  return creditTotal(userId)
}

/**
 * One person's credit balance.
 * @param userId - whose balance.
 * @returns dollars available (0 when unknown or no database).
 */
export async function creditTotal(userId: string): Promise<number> {
  if (!databaseConfigured()) return 0
  await ensureOnce()
  const rows = await runSql('SELECT COALESCE(SUM(usd), 0) AS total FROM credits WHERE user_id = $1', [userId])
  return Number(rows[0]?.total ?? 0)
}

/**
 * Everyone who has ever been granted credit, with their balance.
 * @returns rows for the owner console, biggest balance first.
 */
export async function creditLedger(): Promise<Array<{ userId: string; usd: number; entries: number; last: number }>> {
  if (!databaseConfigured()) return []
  await ensureOnce()
  const rows = await runSql(
    `SELECT user_id, COALESCE(SUM(usd), 0) AS usd, COUNT(*)::int AS entries, MAX(at) AS last
     FROM credits GROUP BY user_id ORDER BY usd DESC LIMIT 50`,
  )
  return rows.map(row => ({
    userId: String(row.user_id),
    usd: Number(row.usd),
    entries: Number(row.entries),
    last: Number(row.last),
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
