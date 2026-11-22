/**
 * Guest abuse control.
 *
 * The guest preview is a cookie holding `guest-<uuid>`, which means the allowance
 * is only as fixed as the visitor's cookie jar: clear it, get a new identity, get
 * a new allowance. That is a real hole and the owner spotted it immediately.
 *
 * The fix is not to make the cookie forge-proof — it cannot be — but to stop
 * treating the cookie as the budget key. Two cheap, durable counters that survive
 * a cookie reset:
 *
 *   - **per visitor-derived key** (`sha256(ip + user-agent)`), so a new cookie
 *     from the same browser and network lands in the same bucket;
 *   - **per day**, so the bucket empties on its own and a shared network is not
 *     punished forever.
 *
 * A visitor can still change network or user agent. That is why this is the second
 * line of defence and not the first: `DSH_MONTHLY_BUDGET_USD` is the ceiling that
 * no amount of identity shuffling can raise.
 *
 * @module @deepseek-ai/dsh-hosted-signin/abuse
 */

import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { databaseConfigured } from './persistence.ts'

/** The turnstile: how many guest sessions one key may open per day. */
export function sessionLimit(): number {
  const raw = Number(process.env.DSH_GUEST_SESSIONS_PER_DAY ?? '')
  return Number.isFinite(raw) && raw > 0 ? raw : 3
}

/** The bucket's day, in UTC, so counters roll over predictably. */
export function dayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

/**
 * Derive the durable guest key for a request: a hash of the client address and
 * user agent. The raw values are never stored — only the digest — so this counts
 * without keeping a log of who is where.
 * @param req - the incoming request.
 * @returns a short stable key, or `unknown` when the request carries neither.
 */
export function guestKeyOf(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const address = (Array.isArray(forwarded) ? forwarded[0] : forwarded ?? '')
    .split(',')[0]
    ?.trim() ?? ''
  const agent = String(req.headers['user-agent'] ?? '')
  const material = `${address}|${agent}`
  if (address === '' && agent === '') return 'unknown'
  return createHash('sha256').update(material).digest('hex').slice(0, 32)
}

/** In-process counters, used when no database is configured. */
const memory = new Map<string, { day: string; count: number }>()

/**
 * Count one more guest session for a key, and say whether it is allowed.
 * @param key - from {@link guestKeyOf}.
 * @param now - injectable clock.
 * @returns whether this session may open, and how many are left afterwards.
 */
export async function admitGuestSession(
  key: string,
  now = Date.now(),
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = sessionLimit()
  const day = dayKey(now)
  if (!databaseConfigured()) {
    const entry = memory.get(key)
    const count = entry?.day === day ? entry.count : 0
    memory.set(key, { day, count: count + 1 })
    return { allowed: count < limit, used: count + 1, limit }
  }
  const { bumpGuestCounter } = await import('./persistence.ts')
  const used = await bumpGuestCounter(key, day)
  return { allowed: used <= limit, used, limit }
}
