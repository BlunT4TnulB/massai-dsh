/**
 * Worker relay: lets the hub use a local model that lives behind NAT.
 *
 * A worker cannot accept inbound connections from a datacentre, so it polls the
 * hub instead. The hub exposes an OpenAI-compatible endpoint; a request to it is
 * queued as a job, the worker picks it up on its next poll, runs it against its
 * own local model, and posts the answer back. The waiting HTTP request is held
 * open until the answer arrives or the job times out.
 *
 * @module @deepseek-ai/dsh-hosted-signin/worker-relay
 */

import { randomUUID } from 'node:crypto'

/** One queued or in-flight job. */
export interface RelayJob {
  /** Opaque id handed to the worker. */
  id: string
  /** The OpenAI-shaped request body to forward. */
  body: unknown
  /** When the job was queued (ms since epoch). */
  at: number
  /** Delivers the worker's answer to the waiting caller. */
  settle: (result: { ok: true; body: unknown } | { ok: false; error: string }) => void
  /** Timer that fails the job when the worker never answers. */
  timer: ReturnType<typeof setTimeout>
}

/** Jobs waiting for a poll; the worker takes the oldest. */
const queue: RelayJob[] = []
/** Jobs by id, so a result can find its waiter. */
const waiting = new Map<string, RelayJob>()
/** Long-poll waiters: resolve with a job when one arrives. */
const pollers: Array<(job: RelayJob | undefined) => void> = []
/** When a worker last asked for work (ms since epoch). */
let lastPollAt = 0
/** How recently a worker must have polled to count as connected. */
const CONNECTED_WINDOW_MS = 90_000

/** How long a caller waits for a worker answer once a worker has picked the job up. */
const JOB_TIMEOUT_MS = 180_000
/** How long a queued job waits to be picked up before it is declared workerless. */
const PICKUP_TIMEOUT_MS = 10_000
/** How long a worker poll is held open before answering "nothing yet". */
const POLL_HOLD_MS = 25_000

/**
 * Queue a request and wait for the worker's answer.
 * @param body - OpenAI-shaped chat completion request.
 * @returns the worker's response body.
 * @throws when no worker answers before the timeout.
 */
/**
 * Whether any worker is connected right now: it is polling, or it polled
 * recently enough that its next poll is imminent.
 * @returns true when a worker is available to answer.
 */
export function workerConnected(): boolean {
  return pollers.length > 0 || Date.now() - lastPollAt < CONNECTED_WINDOW_MS
}

export function enqueue(body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = randomUUID()
    // Two-phase timeout: a job nobody picks up means no worker is listening, and
    // the caller should hear that in seconds, not minutes. Once a worker takes
    // it, the real work may legitimately be slow.
    const timer = setTimeout(() => {
      waiting.delete(id)
      const index = queue.findIndex(job => job.id === id)
      if (index >= 0) queue.splice(index, 1)
      reject(new Error('no local worker answered in time'))
    }, PICKUP_TIMEOUT_MS)
    const job: RelayJob = {
      id,
      body,
      at: Date.now(),
      timer,
      settle: (result) => {
        clearTimeout(timer)
        waiting.delete(id)
        if (result.ok) resolve(result.body)
        else reject(new Error(result.error))
      },
    }
    waiting.set(id, job)
    const poller = pollers.shift()
    if (poller !== undefined) {
      markPicked(job)
      poller(job)
    } else {
      queue.push(job)
    }
  })
}

/**
 * Take the next job for a polling worker, waiting briefly for one.
 * @returns the job, or undefined when none arrived.
 */
/** Re-arm a job's timer for the answering phase once a worker takes it. */
function markPicked(job: RelayJob): void {
  clearTimeout(job.timer)
  job.timer = setTimeout(() => {
    waiting.delete(job.id)
    job.settle({ ok: false, error: 'the worker did not finish in time' })
  }, JOB_TIMEOUT_MS)
}

/**
 * Take the next job for a polling worker, waiting briefly for one.
 * @returns the job, or undefined when none arrived.
 */
export function nextJob(): Promise<RelayJob | undefined> {
  lastPollAt = Date.now()
  const queued = queue.shift()
  if (queued !== undefined) {
    markPicked(queued)
    return Promise.resolve(queued)
  }
  return new Promise((resolve) => {
    const finish = (value: RelayJob | undefined): void => {
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      const index = pollers.indexOf(finish)
      if (index >= 0) pollers.splice(index, 1)
      resolve(undefined)
    }, POLL_HOLD_MS)
    pollers.push(finish)
  })
}

/**
 * Deliver a worker's answer to the waiting caller.
 * @param id - job id.
 * @param result - the worker's outcome.
 * @returns whether the job was still waiting.
 */
export function complete(id: string, result: { ok: true; body: unknown } | { ok: false; error: string }): boolean {
  const job = waiting.get(id)
  if (job === undefined) return false
  job.settle(result)
  return true
}

/** Diagnostics for the owner page. */
export function relayStatus(): { queued: number; inFlight: number; pollers: number; connected: boolean } {
  return { queued: queue.length, inFlight: waiting.size, pollers: pollers.length, connected: workerConnected() }
}
