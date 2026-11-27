/**
 * What the workshop is doing right now — derived from the agent's own tool calls.
 *
 * The flower on the live page turns toward whichever capability is hottest. That
 * only means something if the signal is real, so it comes from the session event
 * stream: every `tool/call` carries a tool name and its arguments, which is
 * enough to say "this is a geometry thing" or "this is a script thing" without
 * ever looking at the content being written.
 *
 * Coarse on purpose: a category and a few words, decaying after ten minutes.
 * Nothing here can leak what a person is building — only what kind of thing it is.
 *
 * @module @deepseek-ai/dsh-hosted-signin/activity
 */

/**
 * What kind of moment this was, so the mind can show it rather than merely glow:
 * a tool call, a failure or retry, something learned, an epiphany, a finished build.
 */
export type ActivityKind = 'tool' | 'fail' | 'learn' | 'epiphany' | 'build'

/** One piece of work the workshop is doing. */
export interface ActivityEvent {
  /** A capability id, shared with the skill catalog, or 'general'. */
  readonly skill: string
  /** A few words for the live caption. */
  readonly label: string
  /** Epoch ms. */
  readonly at: number
  /** Which session did it, when known: the "agent" the orbit draws. */
  readonly session?: string
  /** The moment's kind: what the mind should draw for it. */
  readonly kind: ActivityKind
}

/** How long an event stays warm. */
const WINDOW_MS = 10 * 60 * 1000

/** How many events are kept: enough to draw a session's shape, not a history. */
const CAPACITY = 120

/** The buffer: a mood, not a log. */
const events: ActivityEvent[] = []

/** Record one piece of activity. */
export function recordActivity(
  skill: string,
  label: string,
  session?: string,
  kind: ActivityKind = 'tool',
): void {
  events.push({ skill, label, at: Date.now(), kind, ...(session === undefined || session === '' ? {} : { session }) })
  while (events.length > CAPACITY) events.shift()
}

/** How many of each kind are warm right now — counts only, no content. */
/** Moments the one-turn builder recorded: a lesson learned, a repair that held, a build that held. */
function builderMoments(now: number): Array<{ kind: ActivityKind; at: number }> {
  try {
    const path = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '/tmp', '.dsh'), 'one-turn', 'moments.jsonl')
    const recent: Array<{ kind: ActivityKind; at: number }> = []
    for (const line of readFileSync(path, 'utf8').trim().split('\n').slice(-200)) {
      try {
        const row = JSON.parse(line) as { kind?: unknown; at?: unknown }
        if (typeof row.at !== 'number' || now - row.at >= WINDOW_MS) continue
        if (row.kind === 'learn' || row.kind === 'epiphany' || row.kind === 'build') recent.push({ kind: row.kind, at: row.at })
      } catch { /* a torn line is not a moment */ }
    }
    return recent
  } catch {
    return []
  }
}

export function kindsOf(now = Date.now()): Record<ActivityKind, number> {
  const totals: Record<ActivityKind, number> = { tool: 0, fail: 0, learn: 0, epiphany: 0, build: 0 }
  for (const event of readActivity(now)) totals[event.kind] += 1
  // Real builder moments join the same tally: a green spark means a lesson was actually
  // recorded, a bright one means a repair actually held.
  for (const moment of builderMoments(now)) totals[moment.kind] += 1
  return totals
}

/** Drop stale entries and return the warm ones, freshest first. */
export function readActivity(now = Date.now()): ActivityEvent[] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event !== undefined && now - event.at > WINDOW_MS) events.splice(index, 1)
  }
  return [...events].reverse()
}

/** The hottest capability right now, weighted by recency. */
export function focusOf(now = Date.now()): { skill: string; label: string } | undefined {
  const warm = readActivity(now)
  if (warm.length === 0) return undefined
  const scores = new Map<string, { score: number; label: string }>()
  for (const event of warm) {
    // Half-life of two minutes: "what is happening now" should beat "what happened
    // a while ago", even if there was more of it. A ten-minute window with linear
    // weighting made six quick taps and one recent action look identical.
    const weight = Math.pow(0.5, Math.max(0, now - event.at) / 120000)
    const current = scores.get(event.skill)
    if (current === undefined) scores.set(event.skill, { score: weight, label: event.label })
    else scores.set(event.skill, { score: current.score + weight, label: current.label })
  }
  const top = [...scores.entries()].sort((a, b) => b[1].score - a[1].score)[0]
  return top === undefined ? undefined : { skill: top[0], label: top[1].label }
}

/**
 * The trail: the recent work as a sequence, oldest first, so a client can draw
 * the shape of a session rather than only its latest mood.
 * @param now - current epoch ms.
 * @returns the warm events in chronological order.
 */
export function trailOf(now = Date.now()): Array<{
  skill: string; label: string; at: number; agent?: string
}> {
  return readActivity(now).reverse().map(event => ({
    skill: event.skill,
    label: event.label,
    at: event.at,
    ...(event.session === undefined ? {} : { agent: agentId(event.session) }),
  }))
}

