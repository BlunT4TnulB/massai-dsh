/**
 * Who is looking, and what they were last working on.
 *
 * The mind is a public place, but a place is allowed to recognise its visitors. This
 * resolves a verified session cookie to a user id and then finds that user's newest
 * session log to name the project they were last in — nothing else is read, and no
 * content ever leaves the session.
 *
 * Bounded on purpose: a handful of files, a size cap, and a short cache, because the
 * caller is anonymous and this runs on a small instance.
 *
 * @module @deepseek-ai/dsh-hosted-signin/viewer
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import * as zlib from 'node:zlib'

/** The coarse label the mind shows, never the raw id. */
export type ViewerLabel = 'operator' | 'guest' | 'member' | 'stranger'

/** What the mind is told about the person in front of it. */
export interface Viewer {
  readonly label: ViewerLabel
  /** Basename of the project they were last in, when it can be known. */
  readonly project?: string
}

/** Decompression, when this Node build exposes it. */
const unzstd = (zlib as unknown as { zstdDecompressSync?: (input: Buffer) => Buffer }).zstdDecompressSync

/** The label for a user id, with no identifying detail. */
export function labelOf(userId: string | undefined): ViewerLabel {
  if (userId === undefined || userId === '') return 'stranger'
  if (userId.startsWith('guest-')) return 'guest'
  return 'member'
}

let cache: { at: number; byUser: Map<string, string | undefined> } = { at: 0, byUser: new Map() }

/**
 * The project a user was last working in, derived from their newest session log.
 * @param userId - the verified session user.
 * @returns the project directory's name, or undefined when it cannot be known.
 */
export function projectOf(userId: string): string | undefined {
  const now = Date.now()
  if (now - cache.at > 120_000) cache = { at: now, byUser: new Map() }
  if (cache.byUser.has(userId)) return cache.byUser.get(userId)

  const root = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'sessions')
  let answer: string | undefined
  if (existsSync(root) && unzstd !== undefined) {
    const candidates: Array<{ path: string; mtime: number }> = []
    const walk = (dir: string, depth: number): void => {
      if (depth > 3 || candidates.length >= 80) return
      let entries: string[]
      try { entries = readdirSync(dir) } catch { return }
      for (const name of entries) {
        const full = join(dir, name)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) { walk(full, depth + 1); continue }
          if (!/^session\..*\.jsonl(\.zstd)?$/.test(name)) continue
          if (stat.size > 3_000_000) continue
          candidates.push({ path: full, mtime: stat.mtimeMs })
        } catch { /* skip */ }
      }
    }
    walk(root, 0)
    candidates.sort((left, right) => right.mtime - left.mtime)
    for (const candidate of candidates.slice(0, 40)) {
      let text = ''
      try {
        const raw = readFileSync(candidate.path)
        text = candidate.path.endsWith('.zstd') ? unzstd(raw).toString('utf8') : raw.toString('utf8')
      } catch { continue }
      // Only the header record matters; stop at the first one that parses.
      for (const line of text.split('\n', 6)) {
        if (line === '' || !line.includes('"header"')) continue
        try {
          const event = JSON.parse(line) as { type?: string; data?: { header?: { userId?: string; cwd?: string } } }
          const header = event.data?.header
          if (header === undefined || header.userId !== userId) break
          if (typeof header.cwd === 'string' && header.cwd !== '') answer = basename(header.cwd)
          break
        } catch { /* a torn line is skipped */ }
      }
      if (answer !== undefined) break
    }
  }
  cache.byUser.set(userId, answer)
  return answer
}
