/**
 * Durable storage for the learning loop.
 *
 * The interview learns from failures, the voice is a stored asset, and every
 * trial is evidence. All three used to live in JSON files on the container, which
 * meant they died on the next deploy — so the system forgot everything it had
 * learned, usually within the hour.
 *
 * This module gives them a home in Postgres (the Neon database already wired for
 * usage and credits), while keeping the *reads* synchronous: the lesson and voice
 * caches are hydrated once at startup and updated on write, so `normalise()` and
 * `compile()` stay pure functions that never await.
 *
 * Writes are fire-and-forget. A failed insert must never fail a build.
 *
 * @module @deepseek-ai/dsh-one-turn/store
 */

/** Postgres over HTTP, which is how the Neon connection string is usable here. */
export async function runSql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL ?? ''
  if (url === '') throw new Error('DATABASE_URL is not set')
  // `postgresql://` is not a special scheme, so `new URL(uri).origin` is "null".
  const host = new URL(url).hostname
  const response = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'neon-connection-string': url,
    },
    body: JSON.stringify({ query, params }),
  })
  if (!response.ok) throw new Error(`sql ${response.status}`)
  const body = await response.json() as { rows?: T[] }
  return body.rows ?? []
}

/** Whether a database is configured at all. */
export function storeConfigured(): boolean {
  return (process.env.DATABASE_URL ?? '') !== ''
}

/** Create the tables this package owns. Safe to call on every boot. */
export async function ensureStoreSchema(): Promise<void> {
  if (!storeConfigured()) return
  // One statement per request: the HTTP endpoint prepares each query, and a
  // prepared statement cannot carry two commands.
  const statements = [
    `CREATE TABLE IF NOT EXISTS one_turn_lessons (
       shape text NOT NULL,
       bucket text NOT NULL,
       note text NOT NULL DEFAULT '',
       count integer NOT NULL DEFAULT 1,
       at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY (shape, bucket))`,
    `CREATE TABLE IF NOT EXISTS one_turn_voice (
       id integer PRIMARY KEY DEFAULT 1,
       body jsonb NOT NULL,
       at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS one_turn_trials (
       id text PRIMARY KEY,
       at timestamptz NOT NULL DEFAULT now(),
       shape text NOT NULL,
       accepted boolean NOT NULL DEFAULT false,
       cost_usd numeric(12,6) NOT NULL DEFAULT 0,
       input_tokens integer NOT NULL DEFAULT 0,
       output_tokens integer NOT NULL DEFAULT 0,
       buckets text[] NOT NULL DEFAULT '{}',
       checks jsonb NOT NULL DEFAULT '[]',
       files jsonb NOT NULL DEFAULT '[]',
       error text)`,
    `CREATE TABLE IF NOT EXISTS one_turn_projects (
       id text PRIMARY KEY,
       owner text NOT NULL,
       name text NOT NULL,
       shape text NOT NULL DEFAULT 'single-page-site',
       status text NOT NULL DEFAULT 'active',
       entry text NOT NULL DEFAULT '',
       manifest jsonb NOT NULL DEFAULT '[]',
       bytes integer NOT NULL DEFAULT 0,
       origin text,
       visibility text NOT NULL DEFAULT 'private',
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now())`,
    `ALTER TABLE one_turn_projects ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'`,
    `CREATE INDEX IF NOT EXISTS one_turn_projects_owner ON one_turn_projects (owner, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS one_turn_projects_status ON one_turn_projects (status, updated_at DESC)`,
  ]
  for (const statement of statements) await runSql(statement)
}

/** One remembered failure row. */
export interface StoredLesson {
  readonly shape: string
  readonly bucket: string
  readonly count: number
  readonly at: number
  readonly note: string
}

/**
 * Read every lesson from the database.
 * @returns the rows, oldest shape first.
 */
export async function loadLessons(): Promise<StoredLesson[]> {
  if (!storeConfigured()) return []
  const rows = await runSql<{ shape: string; bucket: string; count: number; at: string; note: string }>(
    'SELECT shape, bucket, count, at, note FROM one_turn_lessons ORDER BY shape, bucket')
  return rows.map(row => ({
    shape: row.shape,
    bucket: row.bucket,
    count: Number(row.count),
    at: Date.parse(row.at) || Date.now(),
    note: row.note ?? '',
  }))
}

/**
 * Insert or bump one lesson.
 * @param lesson - shape, bucket, and the note to keep.
 */
export async function saveLesson(lesson: { shape: string; bucket: string; note: string }): Promise<void> {
  if (!storeConfigured()) return
  await runSql(`
    INSERT INTO one_turn_lessons (shape, bucket, note, count, at)
    VALUES ($1, $2, $3, 1, now())
    ON CONFLICT (shape, bucket) DO UPDATE
      SET count = one_turn_lessons.count + 1,
          note = CASE WHEN EXCLUDED.note = '' THEN one_turn_lessons.note ELSE EXCLUDED.note END,
          at = now()
  `, [lesson.shape, lesson.bucket, lesson.note])
}

/**
 * Read the stored voice.
 * @returns the raw JSON body, or undefined when none has been saved.
 */
export async function loadVoice(): Promise<unknown | undefined> {
  if (!storeConfigured()) return undefined
  const rows = await runSql<{ body: unknown }>('SELECT body FROM one_turn_voice WHERE id = 1')
  return rows[0]?.body
}

