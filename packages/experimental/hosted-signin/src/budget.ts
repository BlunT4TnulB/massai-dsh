/**
 * The money gate.
 *
 * The owner absorbs the free tier's cost, so the only thing standing between a
 * shared deployment and a nasty surprise is a hard ceiling and an honest ledger.
 * This module answers two questions and nothing else:
 *
 *   1. how much has this month cost, in total and per person?
 *   2. may this particular user make one more call?
 *
 * Caps come from the environment so they can be changed without a redeploy of
 * any code: `DSH_MONTHLY_BUDGET_USD` for the whole deployment, and
 * `DSH_USER_BUDGET_USD` for any single user (guests included).
 *
 * @module @deepseek-ai/dsh-hosted-signin/budget
 */

import { creditTotal, databaseConfigured, readUsageSince } from './persistence.ts'
import { costOf, rateFor } from './usage.ts'

/** One person's share of the month. */
export interface UserSpend {
  /** `guest-<uuid>`, a Clerk id, or an empty string when unattributed. */
  userId: string
  calls: number
  cost: number
  /** Epoch ms of their most recent call. */
  last: number
}

/** The whole month, plus the cap it is measured against. */
export interface BudgetReport {
  /** Whether a database is configured; without one there is no ledger. */
  tracked: boolean
  /** Month-to-date spend in USD. */
  spent: number
  /** The deployment ceiling, or 0 when unlimited. */
  cap: number
  /** Per-user ceiling, or 0 when unlimited. */
  userCap: number
  /** spent / cap, clamped to 0..1 for a progress bar. */
  ratio: number
  /** The month being measured, `YYYY-MM`. */
  month: string
  /** People, biggest spender first. */
  users: UserSpend[]
}

/** The first instant of the current month, in epoch ms (UTC). */
export function monthStart(now = Date.now()): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

/** The month being measured, `YYYY-MM`. */
export function monthLabel(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7)
}

/** The deployment-wide cap in USD; 0 disables the ceiling. */
export function monthlyCap(): number {
  const raw = Number(process.env.DSH_MONTHLY_BUDGET_USD ?? '')
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

/** The per-user cap in USD; 0 disables the ceiling. */
export function userCap(): number {
  const raw = Number(process.env.DSH_USER_BUDGET_USD ?? '')
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

/**
 * Build the month's ledger from the database.
 * @param now - injectable clock, for tests.
 * @returns the report; zeroes when no database is configured.
 */
export async function budgetReport(now = Date.now()): Promise<BudgetReport> {
  const month = monthLabel(now)
  if (!databaseConfigured()) {
    return { tracked: false, spent: 0, cap: monthlyCap(), userCap: userCap(), ratio: 0, month, users: [] }
  }
  const rows = await readUsageSince(monthStart(now))
  const byUser = new Map<string, UserSpend>()
  for (const row of rows) {
    const key = row.userId === '' ? '(unattributed)' : row.userId
    const entry = byUser.get(key) ?? { userId: key, calls: 0, cost: 0, last: 0 }
    entry.calls += 1
    entry.cost += costOf(row, rateFor(row.model))
    entry.last = Math.max(entry.last, row.at)
    byUser.set(key, entry)
  }
  const users = [...byUser.values()].sort((a, b) => b.cost - a.cost)
  const spent = users.reduce((sum, user) => sum + user.cost, 0)
  const cap = monthlyCap()
  return {
    tracked: true,
    spent,
    cap,
    userCap: userCap(),
    ratio: cap === 0 ? 0 : Math.min(1, spent / cap),
    month,
    users,
  }
}

/** A verdict plus the sentence a person should read. */
export interface BudgetVerdict {
  allowed: boolean
  /** Why not, phrased for a person rather than a log. */
  reason?: string
}

/**
 * Decide whether one more call is affordable.
 * @param userId - the spender.
 * @param now - injectable clock, for tests.
 * @returns allowed, or the reason it is not.
 */
export async function checkBudget(userId: string, now = Date.now()): Promise<BudgetVerdict> {
  const report = await budgetReport(now)
  if (!report.tracked) return { allowed: true }
  if (report.cap > 0 && report.spent >= report.cap) {
    return {
      allowed: false,
      reason: `the workshop's free budget for ${report.month} is spent ($${report.spent.toFixed(2)} of $${report.cap.toFixed(2)}). `
        + 'It resets on the 1st — or you can keep going right now by adding your own key at /access.',
    }
  }
  // A person's ceiling is the shared allowance plus whatever credit they were
  // given: a tip becomes somebody's month, as a thank-you.
  const key = userId === '' ? '(unattributed)' : userId
  const credit = userId === '' ? 0 : await creditTotal(userId).catch(() => 0)
  const ceiling = report.userCap + credit
  if (ceiling > 0) {
    const mine = report.users.find(user => user.userId === key)
    if (mine !== undefined && mine.cost >= ceiling) {
      const extra = credit > 0 ? ` (including $${credit.toFixed(2)} of credit)` : ''
      return {
        allowed: false,
        reason: `your allowance for ${report.month} is used ($${mine.cost.toFixed(2)} of $${ceiling.toFixed(2)}${extra}). `
          + 'Add your own key at /access, or ask for a credit top-up — nothing you built is lost either way.',
      }
    }
  }
  return { allowed: true }
}
