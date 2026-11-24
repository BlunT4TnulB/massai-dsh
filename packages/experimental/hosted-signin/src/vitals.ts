/**
 * Vitals: what the workshop knows about its own condition.
 *
 * A presence that only shows other people's work is a window. One that shows its
 * own state — how much fuel is left, whether its memory is reachable, how much it
 * has learned — is a *being*, and it can be honest about being tired.
 *
 * Everything here is measured, nothing is inferred from mood: the fuel comes from
 * the provider's balance endpoint (cached), the memory from the database, the rest
 * from rows this deployment wrote. If a number cannot be read, it is reported as
 * unknown rather than guessed.
 *
 * @module @deepseek-ai/dsh-hosted-signin/vitals
 */

import { deepSeekBalance } from './billing.ts'
import { databaseStatus, runSql } from './persistence.ts'
import { hiveSummary } from './hive.ts'

/** The being's condition, in the smallest useful vocabulary. */
export interface Vitals {
  /** Model credit in USD, or undefined when unreadable. */
  readonly fuelUsd: number | undefined
  /** Whether the provider will answer at all. */
  readonly fuelAvailable: boolean
  /** Whether its memory (the database) is reachable. */
  readonly memoryOk: boolean
  /** Live sessions at work. */
  readonly sessions: number
  /** Projects it is keeping. */
  readonly projects: number
  /** Builds it has attempted. */
  readonly trials: number
  /** Failures it remembers. */
  readonly lessons: number
  /** Seconds since the process started. */
  readonly awakeSeconds: number
}

/** When this process started. */
const startedAt = Date.now()

/** Count rows, tolerating a missing table (older databases) as zero. */
async function countOf(table: string): Promise<number> {
  try {
    const rows = await runSql(`SELECT count(*)::int AS n FROM ${table}`)
    return Number(rows[0]?.['n'] ?? 0)
  } catch {
    return 0
  }
}

/**
 * Read the vitals.
 * @returns the condition, with unknown values left undefined rather than invented.
 */
export async function readVitals(): Promise<Vitals> {
  const key = process.env.DEEPSEEK_API_KEY ?? ''
  const balance = await deepSeekBalance(key).catch(() => undefined)
  const status = await databaseStatus().catch(() => ({ configured: false, ok: false }))
  const [projects, trials, lessons] = await Promise.all([
    countOf('one_turn_projects'),
    countOf('one_turn_trials'),
    countOf('one_turn_lessons'),
  ])
  return {
    fuelUsd: balance === undefined ? undefined : balance.usd,
    fuelAvailable: balance?.available === true,
    memoryOk: (status as { ok?: boolean }).ok === true,
    sessions: hiveSummary().sessions,
    projects,
    trials,
    lessons,
    awakeSeconds: Math.round((Date.now() - startedAt) / 1000),
  }
}

/**
 * One sentence a person would understand, or undefined when all is well.
 * @param vitals - the reading.
 * @returns the honest short sentence.
 */
export function vitalsNotice(vitals: Vitals): string | undefined {
  if (!vitals.fuelAvailable) return 'the workshop cannot reach its model — it is resting'
  if (vitals.fuelUsd !== undefined && vitals.fuelUsd < 1) return 'the workshop is running low on credit'
  if (!vitals.memoryOk) return 'the workshop cannot reach its memory'
  return undefined
}
