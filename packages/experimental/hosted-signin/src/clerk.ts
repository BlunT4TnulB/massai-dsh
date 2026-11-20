/**
 * Clerk session verification with no backend credential: the publishable key
 * names the Frontend API host, whose JWKS verifies each session JWT (RS256).
 * The verified `sub` becomes the durable per-user identity for hosted keys.
 *
 * @module @deepseek-ai/dsh-hosted-signin/clerk
 */

import { createPublicKey, verify as verifySignature } from 'node:crypto'

/** One verification outcome. */
export interface ClerkSession {
  /** Clerk user id (`sub`) — stable across deploys and devices. */
  userId: string
  /** Clerk session id (`sid`), useful for revocation/debugging. */
  sessionId: string
  /** Session expiry (ms since epoch). */
  expiresAt: number
}

/** Cached JWKS keyed by frontend API host. */
const jwksCache = new Map<string, { keys: Map<string, ReturnType<typeof createPublicKey>>; at: number }>()
/** How long a fetched key set stays fresh. */
const JWKS_TTL_MS = 10 * 60 * 1000

/**
 * Decode the Frontend API host out of a Clerk publishable key.
 * @param publishableKey - `pk_test_…` / `pk_live_…`.
 * @returns the host, or undefined when the key is malformed.
 */
export function frontendApiOf(publishableKey: string | undefined): string | undefined {
  if (publishableKey === undefined) return undefined
  const body = publishableKey.replace(/^pk_(test|live)_/, '')
  if (body === publishableKey) return undefined
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8')
    const host = decoded.replace(/\$+$/, '').trim()
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? host : undefined
  } catch {
    return undefined
  }
}

/** Fetch (and cache) the signing keys for one instance. */
async function keysFor(host: string): Promise<Map<string, ReturnType<typeof createPublicKey>>> {
  const hit = jwksCache.get(host)
  if (hit !== undefined && Date.now() - hit.at < JWKS_TTL_MS) return hit.keys
  const response = await fetch(`https://${host}/.well-known/jwks.json`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`clerk: JWKS request failed (${String(response.status)})`)
  const body = await response.json() as { keys?: Array<Record<string, unknown>> }
  const keys = new Map<string, ReturnType<typeof createPublicKey>>()
  for (const jwk of body.keys ?? []) {
    const kid = typeof jwk.kid === 'string' ? jwk.kid : undefined
    if (kid === undefined) continue
    try {
      keys.set(kid, createPublicKey({ key: jwk as never, format: 'jwk' }))
    } catch {
      /* an unreadable key simply stops verifying its own tokens */
    }
  }
  jwksCache.set(host, { keys, at: Date.now() })
  return keys
}

/**
 * Verify one Clerk session JWT.
 * @param token - the `__session` JWT from the browser.
 * @param host - Frontend API host from the publishable key.
 * @returns the verified session, or undefined when the token is invalid.
 */
export async function verifyClerkSession(token: string, host: string): Promise<ClerkSession | undefined> {
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  let header: { kid?: string; alg?: string }
  let payload: { sub?: string; sid?: string; iss?: string; exp?: number; nbf?: number }
  try {
    header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString('utf8')) as typeof header
    payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as typeof payload
  } catch {
    return undefined
  }
  if (header.alg !== 'RS256' || header.kid === undefined) return undefined
  if (typeof payload.iss !== 'string' || !payload.iss.includes(host)) return undefined
  if (typeof payload.sub !== 'string' || payload.sub === '') return undefined
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp <= now) return undefined
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return undefined
  const keys = await keysFor(host)
  const key = keys.get(header.kid)
  if (key === undefined) return undefined
  const ok = verifySignature('RSA-SHA256',
    Buffer.from(`${parts[0] ?? ''}.${parts[1] ?? ''}`),
    key,
    Buffer.from(parts[2] ?? '', 'base64url'))
  if (!ok) return undefined
  return {
    userId: payload.sub,
    sessionId: typeof payload.sid === 'string' ? payload.sid : '',
    expiresAt: (payload.exp ?? 0) * 1000,
  }
}
