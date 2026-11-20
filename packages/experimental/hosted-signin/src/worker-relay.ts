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
  /** Only this machine may take the job, when the caller named one. */
  target?: string
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
/** Long-poll waiters: machine name and its resolver. */
const pollers: Array<{ name: string; resolve: (job: RelayJob | undefined) => void }> = []
/** Jobs answered per machine. */
const served = new Map<string, number>()
/** Rotates so an untargeted job does not always land on the same machine. */
let pickCursor = 0
/** Consecutive failures per machine. */
const failures = new Map<string, number>()
/** Machines resting after repeated failures. */
const resting = new Map<string, number>()
/** How long a machine rests after a failure. */
const REST_MS = 120_000
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
  return pollers.some(poller => restingFor(poller.name) === 0)
    || Date.now() - lastPollAt < CONNECTED_WINDOW_MS
}

/**
 * How long this machine should still rest, in ms (0 = available).
 * @param name - machine name.
 * @returns milliseconds remaining in its rest, zero when it may work.
 */
function restingFor(name: string): number {
  const until = resting.get(name) ?? 0
  return Math.max(0, until - Date.now())
}

export function enqueue(body: unknown, target?: string): Promise<unknown> {
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
      ...(target === undefined || target === '' ? {} : { target }),
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
    // Hand the job straight to a waiting worker when one is eligible; a
    // targeted job only goes to the machine it names.
    // Untargeted work rotates through the waiting machines; a named job goes to
    // exactly the machine it asks for.
    const available = pollers.map((poller, index) => ({ poller, index }))
      .filter(entry => restingFor(entry.poller.name) === 0)
    const eligible = job.target === undefined
      ? (available.length > 0 ? available[pickCursor % available.length]?.index ?? -1 : -1)
      : pollers.findIndex(candidate => candidate.name === job.target && restingFor(candidate.name) === 0)
    if (eligible >= 0) {
      pickCursor += 1
      const [poller] = pollers.splice(eligible, 1)
      if (poller !== undefined) {
        markPicked(job)
        poller.resolve(job)
        return
      }
    }
    queue.push(job)
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
export function nextJob(workerName = ''): Promise<RelayJob | undefined> {
  lastPollAt = Date.now()
  const name = workerName.trim()
  // A machine that just failed repeatedly gets no work until it rests.
  if (name !== '' && restingFor(name) > 0) return Promise.resolve(undefined)
  // A named worker may only take untargeted jobs or jobs aimed at it.
  const index = queue.findIndex(job => job.target === undefined || job.target === name)
  const queued = index >= 0 ? queue.splice(index, 1)[0] : undefined
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
      const position = pollers.findIndex(entry => entry.resolve === finish)
      if (position >= 0) pollers.splice(position, 1)
      resolve(undefined)
    }, POLL_HOLD_MS)
    pollers.push({ name, resolve: finish })
  })
}

/**
 * Deliver a worker's answer to the waiting caller.
 * @param id - job id.
 * @param result - the worker's outcome.
 * @returns whether the job was still waiting.
 */
export function complete(id: string, result: { ok: true; body: unknown } | { ok: false; error: string }, workerName = ''): boolean {
  const job = waiting.get(id)
  if (job === undefined) return false
  const name = workerName.trim()
  if (name !== '') {
    if (result.ok) {
      failures.delete(name)
      served.set(name, (served.get(name) ?? 0) + 1)
    } else {
      // A machine that cannot answer is rested, so the pool stops handing it work.
      const count = (failures.get(name) ?? 0) + 1
      failures.set(name, count)
      if (count >= 2) resting.set(name, Date.now() + REST_MS)
    }
  }
  job.settle(result)
  return true
}

/** Diagnostics for the owner page. */
export function relayStatus(): {
  queued: number
  inFlight: number
  pollers: number
  connected: boolean
  served: Record<string, number>
} {
  return {
    queued: queue.length,
    inFlight: waiting.size,
    pollers: pollers.length,
    connected: workerConnected(),
    served: Object.fromEntries(served),
  }
}
