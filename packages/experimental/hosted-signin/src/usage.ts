/**
 * Usage analytics and the rate card.
 *
 * Every session log records one `TokenUsage` per assistant message with the
 * event time, so the timeline below is measured, not estimated: token counts are
 * real, and only the money is derived (from published DeepSeek rates, including
 * their off-peak discount window).
 *
 * @module @deepseek-ai/dsh-hosted-signin/usage
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

/** One measured request. */
export interface UsagePoint {
  /** Epoch ms of the assistant message. */
  at: number
  /** Session that produced it. */
  session: string
  /** Prompt tokens sent (cache miss). */
  input: number
  /** Tokens served from the provider cache. */
  cacheRead: number
  /** Tokens written to the provider cache. */
  cacheWrite: number
  /** Completion tokens generated. */
  output: number
}

/** Session rollup. */
export interface SessionUsage {
  session: string
  requests: number
  input: number
  output: number
  cacheRead: number
  first: number
  last: number
}

/** Published DeepSeek rates, US dollars per million tokens. */
export interface RateSet {
  /** Name for display. */
  label: string
  /** Cache-miss prompt tokens. */
  inputMiss: number
  /** Cache-hit prompt tokens. */
  inputHit: number
  /** Completion tokens. */
  output: number
  /** Off-peak multiplier (e.g. 0.5 = half price). */
  offPeakMultiplier: number
}

/**
 * Rates are published by DeepSeek and change; keep one table so a change is a
 * one-line edit. Verify against platform.deepseek.com before trusting a figure.
 */
export const RATES: readonly RateSet[] = [
  { label: 'deepseek-chat', inputMiss: 0.27, inputHit: 0.07, output: 1.1, offPeakMultiplier: 0.5 },
  { label: 'deepseek-reasoner', inputMiss: 0.55, inputHit: 0.14, output: 2.19, offPeakMultiplier: 0.25 },
]

/** DeepSeek's off-peak window in UTC ([startHour, endHour) with a midnight wrap). */
export const OFF_PEAK_UTC: readonly [number, number] = [16.5, 0.5]

/**
 * Whether an instant falls in the off-peak (discounted) window.
 * @param at - epoch ms.
 * @returns true inside the discount window.
 */
export function isOffPeak(at: number): boolean {
  const hour = new Date(at).getUTCHours() + new Date(at).getUTCMinutes() / 60
  const [start, end] = OFF_PEAK_UTC
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

/**
 * Estimated cost for one point under a rate set.
 * @param point - measured usage.
 * @param rate - rate set to price with.
 * @returns US dollars.
 */
export function costOf(point: UsagePoint, rate: RateSet): number {
  const millions = 1_000_000
  const base = (point.input / millions) * rate.inputMiss
    + (point.cacheRead / millions) * rate.inputHit
    + (point.output / millions) * rate.output
  return base * (isOffPeak(point.at) ? rate.offPeakMultiplier : 1)
}

/** Where session logs live. */
function sessionsRoot(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'sessions')
}

/**
 * Read every session log beneath the harness home.
 * @param maxFiles - safety cap on how many logs to open.
 * @returns measured points sorted by time.
 */
export function readUsage(maxFiles = 400): UsagePoint[] {
  const root = sessionsRoot()
  if (!existsSync(root)) return []
  const points: UsagePoint[] = []
  let files = 0
  const walk = (dir: string, depth: number): void => {
    if (depth > 3 || files >= maxFiles) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (files >= maxFiles) return
      const full = join(dir, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(full, depth + 1)
        continue
      }
      if (!/^session\..*\.jsonl(\.zstd)?$/.test(name)) continue
      files += 1
      let text: string
      try {
        const raw = readFileSync(full)
        text = name.endsWith('.zstd')
          ? zstdDecompressSync(raw).toString('utf8')
          : raw.toString('utf8')
      } catch {
        continue
      }
      const session = name.replace(/^session\./, '').replace(/\.jsonl(\.zstd)?$/, '')
      for (const line of text.split('\n')) {
        if (line === '' || !line.includes('"usage"')) continue
        try {
          const event = JSON.parse(line) as {
            type?: string
            time?: number
            data?: { usage?: Partial<Record<'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens', number>> }
          }
          const usage = event.data?.usage
          if (usage === undefined) continue
          points.push({
            at: event.time ?? 0,
            session,
            input: usage.inputTokens ?? 0,
            output: usage.outputTokens ?? 0,
            cacheRead: usage.cacheReadTokens ?? 0,
            cacheWrite: usage.cacheWriteTokens ?? 0,
          })
        } catch {
          /* a torn line is skipped, never fatal */
        }
      }
    }
  }
  walk(root, 0)
  return points.filter(p => p.at > 0).sort((a, b) => a.at - b.at)
}

/** Roll points up per session, newest activity first. */
export function bySession(points: readonly UsagePoint[]): SessionUsage[] {
  const map = new Map<string, SessionUsage>()
  for (const point of points) {
    const hit = map.get(point.session)
    if (hit === undefined) {
      map.set(point.session, {
        session: point.session, requests: 1, input: point.input, output: point.output,
        cacheRead: point.cacheRead, first: point.at, last: point.at,
      })
      continue
    }
    hit.requests += 1
    hit.input += point.input
    hit.output += point.output
    hit.cacheRead += point.cacheRead
    hit.first = Math.min(hit.first, point.at)
    hit.last = Math.max(hit.last, point.at)
  }
  return [...map.values()].sort((a, b) => b.last - a.last)
}

/** Bucket points into the last N UTC days. */
export function byDay(points: readonly UsagePoint[], days = 14): Array<{ day: string; input: number; output: number; cost: number }> {
  const buckets = new Map<string, { input: number; output: number; cost: number }>()
  const today = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    buckets.set(date.toISOString().slice(0, 10), { input: 0, output: 0, cost: 0 })
  }
  for (const point of points) {
    const key = new Date(point.at).toISOString().slice(0, 10)
    const bucket = buckets.get(key)
    if (bucket === undefined) continue
    bucket.input += point.input + point.cacheRead
    bucket.output += point.output
    bucket.cost += costOf(point, RATES[0] as RateSet)
  }
  return [...buckets.entries()].map(([day, v]) => ({ day, ...v }))
}

/** Bucket the last N hours. */
export function byHour(points: readonly UsagePoint[], hours = 48): Array<{ hour: number; tokens: number }> {
  const now = Date.now()
  const buckets = new Array<number>(hours).fill(0)
  for (const point of points) {
    const age = Math.floor((now - point.at) / 3_600_000)
    if (age < 0 || age >= hours) continue
    const index = hours - 1 - age
    buckets[index] = (buckets[index] ?? 0) + point.input + point.cacheRead + point.output
  }
  return buckets.map((tokens, index) => ({ hour: index, tokens }))
}

/** Format a token count compactly. */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}
