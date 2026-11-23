/**
 * The fuel gauge.
 *
 * DeepSeek's balance is the one number that, when it reaches zero, stops the free
 * preview for everyone. It is also the one number nobody can see from inside the
 * product — so this module reads it, caches it, and writes it where the door can
 * find it.
 *
 * The door is rendered synchronously from the webserver package, which cannot
 * import this one, so the reading is written to a small JSON file that the door
 * reads: one producer, one consumer, no coupling.
 *
 * @module @deepseek-ai/dsh-hosted-signin/billing
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** What the gauge says. */
export interface BalanceReading {
  /** Epoch ms when this reading was taken. */
  at: number
  /** Whether the provider says the key can serve requests at all. */
  available: boolean
  /** Total balance in the account's currency. */
  usd: number
  /** The provider's currency code. */
  currency: string
  /** Set when the read failed, so the console can explain rather than guess. */
  error?: string
}

/** Below this, the door starts warning people. */
export function lowBalanceUsd(): number {
  const raw = Number(process.env.DSH_LOW_BALANCE_USD ?? '')
  return Number.isFinite(raw) && raw >= 0 ? raw : 1
}

/** How long a reading is trusted before another call is worth making. */
const CACHE_MS = 5 * 60 * 1000

/** Where the reading is written for the door to read. */
export function balancePath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'health', 'deepseek-balance.json')
}

/** The last reading taken in this process, so we do not hammer the endpoint. */
let cached: BalanceReading | undefined

/**
 * Read the provider's balance, at most once per five minutes.
 * @param apiKey - the deployment's key.
 * @returns the reading, or a failed reading explaining why.
 */
export async function deepSeekBalance(apiKey: string): Promise<BalanceReading> {
  if (cached !== undefined && Date.now() - cached.at < CACHE_MS) return cached
  if (apiKey === '') {
    cached = { at: Date.now(), available: false, usd: 0, currency: 'USD', error: 'no key configured' }
    return cached
  }
  try {
    const response = await fetch('https://api.deepseek.com/user/balance', {
      headers: { authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) {
      cached = { at: Date.now(), available: false, usd: 0, currency: 'USD', error: `HTTP ${response.status}` }
      return cached
    }
    const body = await response.json() as {
      is_available?: boolean
      balance_infos?: Array<{ currency?: string; total_balance?: string }>
    }
    const info = body.balance_infos?.[0]
    cached = {
      at: Date.now(),
      available: body.is_available === true,
      usd: Number(info?.total_balance ?? '0'),
      currency: info?.currency ?? 'USD',
    }
    return cached
  } catch (error) {
    cached = {
      at: Date.now(), available: false, usd: 0, currency: 'USD',
      error: error instanceof Error ? error.message : String(error),
    }
    return cached
  }
}

/**
 * Publish the reading for the door to read on its next render.
 * @param reading - the reading to write.
 */
export function publishBalance(reading: BalanceReading): void {
  try {
    const path = balancePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(reading), 'utf8')
  } catch {
    /* the gauge is a nicety; a failing disk must not break the app */
  }
}

/**
 * Refresh and publish in one step.
 * @param apiKey - the deployment's key.
 * @returns the fresh reading.
 */
export async function refreshBalance(apiKey: string): Promise<BalanceReading> {
  const reading = await deepSeekBalance(apiKey)
  publishBalance(reading)
  return reading
}

/**
 * Read the published reading without a network call, for the door.
 * @returns the last published reading, or undefined when none exists.
 */
export function publishedBalance(): { available: boolean; usd: number } | undefined {
  try {
    const path = balancePath()
    if (!existsSync(path)) return undefined
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { available?: boolean; usd?: number }
    return { available: parsed.available === true, usd: Number(parsed.usd ?? 0) }
  } catch {
    return undefined
  }
}
