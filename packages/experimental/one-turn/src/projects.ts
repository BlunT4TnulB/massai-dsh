/**
 * Projects: the thing a person made, kept where it cannot evaporate.
 *
 * A project is a row in Postgres (who owns it, what it is called, how big it is,
 * whether it is active, paused, adoptable or deleted) plus its files in object
 * storage under `projects/<id>/<path>`. Metadata in the database means listing a
 * shelf costs one query; bytes in R2 mean the work outlives the container.
 *
 * Status is a small state machine, and the point of it is that **nothing is
 * deleted by running out of money**:
 *
 *   active ──(budget out)──▶ paused ──(owner)──▶ adoptable ──(someone adopts)──▶ active (new owner)
 *      │                        │                    │
 *      └────────(owner chooses delete)──────────────┴──▶ deleted
 *
 * @module @deepseek-ai/dsh-one-turn/projects
 */

import { randomUUID } from 'node:crypto'
import { deleteObject, getObject, listObjects, putObject, r2Configured } from './r2.ts'
import { runSql, storeConfigured } from './store.ts'

/** What a project may be. */
export type ProjectStatus = 'active' | 'paused' | 'adoptable' | 'forked' | 'deleted'

/** Whether a project is the owner's alone, or offered to the public shelf. */
export type ProjectVisibility = 'private' | 'shelf'

/** One file in a project. */
export interface ProjectFile {
  readonly path: string
  readonly content: string
}

/**
 * One slice of a project's work fingerprint: what kind of files built it.
 *
 * The same vocabulary the live activity uses, derived from file extensions, so a
 * finished project reads as the same shape a person watched being made.
 */
export interface FingerprintSlice {
  /** A capability id, shared with the skill catalog and the live activity. */
  readonly skill: string
  /** Roughly how much of the project this kind of file is, 0–1. */
  readonly share: number
}

/** Category of one file path, for the fingerprint. Kept small and local. */
function skillOfPath(path: string): string {
  const lower = path.toLowerCase()
  if (/\.(dxf|stl|step|obj|geo)$/.test(lower) || /geometry|vector|flower|shader/.test(lower)) return 'geometry'
  if (/\.(csv|tsv)$/.test(lower) || /dashboard|chart|report/.test(lower)) return 'dashboard'
  if (/\.(tsx|jsx|html|css)$/.test(lower)) return 'web-app'
  if (/\.(py|sh|ps1)$/.test(lower)) return 'scripting'
  if (/\.(test|spec)\./.test(lower)) return 'testing'
  if (/\.(md|tex)$/.test(lower) || /readme|resume|invoice|spec/.test(lower)) return 'docs'
  if (/scan|inventory|cambium/.test(lower)) return 'scanner'
  if (/api|server|route|endpoint/.test(lower)) return 'service'
  return 'general'
}

/**
 * Build a project's fingerprint from its manifest.
 * @param manifest - the stored file list.
 * @returns up to four slices, biggest first.
 */
