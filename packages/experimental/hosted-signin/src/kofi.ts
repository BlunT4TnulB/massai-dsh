/**
 * Ko-fi webhook: a coffee becomes an allowance without anyone typing anything.
 *
 * Ko-fi posts `application/x-www-form-urlencoded` with a single `data` field
 * holding JSON. The `verification_token` in that payload is the only
 * authentication available, so it is compared against the environment before a
 * single dollar is credited.
 *
 * Who gets the credit: the supporter is asked to put their Massai id in the note
 * (the `/me` page shows it). The note is searched for a `guest-…` id first, then
 * an email is used as a stable key, and anything unmatched is stored under
 * `unmatched:<transaction>` so the owner can assign it by hand at `/admin`.
 *
 * @module @deepseek-ai/dsh-hosted-signin/kofi
 */

import { grantCredit } from './persistence.ts'

/** The subset of Ko-fi's donation payload this deployment cares about. */
export interface KoFiEvent {
  verification_token?: string
  type?: string
  amount?: string
  currency?: string
  from_name?: string | null
  message?: string | null
  email?: string | null
  kofi_transaction_id?: string
  message_id?: string
  timestamp?: string
}

/** What the handler decided, so the caller can log or answer honestly. */
export interface KoFiOutcome {
  accepted: boolean
  reason?: string
  credited?: string
  usd?: number
}

/** The configured verification token, or an empty string when unset. */
export function koFiToken(): string {
  return (process.env.KO_FI_VERIFICATION_TOKEN ?? '').trim()
}

/**
 * Extract the Ko-fi event from whichever body shape arrives.
 * @param raw - the request body as text.
 * @param contentType - the request's content type.
 * @returns the parsed event, or undefined when the body is not a Ko-fi delivery.
 */
export function parseKoFiBody(raw: string, contentType: string): KoFiEvent | undefined {
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw)
      const data = params.get('data')
      if (data === null) return undefined
      return JSON.parse(data) as KoFiEvent
    }
    return JSON.parse(raw) as KoFiEvent
  } catch {
    return undefined
  }
}

/**
 * Find who a donation belongs to.
 * @param event - the Ko-fi payload.
 * @returns the account key to credit.
 */
export function beneficiaryOf(event: KoFiEvent): string {
  const note = `${event.message ?? ''} ${event.email ?? ''}`
  const guest = /(guest-[0-9a-f-]{8,})/i.exec(note)
  if (guest !== null && guest[1] !== undefined) return guest[1]
  const email = (event.email ?? '').trim().toLowerCase()
  if (email !== '') return `email:${email}`
  const tx = event.kofi_transaction_id ?? event.message_id ?? 'unknown'
  return `unmatched:${tx}`
}

/**
 * Decide and apply one delivery.
 *
 * Only `Donation` is credited here. Subscriptions and shop orders are reported
 * back untouched, because they are a different legal animal (see PAYMENTS.md) and
 * should not silently become prepaid credit.
 * @param event - the parsed payload.
 * @param now - injectable clock.
 * @returns the outcome, for the response body and the log.
 */
export async function applyKoFiEvent(event: KoFiEvent, now = Date.now()): Promise<KoFiOutcome> {
  const expected = koFiToken()
  if (expected === '') return { accepted: false, reason: 'KO_FI_VERIFICATION_TOKEN is not configured' }
  if ((event.verification_token ?? '') !== expected) return { accepted: false, reason: 'bad verification token' }
  if ((event.type ?? '') !== 'Donation') {
    return { accepted: true, reason: `ignored type ${event.type ?? 'unknown'} — only Donation is credited` }
  }
  const amount = Number(event.amount ?? '0')
  if (!Number.isFinite(amount) || amount <= 0) return { accepted: false, reason: 'amount is not a positive number' }
  const who = beneficiaryOf(event)
  const note = `ko-fi ${event.kofi_transaction_id ?? ''} ${event.currency ?? ''} ${event.from_name ?? 'anonymous'}`.trim()
  await grantCredit(who, amount, note.slice(0, 120))
  void now
  return { accepted: true, credited: who, usd: amount }
}
