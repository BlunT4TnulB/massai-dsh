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


/** What a lookup found, and where it came from. */
export interface Reference {
  readonly title: string
  readonly extract: string
  readonly url: string
}

/** Cached lookups, because a person often asks twice. */
const refCache = new Map<string, { at: number; value: Reference | undefined }>()

/**
 * Look a question up on Wikipedia, which is free, public, and honest about being a
 * source. No key, no tracking of the person asking, and the answer names where it came
 * from — a mind that cites is more useful than one that sounds certain.
 * @param question - what was asked.
 * @returns the summary, or undefined when nothing useful was found or the line failed.
 */
export async function referenceFor(question: string): Promise<Reference | undefined> {
  const key = question.toLowerCase().slice(0, 120)
  const hit = refCache.get(key)
  if (hit !== undefined && Date.now() - hit.at < 300_000) return hit.value
  const remember = (value: Reference | undefined): Reference | undefined => {
    refCache.set(key, { at: Date.now(), value })
    if (refCache.size > 200) { const first = refCache.keys().next(); if (!first.done) refCache.delete(first.value) }
    return value
  }
  /** Words worth searching for: the nouns, not the grammar around them. */
  const STOP = new Set(['what', 'which', 'when', 'where', 'who', 'whom', 'whose', 'why', 'how', 'the', 'a', 'an',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'can', 'could', 'should', 'would',
    'will', 'shall', 'may', 'might', 'must', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'and', 'or',
    'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our',
    'you', 'your', 'he', 'she', 'they', 'them', 'there', 'here', 'best', 'good', 'way', 'ways', 'much', 'many',
    'keep', 'make', 'get', 'got', 'use', 'used', 'really', 'actually', 'honestly', 'please', 'tell', 'know'])
  const wordsOf = (text: string): string[] => text.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 2 && !STOP.has(word))
  const queryWords = wordsOf(question)
  const query = queryWords.length > 0 ? queryWords.slice(0, 8).join(' ') : question.slice(0, 120)
  /** How much a candidate title shares with the question's own words. */
  const overlap = (title: string): number => {
    const titleWords = new Set(wordsOf(title))
    return queryWords.filter(word => titleWords.has(word) || title.toLowerCase().includes(word)).length
  }
  try {
    const searchUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch='
      + encodeURIComponent(query)
    const search = await fetch(searchUrl, {
      headers: { 'user-agent': 'Massai/1.0 (a small workshop; contact: the operator)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!search.ok) return remember(undefined)
    const body = await search.json() as { query?: { search?: Array<{ title?: string; snippet?: string }> } }
    // A lookup that answers a different question is worse than no lookup: it makes the
    // answer sound researched while the source is wrong. So a candidate has to share at
    // least one meaningful word with the question, or it is not used at all.
    const candidates = (body.query?.search ?? []).filter(item => typeof item.title === 'string')
    const chosen = candidates.find(item => overlap(String(item.title)) > 0)
    const title = chosen?.title
    if (title === undefined || title === '') return remember(undefined)
    const summaryUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))
    const summary = await fetch(summaryUrl, {
      headers: { 'user-agent': 'Massai/1.0 (a small workshop; contact: the operator)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!summary.ok) return remember(undefined)
    const page = await summary.json() as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } }
    const extract = String(page.extract ?? '').slice(0, 900).trim()
    if (extract === '') return remember(undefined)
    return remember({
      title: String(page.title ?? title),
      extract,
      url: String(page.content_urls?.desktop?.page ?? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'))),
    })
  } catch {
    return remember(undefined)
  }
}