/**
 * How many actions happened, per capability, over the window.
 * @param now - current epoch ms.
 * @returns counts keyed by skill id, plus a total.
 */
export function countsOf(now = Date.now()): { total: number; bySkill: Record<string, number> } {
  const warm = readActivity(now)
  const bySkill: Record<string, number> = {}
  for (const event of warm) bySkill[event.skill] = (bySkill[event.skill] ?? 0) + 1
  return { total: warm.length, bySkill }
}

/**
 * A short, stable, non-revealing id for a session.
 *
 * Truncating the session id looked fine until two test sessions called "agent-a"
 * and "agent-b" both became "agent-" and were counted as one agent. A hash fixes
 * the collision and reveals nothing: the same session always hashes the same, and
 * no prefix of the real id leaks.
 * @param session - the raw session id.
 * @returns six base-36 characters.
 */
export function agentId(session: string): string {
  let hash = 2166136261
  for (let index = 0; index < session.length; index += 1) {
    hash ^= session.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(0, 6)
}

/**
 * The agents at work: distinct sessions in the window, with how much each did.
 * @param now - current epoch ms.
 * @returns up to six agents, busiest first; the id is a short fingerprint, never the raw session.
 */
export function agentsOf(now = Date.now()): Array<{ id: string; steps: number; lastSkill: string }> {
  const warm = readActivity(now)
  const bySession = new Map<string, { steps: number; lastSkill: string }>()
  for (const event of warm) {
    if (event.session === undefined) continue
    const id = agentId(event.session)
    const current = bySession.get(id)
    if (current === undefined) bySession.set(id, { steps: 1, lastSkill: event.skill })
    else bySession.set(id, { steps: current.steps + 1, lastSkill: event.skill })
  }
  return [...bySession.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.steps - a.steps)
    .slice(0, 6)
}

/** Forget everything (restart, or between demos). */
export function clearActivity(): void {
  events.length = 0
}

/** Category id from a file path, by extension and name. */
function skillOfPath(path: string): string | undefined {
  const lower = path.toLowerCase()
  if (/\.(dxf|stl|step|obj|geo)$/.test(lower) || /geometry|vector|flower|shader/.test(lower)) return 'geometry'
  if (/\.(csv|tsv)$/.test(lower) || /dashboard|chart|report/.test(lower)) return 'dashboard'
  if (/\.(tsx|jsx|html|css)$/.test(lower)) return 'web-app'
  if (/\.(py|sh|ps1)$/.test(lower)) return 'scripting'
  if (/\.(test|spec)\./.test(lower)) return 'testing'
  if (/\.(md|tex)$/.test(lower) || /readme|resume|invoice|spec/.test(lower)) return 'docs'
  if (/scan|inventory|cambium/.test(lower)) return 'scanner'
  if (/api|server|route|endpoint/.test(lower)) return 'service'
  return undefined
}

/** Category id from a shell command. */
function skillOfCommand(command: string): string | undefined {
  const lower = command.toLowerCase()
  if (/python|\.py\b/.test(lower)) return 'scripting'
  if (/\b(npm|pnpm|yarn|vite|tsc)\b/.test(lower)) return 'web-app'
  if (/\b(vitest|pytest|jest|test)\b/.test(lower)) return 'testing'
  if (/\b(curl|http|api)\b/.test(lower)) return 'service'
  return undefined
}

/**
 * Turn one agent tool call into activity.
 *
 * The tool call is the honest unit here: it is the moment the agent decided to
 * write a file, run a command, or read something. Classification looks only at
 * the tool name and the argument text, and only for a category — never content.
 * @param name - the tool name from the event.
 * @param rawArguments - the raw argument string from the event.
 * @returns the activity that was recorded, when the call was classifiable.
 */
export function classifyToolCall(name: string, rawArguments: string, session?: string): ActivityEvent | undefined {
  let args: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(rawArguments) as unknown
    if (typeof parsed === 'object' && parsed !== null) args = parsed as Record<string, unknown>
  } catch {
    // some tools pass a plain string; fall through to the raw text below
  }
  const path = String(args['path'] ?? args['file'] ?? args['filePath'] ?? args['target'] ?? '')
  const command = String(args['command'] ?? args['cmd'] ?? args['script'] ?? '')
  const skill = skillOfPath(path) ?? skillOfCommand(command) ?? (name === 'write' || name === 'edit' ? 'web-app' : undefined)
  if (skill === undefined) return undefined

  const labels: Record<string, string> = {
    geometry: 'drawing geometry', dashboard: 'shaping data', 'web-app': 'building the interface',
    scripting: 'writing a script', testing: 'checking the work', docs: 'writing the document',
    scanner: 'working on the scanner', service: 'wiring a service', general: 'working',
  }
  recordActivity(skill, labels[skill] ?? 'working', session)
  return readActivity()[0]
}