/**
 * Store the voice, replacing any previous one.
 * @param body - the voice object.
 */
export async function saveVoice(body: unknown): Promise<void> {
  if (!storeConfigured()) return
  await runSql(`
    INSERT INTO one_turn_voice (id, body, at) VALUES (1, $1::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, at = now()
  `, [JSON.stringify(body)])
}

/** The trial shape this module persists. */
export interface StoredTrial {
  readonly id: string
  readonly shape: string
  readonly accepted: boolean
  readonly costUsd: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly buckets: readonly string[]
  readonly checks: unknown
  readonly files: readonly { path: string; content: string }[]
  readonly error?: string
}

/**
 * Persist one trial record. Never throws.
 * @param trial - the trial to remember.
 */
export async function saveTrial(trial: StoredTrial): Promise<void> {
  if (!storeConfigured()) return
  try {
    await runSql(`
      INSERT INTO one_turn_trials
        (id, shape, accepted, cost_usd, input_tokens, output_tokens, buckets, checks, files, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb, $9::jsonb, $10)
      ON CONFLICT (id) DO NOTHING
    `, [
      trial.id,
      trial.shape,
      trial.accepted,
      trial.costUsd,
      trial.inputTokens,
      trial.outputTokens,
      `{${trial.buckets.join(',')}}`,
      JSON.stringify(trial.checks),
      JSON.stringify(trial.files.slice(0, 8).map(file => ({ path: file.path, content: file.content.slice(0, 40000) }))),
      trial.error ?? null,
    ])
  } catch {
    /* evidence is nice; a failed build is not */
  }
}

/**
 * What the workshop's own library looks like: how many projects, how big, and
 * which stacks recur. Builds use it as a convention hint — the house style is
 * whatever the house already builds.
 */
export interface LibraryProfile {
  /** How many published projects there are. */
  readonly projects: number
  /** Total bytes across them. */
  readonly bytes: number
  /** Most common file extensions, biggest first. */
  readonly extensions: Array<{ readonly ext: string; readonly files: number }>
  /** Repository names, for the console. */
  readonly names: readonly string[]
  /** Epoch ms when this profile was computed. */
  readonly at: number
}

/**
 * Compute the library profile from published projects.
 * @returns the profile, or undefined when nothing is published yet.
 */
export async function libraryProfile(): Promise<LibraryProfile | undefined> {
  if (!storeConfigured()) return undefined
  const rows = await runSql<{ name: string; bytes: number; manifest: unknown }>(
    "SELECT name, bytes, manifest FROM one_turn_projects WHERE visibility = 'shelf' AND status <> 'deleted' ORDER BY updated_at DESC LIMIT 200")
  if (rows.length === 0) return undefined
  const counts = new Map<string, number>()
  let bytes = 0
  for (const row of rows) {
    bytes += Number(row.bytes ?? 0)
    const manifest = (typeof row.manifest === 'string' ? JSON.parse(row.manifest) : row.manifest) as unknown
    if (!Array.isArray(manifest)) continue
    for (const item of manifest) {
      const path = (item as { path?: unknown }).path
      if (typeof path !== 'string') continue
      const ext = path.includes('.') ? (path.split('.').at(-1) ?? '').toLowerCase() : ''
      if (ext === '' || ext.length > 6) continue
      counts.set(ext, (counts.get(ext) ?? 0) + 1)
    }
  }
  return {
    projects: rows.length,
    bytes,
    extensions: [...counts.entries()]
      .map(([ext, files]) => ({ ext, files }))
      .sort((a, b) => b.files - a.files)
      .slice(0, 6),
    names: rows.slice(0, 12).map(row => row.name),
    at: Date.now(),
  }
}

/** Aggregate stats for the console: trials, acceptance, spend, lessons. */
export async function trialStats(): Promise<{
  configured: boolean
  trials: number
  accepted: number
  spentUsd: number
  lessons: number
  shapes: Array<{ shape: string; trials: number; accepted: number; spentUsd: number }>
}> {
  if (!storeConfigured()) {
    return { configured: false, trials: 0, accepted: 0, spentUsd: 0, lessons: 0, shapes: [] }
  }
  const totals = await runSql<{ trials: number; accepted: number; spent: number }>(`
    SELECT count(*)::int AS trials,
           count(*) FILTER (WHERE accepted)::int AS accepted,
           coalesce(sum(cost_usd), 0) AS spent
    FROM one_turn_trials`)
  const byShape = await runSql<{ shape: string; trials: number; accepted: number; spent: number }>(`
    SELECT shape, count(*)::int AS trials, count(*) FILTER (WHERE accepted)::int AS accepted,
           coalesce(sum(cost_usd), 0) AS spent
    FROM one_turn_trials GROUP BY shape ORDER BY trials DESC`)
  const lessonCount = await runSql<{ lessons: number }>('SELECT count(*)::int AS lessons FROM one_turn_lessons')
  return {
    configured: true,
    trials: Number(totals[0]?.trials ?? 0),
    accepted: Number(totals[0]?.accepted ?? 0),
    spentUsd: Number(totals[0]?.spent ?? 0),
    lessons: Number(lessonCount[0]?.lessons ?? 0),
    shapes: byShape.map(row => ({
      shape: row.shape,
      trials: Number(row.trials),
      accepted: Number(row.accepted),
      spentUsd: Number(row.spent),
    })),
  }
}
