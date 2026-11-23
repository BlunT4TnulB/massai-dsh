/**
 * The Extrapolator: fills the gaps between what a person typed and what a build
 * needs — and marks every specific guess so the artifact stays honest.
 *
 * Two kinds of extrapolation live here:
 *
 *   structural  what this shape always needs (a page needs a contact block)
 *   specific    values the person did not supply (a phone number, a price)
 *
 * Structural guesses are used plainly — they make the artifact complete.
 * Specific guesses are used **with a visible mark** — they make it honest.
 * The distinction is the whole design: it is what lets one turn produce something
 * finished without producing something fictional.
 *
 * @module @deepseek-ai/dsh-one-turn/extrapolator
 */

import type { IntakeAnswers, Shape } from '../spec.ts'

/** One gap that was filled, and how honestly. */
export interface Extrapolation {
  /** Which part of the brief this fills. */
  readonly field: string
  /** The value written into the mask. */
  readonly value: string
  /** Whether the build must show it as a blank rather than as fact. */
  readonly marked: boolean
  /** Why this was derivable at all. */
  readonly basis: string
  /** How sure the extrapolation is. */
  readonly confidence: 'high' | 'medium' | 'low'
}

/** What a shape always needs, regardless of what the person said. */
const STRUCTURE: Readonly<Record<Shape, readonly { field: string; value: string; basis: string }[]>> = {
  'single-page-site': [
    { field: 'sections', value: 'one clear headline, what it is, the prices or services, how to reach you', basis: 'a page that does not say what it is has failed already' },
    { field: 'contact', value: '[your phone] · [your hours] · [your address]', basis: 'a local page without contact details is a dead end' },
  ],
  'single-file-app': [
    { field: 'flow', value: 'one control area at the top, the result below, no navigation', basis: 'a single-file app has no room for menus' },
    { field: 'errors', value: 'bad input shows a plain sentence under the field, never an alert box', basis: 'silent failure is the most common app defect' },
  ],
  script: [
    { field: 'interface', value: 'arguments parsed with a --help line, dry-run unless --apply is passed', basis: 'a script that changes files without a dry run has already failed once' },
    { field: 'summary', value: 'print what was done, how many, and where', basis: 'a script nobody can audit is not trusted twice' },
  ],
  'data-view': [
    { field: 'emptiness', value: 'an empty dataset shows a sentence, not a broken chart', basis: 'real data is empty on day one' },
    { field: 'sorting', value: 'the requested view first, then sortable columns', basis: 'a view that cannot be re-sorted is a picture, not a tool' },
  ],
  document: [
    { field: 'structure', value: 'title, the facts that matter, then the detail', basis: 'a document is scanned before it is read' },
    { field: 'blanks', value: 'every unsupplied specific appears as [a marked blank], never as a plausible invention', basis: 'invented facts in a document are unrecoverable' },
  ],
}

/** Derive must-haves from the request when nobody wrote any. */
function deriveMustHave(goal: string, shape: Shape): string | undefined {
  const text = goal.toLowerCase()
  if (/\bprice|cost|rate|fee\b/.test(text)) return 'prices are visible and consistent everywhere they appear'
  if (/\bphone|call|contact\b/.test(text)) return 'the phone number is visible without scrolling'
  if (/\bcut|length|size|dimension|mm|inch\b/.test(text)) return 'every length is stated with its unit'
  if (/\bchart|graph|dashboard\b/.test(text)) return 'the requested view is the first thing on screen'
  if (shape === 'script') return 'it prints a summary of what it did'
  if (shape === 'document') return 'no statement appears that the supplied facts do not support'
  return undefined
}

/**
 * Fill what is missing, marking what must stay marked.
 * @param answers - what the person supplied.
 * @param shape - the artifact shape.
 * @returns every gap filled, in the order the mask should read them.
 */
export function extrapolate(answers: IntakeAnswers, shape: Shape): Extrapolation[] {
  const goal = (answers.goal ?? '').trim()
  const filled: Extrapolation[] = []

  // Structural: what this shape needs whether or not it was asked for.
  for (const rule of STRUCTURE[shape]) {
    const supplied = (answers.details ?? []).join(' ').toLowerCase()
    const alreadyThere = rule.field === 'contact' && /\d/.test(supplied)
    if (alreadyThere) continue
    filled.push({
      field: rule.field,
      value: rule.value,
      marked: rule.value.includes('['),
      basis: rule.basis,
      confidence: 'high',
    })
  }

  // Audience: never asked, always needed, and a good default beats a blank.
  if ((answers.audience ?? '').trim() === '') {
    filled.push({
      field: 'audience',
      value: 'someone who has never seen this before and is deciding in ten seconds',
      marked: false,
      basis: 'the hardest reader is the one who knows nothing yet',
      confidence: 'high',
    })
  }

  // Must-haves: derive one from the words rather than shipping an empty contract.
  if ((answers.mustHave ?? []).length === 0) {
    const derived = deriveMustHave(goal, shape)
    if (derived !== undefined) {
      filled.push({
        field: 'must-have',
        value: derived,
        marked: false,
        basis: 'derived from the request, since none were stated',
        confidence: 'medium',
      })
    }
  }

  // Acceptance: the "what would make you say no" answer is the best check there is.
  if ((answers.acceptance ?? []).length === 0 && (answers.details ?? []).length === 0) {
    filled.push({
      field: 'acceptance',
      value: 'reject if any specific value looks invented rather than supplied',
      marked: false,
      basis: 'when nothing was supplied, honesty is the only check that matters',
      confidence: 'medium',
    })
  }

  // Style: a palette rather than a mood, so the build obeys instead of interprets.
  if ((answers.styleWords ?? []).length === 0 && (answers.reference ?? '').trim() === '') {
    filled.push({
      field: 'style',
      value: 'off-white ground, near-black text, one saturated accent used at most twice; no gradients',
      marked: false,
      basis: 'no reference given, so a restrained palette is safer than an opinion',
      confidence: 'medium',
    })
  }

  return filled
}

/**
 * The mask section: what was filled, and what must stay visibly blank.
 * @param filled - the extrapolations.
 * @returns the section body, or '' when nothing was filled.
 */
export function extrapolationBlock(filled: readonly Extrapolation[]): string {
  if (filled.length === 0) return ''
  const lines = filled.map(item =>
    item.marked
      ? `- ${item.field}: ${item.value}  ← SHOW THIS AS A VISIBLE BLANK, not as fact (${item.basis})`
      : `- ${item.field}: ${item.value}  (${item.basis})`)
  return [
    'THESE WERE EXTRAPOLATED — the person did not supply them.',
    ...lines,
    'Use them to make the artifact complete. Where a line is marked, the blank must be visible.',
  ].join('\n')
}
