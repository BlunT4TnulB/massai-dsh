/**
 * Online learner for the model router.
 *
 * The router's hand-written thresholds are a cold-start heuristic. This module
 * replaces them with running statistics: every step is bucketed by its signals,
 * its outcome is observed on the next step (did the tool call fail?), and the
 * choice is scored with UCB1 so the router keeps trying the cheaper arm while a
 * bucket is still uncertain and commits once the evidence is clear.
 *
 * State is a small JSON file under the harness home, so learning survives a
 * restart. Nothing here is model-specific: a new tier is just another arm.
 *
 * @module @deepseek-ai/dsh-model-router/learning
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** One arm's running record. */
export interface ArmStats {
  /** Decisions made with this arm. */
  trials: number
  /** Decisions whose following step completed without a tool error. */
  wins: number
}

/** Everything learned for one signal bucket. */
export type BucketStats = Record<string, ArmStats>

/** Persisted learner state. */
export interface LearnerState {
  /** Schema version, so an incompatible file is discarded rather than misread. */
  version: 1
  /** Bucket key → arm id → stats. */
  buckets: Record<string, BucketStats>
  /** Observed steps in total. */
  steps: number
}

/** Signals that decide which bucket a step belongs to. */
export interface Features {
  /** Prompt size band: 0 small, 1 medium, 2 large, 3 huge. */
  size: 0 | 1 | 2 | 3
  /** Whether the newest user message names a hard task. */
  keyword: boolean
  /** Whether the tail of the history is a run of failed tool results. */
  struggling: boolean
}

/** How one step turned out. */
export interface Outcome {
  /** True when the step's tool call errored — the model could not close it. */
  failed: boolean
}

/** Lowest trials before the learner outranks the heuristic. */
const MIN_TRIALS = 3
/** UCB exploration constant. */
const EXPLORATION = Math.SQRT2

/**
 * Bucket key for a feature set.
 * @param features - the step's signals.
 * @returns a stable string key.
 */
export function bucketKey(features: Features): string {
  return `${features.size}|${features.keyword ? 1 : 0}|${features.struggling ? 1 : 0}`
}

/** Where the learner state lives. */
function statePath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'model-router-learning.json')
}

/** Empty state. */
function emptyState(): LearnerState {
  return { version: 1, buckets: {}, steps: 0 }
}

/**
 * Load learner state, discarding anything unreadable.
 * @returns the loaded or empty state.
 */
export function loadState(path: string = statePath()): LearnerState {
  try {
    if (!existsSync(path)) return emptyState()
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<LearnerState>
    if (parsed.version !== 1 || typeof parsed.buckets !== 'object' || parsed.buckets === null) return emptyState()
    return { version: 1, buckets: parsed.buckets, steps: typeof parsed.steps === 'number' ? parsed.steps : 0 }
  } catch {
    return emptyState()
  }
}

/**
 * Persist learner state atomically (write beside, then rename).
 * @param state - state to save.
 * @param path - destination path.
 */
export function saveState(state: LearnerState, path: string = statePath()): void {
  try {
    const temporary = `${path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, JSON.stringify(state), 'utf8')
    renameSync(temporary, path)
  } catch {
    /* learning is an optimisation; failing to persist must never break a step */
  }
}

/**
 * UCB1 score for one arm, with an optimistic prior for untried arms.
 * @param arm - the arm's stats.
 * @param total - decisions made across every arm in the bucket.
 * @returns a score where higher is better.
 */
function ucb(arm: ArmStats | undefined, total: number): number {
  if (arm === undefined || arm.trials === 0) return Number.POSITIVE_INFINITY
  const mean = arm.wins / arm.trials
  return mean + EXPLORATION * Math.sqrt(Math.log(Math.max(total, 1)) / arm.trials)
}

/**
 * Record one observed outcome.
 * @param state - state to mutate.
 * @param features - the step's signals.
 * @param arm - the model id that served it.
 * @param outcome - how the step ended.
 * @returns the mutated state.
 */
export function observe(state: LearnerState, features: Features, arm: string, outcome: Outcome): LearnerState {
  const key = bucketKey(features)
  const bucket = state.buckets[key] ?? {}
  const stats = bucket[arm] ?? { trials: 0, wins: 0 }
  stats.trials += 1
  if (!outcome.failed) stats.wins += 1
  bucket[arm] = stats
  state.buckets[key] = bucket
  state.steps += 1
  return state
}

/**
 * Pick an arm for this bucket once the evidence is good enough to outrank the
 * caller's heuristic.
 * @param state - learned statistics.
 * @param features - the step's signals.
 * @param arms - the candidate model ids, cheapest first.
 * @returns the chosen arm, or undefined when the bucket is too young to trust.
 */
export function choose(state: LearnerState, features: Features, arms: readonly string[]): { arm: string; reason: string } | undefined {
  const bucket = state.buckets[bucketKey(features)]
  if (bucket === undefined) return undefined
  const total = arms.reduce((sum, arm) => sum + (bucket[arm]?.trials ?? 0), 0)
  if (total < MIN_TRIALS * 2) return undefined
  let best: { arm: string; score: number } | undefined
  for (const arm of arms) {
    const score = ucb(bucket[arm], total)
    if (best === undefined || score > best.score) best = { arm, score }
  }
  if (best === undefined || !Number.isFinite(best.score)) return undefined
  const stats = bucket[best.arm]
  if (stats === undefined) return undefined
  const rate = Math.round((stats.wins / stats.trials) * 100)
  return { arm: best.arm, reason: `learned ${best.arm} wins ${String(rate)}% of this kind of step (${String(stats.trials)} tries)` }
}

/**
 * Human-readable summary of what the learner currently believes.
 * @param state - learned statistics.
 * @returns one line per bucket with both arms' records.
 */
export function summarize(state: LearnerState): string[] {
  const lines: string[] = []
  for (const [key, bucket] of Object.entries(state.buckets)) {
    const parts = Object.entries(bucket).map(([arm, stats]) => {
      const rate = stats.trials === 0 ? 0 : Math.round((stats.wins / stats.trials) * 100)
      return `${arm}: ${String(stats.wins)}/${String(stats.trials)} (${String(rate)}%)`
    })
    lines.push(`${key} → ${parts.join(' · ')}`)
  }
  return lines
}
