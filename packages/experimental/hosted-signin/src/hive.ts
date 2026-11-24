/**
 * The hive: every live session, and the operator's ability to reach into one.
 *
 * The activity feed shows what is happening; the hive shows *who is doing it* and
 * lets the operator steer. That second half is the part worth being careful about,
 * so the rules are explicit and narrow:
 *
 *  - a session is identified by a hash, never by its raw id or its user id
 *  - the read endpoint is public but says only counts and capability words
 *  - the write endpoint needs the owner token, and a note is always labelled as
 *    the operator speaking, never disguised as the user
 *  - a note is delivered exactly once, into the next step of that session, and
 *    the queue is capped so a stuck session cannot accumulate orders
 *
 * This is the smallest honest version of "click a node and move it": no hidden
 * control channel, no impersonation, and nothing that survives the session.
 *
 * @module @deepseek-ai/dsh-hosted-signin/hive
 */

import { agentId } from './activity.ts'

/** What the hive knows about one live session. */
export interface HiveNode {
  /** Hashed session id: stable for the session, revealing nothing. */
  readonly id: string
  /** Epoch ms of the last event seen. */
  readonly lastSeen: number
  /** How many tool calls this session has made in the window. */
  readonly steps: number
  /** The capability it last worked on. */
  readonly lastSkill: string
  /** Whether a note is waiting for it. */
  readonly hasNote: boolean
}

/** How long a session stays in the hive after its last event. */
const NODE_TTL_MS = 30 * 60 * 1000

/** At most this many notes may wait for one session. */
const MAX_NOTES_PER_SESSION = 3

/** One session's state. */
interface NodeState {
  readonly session: string
  lastSeen: number
  steps: number
  lastSkill: string
}

/** Live sessions, keyed by the raw session id (never leaves this module). */
const nodes = new Map<string, NodeState>()

/** Notes waiting to be delivered, keyed by raw session id. */
const notes = new Map<string, string[]>()

/**
 * Record that a session did something.
 * @param session - the raw session id.
 * @param skill - the capability it worked on.
 */
export function touchSession(session: string, skill: string): void {
  if (session === '') return
  const existing = nodes.get(session)
  if (existing === undefined) nodes.set(session, { session, lastSeen: Date.now(), steps: 1, lastSkill: skill })
  else {
    existing.lastSeen = Date.now()
    existing.steps += 1
    existing.lastSkill = skill
  }
}

/**
 * The hive as the outside world may see it.
 * @param now - current epoch ms.
 * @returns live nodes, busiest first, and whether each has a note waiting.
 */
export function hiveNodes(now = Date.now()): HiveNode[] {
  for (const [session, node] of nodes) {
    if (now - node.lastSeen > NODE_TTL_MS) nodes.delete(session)
  }
  return [...nodes.values()]
    .sort((a, b) => b.steps - a.steps)
    .map(node => ({
      id: agentId(node.session),
      lastSeen: node.lastSeen,
      steps: node.steps,
      lastSkill: node.lastSkill,
      hasNote: (notes.get(node.session)?.length ?? 0) > 0,
    }))
}

/**
 * Queue a steering note for one session.
 * @param session - the raw session id, as the hive reported it (hashed input is rejected).
 * @param note - what the operator wants to say.
 * @returns how many notes are now waiting, or undefined when the session is unknown.
 */
export function queueNote(session: string, note: string): number | undefined {
  if (!nodes.has(session)) return undefined
  const queue = notes.get(session) ?? []
  queue.push(note.slice(0, 500))
  while (queue.length > MAX_NOTES_PER_SESSION) queue.shift()
  notes.set(session, queue)
  return queue.length
}

/**
 * Resolve a hashed node id back to the raw session, for the control endpoint.
 * @param hashed - the id the hive published.
 * @returns the raw session id, or undefined when no live session matches.
 */
export function sessionFor(hashed: string): string | undefined {
  for (const session of nodes.keys()) {
    if (agentId(session) === hashed) return session
  }
  return undefined
}

/**
 * Take the notes waiting for a session, clearing them.
 *
 * Called by the pre-step gate: the notes become one message in the next step, so
 * the agent receives the operator's direction exactly once.
 * @param session - the raw session id.
 * @returns the notes, oldest first.
 */
export function takeNotes(session: string): string[] {
  const queue = notes.get(session)
  if (queue === undefined || queue.length === 0) return []
  notes.delete(session)
  return queue
}

/** How many sessions and notes are live, for the console. */
export function hiveSummary(now = Date.now()): { sessions: number; notes: number } {
  return {
    sessions: hiveNodes(now).length,
    notes: [...notes.values()].reduce((sum, queue) => sum + queue.length, 0),
  }
}
