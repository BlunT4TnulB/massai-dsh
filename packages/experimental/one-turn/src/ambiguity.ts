/**
 * Ambiguity: the moment a request can be read two ways.
 *
 * Most one-turn failures are not failures of execution, they are failures of
 * *reading*. "A page for my business" is a landing page, a one-pager, or a price
 * list depending on who is asking. A build that silently picks one and says
 * nothing has already failed half the time.
 *
 * So ambiguity is treated as a first-class object: detected, named, and resolved
 * either by one question or by a **recorded decision** written into the artifact.
 * A recorded decision is what makes steering possible after the fact — the other
 * readings are named, so the build can be re-steered without starting over.
 *
 * @module @deepseek-ai/dsh-one-turn/ambiguity
 */

import type { Shape } from './spec.ts'

/** How strongly a reading suggests itself. */
export type Confidence = 'high' | 'medium' | 'low'

/** One way the request could be understood. */
export interface Reading {
  /** Short id, stable enough to use in a URL. */
  readonly id: string
  /** The artifact shape this reading implies. */
  readonly shape: Shape
  /** What this reading means, in one line. */
  readonly means: string
  /** The assumption the build would be making. */
  readonly assumes: string
  /** How sure the system is that this is the intended reading. */
  readonly confidence: Confidence
}

/** A concept that is commonly ambiguous, with the readings it allows. */
interface AmbiguityPattern {
  /** Words that trigger the pattern. */
  readonly match: RegExp
  /** The readings, best first. */
  readonly readings: readonly Omit<Reading, 'confidence'>[]
}

/** The ambiguity table. Every entry is a request shape that has burned us. */
const PATTERNS: readonly AmbiguityPattern[] = [
  {
    match: /\b(page|site|website|webpage)\b/i,
    readings: [
      { id: 'landing', shape: 'single-page-site', means: 'one scrolling page that sells or explains one thing',
        assumes: 'the visitor arrives cold and needs to be convinced in one screen' },
      { id: 'brochure', shape: 'single-page-site', means: 'a quiet reference page: who, what, where, contact',
        assumes: 'the visitor already knows the business and wants details' },
      { id: 'menu', shape: 'single-page-site', means: 'a list with prices, optimised for scanning',
        assumes: 'the primary need is prices, not persuasion' },
    ],
  },
  {
    match: /\b(list|plan|sheet|document|spec)\b/i,
    readings: [
      { id: 'checklist', shape: 'document', means: 'a printable checklist someone works through',
        assumes: 'it will be read on paper, in order' },
      { id: 'reference', shape: 'document', means: 'a reference table looked up, not read start to finish',
        assumes: 'the reader jumps to the row they need' },
      { id: 'table', shape: 'data-view', means: 'an interactive view over the data',
        assumes: 'the reader wants to sort and filter rather than print' },
    ],
  },
  {
    match: /\b(app|tool|calculator|tracker)\b/i,
    readings: [
      { id: 'single-file', shape: 'single-file-app', means: 'one interactive page, opened directly',
        assumes: 'it will be opened from a file, not installed' },
      { id: 'script', shape: 'script', means: 'a terminal tool with arguments',
        assumes: 'the person is comfortable in a terminal' },
    ],
  },
  {
    match: /\b(dashboard|chart|graph|report|analysis)\b/i,
    readings: [
      { id: 'view', shape: 'data-view', means: 'an interactive view of the supplied data',
        assumes: 'the data changes and will be looked at repeatedly' },
      { id: 'summary', shape: 'document', means: 'a fixed written summary with the key numbers',
        assumes: 'it will be read once and shared' },
    ],
  },
  {
    match: /\b(clean|rename|check|backup|automate|convert)\b/i,
    readings: [
      { id: 'script', shape: 'script', means: 'a script that does one job well',
        assumes: 'it runs repeatedly on folders of files' },
      { id: 'ui', shape: 'single-file-app', means: 'a small page that does it with clicks',
        assumes: 'the person does not want to touch a terminal' },
    ],
  },
]

/**
 * Every reading this request allows, best first.
 * @param goal - the request as typed.
 * @param chosen - a shape the person explicitly picked; narrows the list.
 * @returns the readings; a single reading means the request is not ambiguous.
 */
export function readings(goal: string, chosen?: Shape): readonly Reading[] {
  const pattern = PATTERNS.find(entry => entry.match.test(goal))
  if (pattern === undefined) return []
  const narrowed = chosen === undefined
    ? pattern.readings
    : pattern.readings.filter(reading => reading.shape === chosen)
  const pool = narrowed.length > 0 ? narrowed : pattern.readings
  return pool.map((reading, index) => ({
    ...reading,
    confidence: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
  }))
}

/**
 * Is this request genuinely ambiguous?
 * @param goal - the request as typed.
 * @param chosen - a shape the person picked, if any.
 * @returns true when more than one reading survives the chosen shape.
 */
export function isAmbiguous(goal: string, chosen?: Shape): boolean {
  return readings(goal, chosen).length > 1
}

/**
 * The recorded decision a build leaves behind, so it can be re-steered.
 *
 * This is the steering mechanism: not a question asked mid-flight, but a written
 * statement of which reading was taken and what the alternatives were. It costs
 * nothing to keep, and it turns "that is not what I meant" from a rebuild into a
 * one-line change.
 * @param taken - the chosen reading.
 * @param others - the readings that were not taken.
 * @returns the mask section body.
 */
export function decisionBlock(taken: Reading, others: readonly Reading[]): string {
  const lines = [
    `INTERPRETATION TAKEN: ${taken.means}.`,
    `ASSUMPTION MADE: ${taken.assumes}.`,
  ]
  if (others.length > 0) {
    lines.push('OTHER READINGS THIS REQUEST ALLOWED (do not build them, but keep the artifact easy to change):')
    for (const other of others) lines.push(`- ${other.means} (would assume: ${other.assumes})`)
    lines.push('Where the choice matters, keep that part separable so switching readings is a small edit.')
  }
  lines.push('Record this decision in your report, in one line, so it can be checked quickly.')
  return lines.join('\n')
}
