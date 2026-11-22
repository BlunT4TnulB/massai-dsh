/**
 * Regional gating for the free Gemini tier.
 *
 * Google's Gemini API terms require **paid** services when an API client is made
 * available to users in the European Economic Area, the United Kingdom or
 * Switzerland. Serving the free tier to those regions is therefore a terms
 * breach, not a preference — so the free route is refused there and the request
 * falls back to a provider whose terms do not care where you are.
 *
 * The country comes from a proxy header (`cf-ipcountry`, `x-vercel-ip-country`,
 * or a generic `x-geo-country`). Without one, the request is treated as
 * **unknown**, and unknown is allowed: refusing the whole world because we cannot
 * see a header would break the product for everyone, while the exposure of an
 * unknown visitor is the same as any other non-EEA visitor.
 *
 * @module @deepseek-ai/dsh-hosted-signin/geo
 */

import type { IncomingMessage } from 'node:http'

/**
 * Countries where the free Gemini tier may not be offered: the EEA (EU 27 plus
 * Iceland, Liechtenstein and Norway), the United Kingdom, and Switzerland.
 */
export const FREE_GEMINI_BLOCKED: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
  'GB', // United Kingdom
  'CH', // Switzerland
])

/** Providers whose *free* tier may not be served into the blocked regions. */
export const REGION_GATED_PROVIDERS: ReadonlySet<string> = new Set(['google'])

/**
 * Read the visitor's country from the request headers a proxy may add.
 * @param req - the incoming request.
 * @returns a two-letter country code, or '' when nothing trustworthy is present.
 */
export function countryOf(req: IncomingMessage): string {
  const read = (name: string): string => {
    const value = req.headers[name]
    const raw = Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
    return raw.trim().toUpperCase()
  }
  for (const header of ['cf-ipcountry', 'x-vercel-ip-country', 'x-geo-country', 'x-country']) {
    const code = read(header)
    if (/^[A-Z]{2}$/.test(code)) return code
  }
  return ''
}

/**
 * Whether an unknown country counts as blocked.
 *
 * Once the site sits behind a proxy that always supplies the header, an unknown
 * country means the visitor bypassed the proxy (or the header was stripped) — and
 * that is exactly the traffic the gate exists to catch. `DSH_GEO_STRICT=1` turns
 * that on: fail closed rather than serve the free tier to whoever dodged the
 * proxy. Off by default, because with no proxy nothing would work.
 */
export function geoStrict(): boolean {
  return (process.env.DSH_GEO_STRICT ?? '') === '1'
}

/**
 * May this visitor be offered the free Gemini route?
 * @param country - two-letter code, or '' when unknown.
 * @returns false for a known blocked region, and for unknown regions in strict mode.
 */
export function freeGeminiAllowed(country: string): boolean {
  if (country === '') return !geoStrict()
  return !FREE_GEMINI_BLOCKED.has(country)
}

/**
 * Country per session owner, remembered at mint time.
 *
 * The session cookie carries a user id and nothing else, and model calls are made
 * by the server rather than the browser, so the visitor's country has to be
 * captured when the session is handed out and looked up when a model is chosen.
 * In memory is right for now: sessions are per process already, and a redeploy
 * logs everyone out anyway.
 */
const countryByUser = new Map<string, string>()

/**
 * Remember where a session owner is.
 * @param userId - the id baked into their cookie.
 * @param country - their two-letter country, or '' when unknown.
 */
export function rememberCountry(userId: string, country: string): void {
  countryByUser.set(userId, country)
}

/**
 * Look up where a session owner is.
 * @param userId - the id from the session.
 * @returns the country code, or '' when never seen.
 */
export function countryForUser(userId: string): string {
  return countryByUser.get(userId) ?? ''
}