function fingerprintOf(manifest: readonly { path: string }[]): FingerprintSlice[] {
  if (manifest.length === 0) return []
  const counts = new Map<string, number>()
  for (const file of manifest) {
    const skill = skillOfPath(file.path)
    counts.set(skill, (counts.get(skill) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([skill, files]) => ({ skill, share: files / manifest.length }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4)
}

/** A project's metadata, without file bytes. */
export interface ProjectSummary {
  readonly id: string
  readonly owner: string
  readonly name: string
  readonly shape: string
  readonly status: ProjectStatus
  readonly visibility: ProjectVisibility
  readonly entry: string
  readonly files: number
  readonly bytes: number
  /** What kinds of files built it — the same vocabulary the live activity uses. */
  readonly fingerprint: readonly FingerprintSlice[]
  readonly createdAt: number
  readonly updatedAt: number
}

/** Everything needed to render a project. */
export interface ProjectDetail extends ProjectSummary {
  readonly contents: readonly ProjectFile[]
}

/** Whether the layers a project needs are both configured. */
export function projectsConfigured(): boolean {
  return storeConfigured() && r2Configured()
}

/** Object key for one project file. */
function keyOf(id: string, path: string): string {
  return `projects/${id}/${path}`
}

/** Map a database row to a summary. */
function toSummary(row: Record<string, unknown>): ProjectSummary {
  const manifest = (typeof row['manifest'] === 'string' ? JSON.parse(row['manifest']) : row['manifest']) as unknown
  const paths = Array.isArray(manifest)
    ? manifest.flatMap((item) => {
        const path = (item as { path?: unknown }).path
        return typeof path === 'string' ? [{ path }] : []
      })
    : []
  const files = paths.length
  return {
    id: String(row['id']),
    owner: String(row['owner']),
    name: String(row['name']),
    shape: String(row['shape']),
    status: String(row['status']) as ProjectStatus,
    visibility: (String(row['visibility'] ?? 'private') === 'shelf' ? 'shelf' : 'private'),
    entry: String(row['entry'] ?? ''),
    files,
    bytes: Number(row['bytes'] ?? 0),
    fingerprint: fingerprintOf(paths),
    createdAt: Date.parse(String(row['created_at'] ?? '')) || Date.now(),
    updatedAt: Date.parse(String(row['updated_at'] ?? '')) || Date.now(),
  }
}

/**
 * Create a project and store its files.
 * @param input - owner, name, shape, entry and the files to store.
 * @returns the stored summary, or undefined when storage is not configured.
 */
export async function createProject(input: {
  readonly owner: string
  readonly name: string
  readonly shape: string
  readonly entry: string
  readonly files: readonly ProjectFile[]
  readonly origin?: string
  readonly status?: ProjectStatus
  readonly visibility?: ProjectVisibility
}): Promise<ProjectSummary | undefined> {
  if (!projectsConfigured()) return undefined
  const id = `p-${randomUUID()}`
  const manifest: Array<{ path: string; size: number }> = []
  let bytes = 0
  for (const file of input.files) {
    const stored = await putObject(keyOf(id, file.path), file.content)
    if (!stored) continue
    const size = Buffer.byteLength(file.content)
    manifest.push({ path: file.path, size })
    bytes += size
  }
  if (manifest.length === 0) return undefined
  const status = input.status ?? 'active'
  const visibility = input.visibility ?? 'private'
  await runSql(`
    INSERT INTO one_turn_projects (id, owner, name, shape, status, entry, manifest, bytes, origin, visibility)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
  `, [id, input.owner, input.name, input.shape, status, input.entry, JSON.stringify(manifest), bytes, input.origin ?? null, visibility])
  return {
    id, owner: input.owner, name: input.name, shape: input.shape, status, visibility, entry: input.entry,
    files: manifest.length, bytes,
    fingerprint: fingerprintOf(manifest.map(item => ({ path: item.path }))),
    createdAt: Date.now(), updatedAt: Date.now(),
  }
}

/**
 * List one person's projects, newest first.
 * @param owner - the owner id.
 * @param includeDeleted - whether deleted projects appear (default false).
 * @returns the summaries.
 */
export async function listProjects(owner: string, includeDeleted = false): Promise<ProjectSummary[]> {
  if (!storeConfigured()) return []
  const rows = await runSql<Record<string, unknown>>(
    `SELECT * FROM one_turn_projects WHERE owner = $1 ${includeDeleted ? '' : "AND status <> 'deleted'"}
     ORDER BY updated_at DESC LIMIT 100`, [owner])
  return rows.map(toSummary)
}

/**
 * The shared shelf: projects their owners chose to offer.
 * @returns summaries ordered by most recently offered.
 */
export async function shelf(): Promise<ProjectSummary[]> {
  if (!storeConfigured()) return []
  const rows = await runSql<Record<string, unknown>>(
    "SELECT * FROM one_turn_projects WHERE status = 'adoptable' AND visibility = 'shelf' ORDER BY updated_at DESC LIMIT 100")
  return rows.map(toSummary)
}

/**
 * Read one project with its file contents.
 * @param id - the project id.
 * @returns the project, or undefined when it is missing or unreadable.
 */
export async function readProject(id: string): Promise<ProjectDetail | undefined> {
  if (!projectsConfigured()) return undefined
  const rows = await runSql<Record<string, unknown>>('SELECT * FROM one_turn_projects WHERE id = $1', [id])
  const row = rows[0]
  if (row === undefined) return undefined
  const summary = toSummary(row)
  const manifest = (typeof row['manifest'] === 'string' ? JSON.parse(row['manifest']) : row['manifest']) as unknown
  const paths = Array.isArray(manifest)
    ? manifest.flatMap(entry => {
        const item = entry as { path?: unknown }
        return typeof item.path === 'string' ? [item.path] : []
      })
    : []
  const contents: ProjectFile[] = []
  for (const path of paths) {
    const content = await getObject(keyOf(id, path))
    if (content !== undefined) contents.push({ path, content })
  }
  return { ...summary, contents }
}

/**
 * Replace a project's files.
 * @param id - the project id.
 * @param owner - the caller, who must own it.
 * @param files - the new file set.
 * @returns the updated summary, or undefined when not owned or not found.
 */
export async function saveProjectFiles(
  id: string,
  owner: string,
  files: readonly ProjectFile[],
): Promise<ProjectSummary | undefined> {
  if (!projectsConfigured()) return undefined
  const rows = await runSql<Record<string, unknown>>('SELECT owner FROM one_turn_projects WHERE id = $1', [id])
  if (rows[0] === undefined || String(rows[0]['owner']) !== owner) return undefined
  const manifest: Array<{ path: string; size: number }> = []
  let bytes = 0
  for (const file of files) {
    const stored = await putObject(keyOf(id, file.path), file.content)
    if (!stored) continue
    const size = Buffer.byteLength(file.content)
    manifest.push({ path: file.path, size })
    bytes += size
  }
  await runSql(
    'UPDATE one_turn_projects SET manifest = $2::jsonb, bytes = $3, updated_at = now() WHERE id = $1',
    [id, JSON.stringify(manifest), bytes])
  const updated = await runSql<Record<string, unknown>>('SELECT * FROM one_turn_projects WHERE id = $1', [id])
  return updated[0] === undefined ? undefined : toSummary(updated[0])
}

/**
 * Change a project's status, on the owner's authority.
 * @param id - the project id.
 * @param owner - the caller, who must own it.
 * @param status - the new status.
 * @returns whether it changed.
 */
/**
 * Publish a project to the shelf, or take it back.
 *
 * Imported repositories start private and stay private until this is called: a
 * public site must never publish someone's code because a checkbox defaulted to
 * yes. Publishing is one deliberate action, and it is reversible.
 * @param id - the project id.
 * @param owner - the caller, who must own it.
 * @param visibility - 'shelf' to offer it, 'private' to withdraw it.
 * @returns whether it changed.
 */
export async function setProjectVisibility(
  id: string,
  owner: string,
  visibility: ProjectVisibility,
): Promise<boolean> {
  if (!storeConfigured()) return false
  const rows = await runSql<{ id: string }>(
    'UPDATE one_turn_projects SET visibility = $2, updated_at = now() WHERE id = $1 AND owner = $3 RETURNING id',
    [id, visibility, owner])
  return rows.length > 0
}

export async function setProjectStatus(id: string, owner: string, status: ProjectStatus): Promise<boolean> {
  if (!storeConfigured()) return false
  const rows = await runSql<{ id: string }>(
    "UPDATE one_turn_projects SET status = $2, updated_at = now() WHERE id = $1 AND owner = $3 RETURNING id",
    [id, status, owner])
  return rows.length > 0
}

/**
 * Adopt an offered project: a copy becomes the adopter's, and the original stays
 * on the shelf for everyone else.
 * @param id - the project to adopt.
 * @param adopter - the new owner.
 * @returns the new project's summary, or undefined when it was not adoptable.
 */
export async function adoptProject(id: string, adopter: string): Promise<ProjectSummary | undefined> {
  if (!projectsConfigured()) return undefined
  const rows = await runSql<Record<string, unknown>>("SELECT * FROM one_turn_projects WHERE id = $1 AND status = 'adoptable'", [id])
  const row = rows[0]
  if (row === undefined) return undefined
  const detail = await readProject(id)
  if (detail === undefined || detail.contents.length === 0) return undefined
  return createProject({
    owner: adopter,
    name: `${detail.name} (adopted)`,
    shape: detail.shape,
    entry: detail.entry,
    files: detail.contents,
    origin: `adopt:${id}`,
    status: 'active',
  })
}

/**
 * Delete a project's files and mark its row deleted. Recoverable by an operator
 * (the row keeps the manifest) but gone for the person who asked.
 * @param id - the project id.
 * @param owner - the caller, who must own it.
 * @returns whether it was deleted.
 */
export async function deleteProject(id: string, owner: string): Promise<boolean> {
  if (!projectsConfigured()) return false
  const changed = await setProjectStatus(id, owner, 'deleted')
  if (!changed) return false
  const keys = await listObjects(`projects/${id}/`, 200)
  for (const key of keys) await deleteObject(key)
  return true
}

/** Total storage used by one person, for the honest limits page. */
export async function usageOf(owner: string): Promise<{ projects: number; bytes: number }> {
  if (!storeConfigured()) return { projects: 0, bytes: 0 }
  const rows = await runSql<{ projects: number; bytes: number }>(
    "SELECT count(*)::int AS projects, coalesce(sum(bytes),0)::int AS bytes FROM one_turn_projects WHERE owner = $1 AND status <> 'deleted'",
    [owner])
  return { projects: Number(rows[0]?.projects ?? 0), bytes: Number(rows[0]?.bytes ?? 0) }
}
