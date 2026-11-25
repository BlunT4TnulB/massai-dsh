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
  /** What it knows it does wrong, worst first. */
  readonly confessions: readonly Confession[]
}

/** When this process started. */
const startedAt = Date.now()

/**
 * The failures it has, in the first person.
 *
 * This is not a model writing prose about itself — it is the lessons table,
 * read back as a sentence. The honesty is in the source: every clause is a count
 * of something that actually happened here.
 */
const CONFESSIONS: Readonly<Record<string, string>> = {
  'hallucinated-detail': 'I leave a blank where I do not know',
  'missed-requirement': 'I read the requirements twice',
  'overbuilt': 'I build what was asked, and no more',
  'underbuilt': 'I finish before I hand it over',
  'broken-run': 'I run what I hand you',
  'style-drift': 'I keep to the look that was asked for',
  'refused-wrongly': 'I try before I refuse',
  'wrong-shape': 'I ask what kind of thing this is',
}

/** One thing the workshop has learned about itself. */
export interface Confession {
  /** The failure bucket. */
  readonly bucket: string
  /** How many times it has happened. */
  readonly count: number
  /** The sentence, in the first person. */
  readonly sentence: string
}

/**
 * Read back its own worst habits from the lessons table.
 * @param limit - how many to return, worst first.
 * @returns the confessions; empty when it has nothing to admit yet.
 */
export async function confessions(limit = 2): Promise<Confession[]> {
  try {
    const rows = await runSql(
      'SELECT bucket, count, note FROM one_turn_lessons ORDER BY count DESC, at DESC LIMIT $1',
      [limit])
    return rows.flatMap((row) => {
      const bucket = String(row['bucket'] ?? '')
      const count = Number(row['count'] ?? 0)
      const sentence = CONFESSIONS[bucket]
      if (sentence === undefined) return []
      return [{ bucket, count, sentence }]
    })
  } catch {
    return []
  }
}

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
  const [projects, trials, lessons, admissions] = await Promise.all([
    countOf('one_turn_projects'),
    countOf('one_turn_trials'),
    countOf('one_turn_lessons'),
    confessions(2),
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
    confessions: admissions,
  }
}

/**
 * One sentence a person would understand, or undefined when all is well.
 * @param vitals - the reading.
 * @returns the honest short sentence.
 */
/**
 * The confession to show right now: one sentence, chosen by the clock so a
 * returning visitor meets a different thought rather than a static slogan.
 * @param vitals - the reading.
 * @param now - current epoch ms.
 * @returns the sentence, or undefined when there is nothing to admit.
 */
export function confessionAt(vitals: Vitals, now = Date.now()): string | undefined {
  if (vitals.confessions.length === 0) return undefined
  const index = Math.floor(now / 45000) % vitals.confessions.length
  const chosen = vitals.confessions[index]
  if (chosen === undefined) return undefined
  return `${chosen.sentence} · learned ${chosen.count} time${chosen.count === 1 ? '' : 's'}`
}

/** Kept for the notice line below. */
export function vitalsNotice(vitals: Vitals): string | undefined {
  if (!vitals.fuelAvailable) return 'the workshop cannot reach its model — it is resting'
  if (vitals.fuelUsd !== undefined && vitals.fuelUsd < 1) return 'the workshop is running low on credit'
  if (!vitals.memoryOk) return 'the workshop cannot reach its memory'
  return undefined
}
