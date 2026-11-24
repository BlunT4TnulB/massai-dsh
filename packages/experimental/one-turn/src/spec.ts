/**
 * The spec: one canonical object between a person's words and one paid call.
 *
 * Everything downstream — the normaliser, the mask compiler, the acceptance
 * runner — reads this and nothing else. Keeping it versioned means a mask can be
 * replayed against the spec that produced it, years later, and still mean the
 * same thing.
 *
 * @module @deepseek-ai/dsh-one-turn/spec
 */

/** The artifact shapes this system promises to build in one turn. */
export const SUPPORTED_SHAPES = [
  'single-page-site',
  'single-file-app',
  'script',
  'data-view',
  'document',
] as const

/** One of the shapes above. */
export type Shape = (typeof SUPPORTED_SHAPES)[number]

/** What the intake collected, before normalisation. Everything optional but the goal. */
export interface IntakeAnswers {
  /** The request in the person's own words; never rewritten. */
  readonly goal: string
  /** The shape they chose, when they chose one. */
  readonly shape?: string
  /** Who it is for. */
  readonly audience?: string
  /** Things it must do. */
  readonly mustHave?: readonly string[]
  /** Things it must not do. */
  readonly nonGoals?: readonly string[]
  /** The particulars: names, numbers, sizes, materials, part numbers, exact wording. */
  readonly details?: readonly string[]
  /** What must be left as a blank rather than invented. */
  readonly neverInvent?: readonly string[]
  /** Words for how it should feel; mapped to concrete values. */
  readonly styleWords?: readonly string[]
  /** Where it will be opened, and any hard technical limits. */
  readonly techLimits?: string
  /** A look to match: a link or an image reference. */
  readonly reference?: string
  /** Where data comes from, when there is data. */
  readonly data?: string
  /** How they will judge it. */
  readonly acceptance?: readonly string[]
  /** Extra notes, used as a last resort only. */
  readonly notes?: string
}

/** The canonical, validated specification the mask is compiled from. */
export interface OneTurnSpec {
  /** Bumped when the meaning of a field changes. */
  readonly version: 1
  /** One of {@link SUPPORTED_SHAPES}. */
  readonly shape: Shape
  /** The request, verbatim. */
  readonly goal: string
  /** Who it is for. */
  readonly audience: string
  /** Hard, testable requirements. */
  readonly mustHave: readonly string[]
  /** Things to leave out on purpose. */
  readonly nonGoals: readonly string[]
  /** Observable checks the artifact must satisfy. */
  readonly acceptance: readonly string[]
  /** Look and feel, in concrete values rather than adjectives. */
  readonly style: {
    readonly reference: string
    readonly palette: string
    readonly type: string
    readonly spacing: string
    readonly radius: string
    readonly avoid: string
  }
  /** The particulars the build must use rather than invent. */
  readonly details: readonly string[]
  /** What to leave blank instead of inventing. */
  readonly neverInvent: readonly string[]
  /** Where it will run; the constraint that decides whether it works at all. */
  readonly techLimits: string
  /** What has gone wrong on this shape before, from the shelf. Empty when new. */
  readonly lessons: string
  /** The recorded interpretation decision, so this build can be re-steered. */
  readonly decision: string
  /** The workshop voice, used as material rather than text. */
  readonly voice: string
  /** What the Extrapolator filled in, and which parts must stay visibly blank. */
  readonly extrapolated: string
  /** The workshop's own library, as a convention hint. Empty when the shelf is bare. */
  readonly library: string
  /** Data input, or '' when none. */
  readonly data: string
  /** The files the artifact must consist of. */
  readonly outputContract: { readonly files: readonly string[]; readonly entry: string }
  /** Ceilings the build must respect. */
  readonly limits: { readonly maxFiles: number; readonly maxBytes: number }
}

/** A refusal: the honest answer when the request is outside what one turn can deliver. */
export interface Refusal {
  /** Why nothing was built. */
  readonly reason: string
  /** What was understood, so the person feels heard rather than rejected. */
  readonly understood: string
  /** The shapes that would work instead. */
  readonly shapes: readonly Shape[]
}

/** The normaliser's answer: a spec to compile, or a refusal to show. */
export type Normalised =
  | { readonly ok: true; readonly spec: OneTurnSpec }
  | { readonly ok: false; readonly refusal: Refusal }

/** What each shape commits to: files, ceilings, and the checks it always gets. */
export const SHAPE_CONTRACT: Readonly<Record<Shape, {
  readonly files: readonly string[]
  readonly entry: string
  readonly maxFiles: number
  readonly maxBytes: number
  readonly defaultAcceptance: readonly string[]
  readonly example: string
}>> = {
  'single-page-site': {
    files: ['index.html'],
    entry: 'index.html',
    maxFiles: 2,
    maxBytes: 250_000,
    defaultAcceptance: [
      'opens directly from the filesystem with no build step',
      'no console errors',
      'readable on a 390px-wide screen',
      'every link and button does something or is removed',
    ],
    example: 'a page for my lawn care business',
  },
  'single-file-app': {
    files: ['index.html'],
    entry: 'index.html',
    maxFiles: 2,
    maxBytes: 300_000,
    defaultAcceptance: [
      'opens directly from the filesystem with no build step',
      'the primary interaction works end to end',
      'no console errors',
      'state survives a reload when the brief asks for it',
    ],
    example: 'a tip calculator that splits by people',
  },
  script: {
    files: ['main.py'],
    entry: 'main.py',
    maxFiles: 3,
    maxBytes: 120_000,
    defaultAcceptance: [
      'runs with the standard library of the chosen language only',
      'prints a summary of what it did',
      'does not destroy data without an explicit flag',
      'exits non-zero on failure',
    ],
    example: 'rename every photo in a folder to the date it was taken',
  },
  'data-view': {
    files: ['index.html', 'data.json'],
    entry: 'index.html',
    maxFiles: 4,
    maxBytes: 400_000,
    defaultAcceptance: [
      'reads the supplied data file and hardcodes no numbers',
      'the requested views are the ones shown first',
      'no console errors',
      'handles an empty data file without breaking',
    ],
    example: 'a dashboard of this CSV: revenue by month',
  },
  document: {
    files: ['document.md'],
    entry: 'document.md',
    maxFiles: 3,
    maxBytes: 80_000,
    defaultAcceptance: [
      'contains no invented facts, dates or claims',
      'the requested structure is visible',
      'every placeholder the person must fill is marked clearly',
    ],
    example: 'a resume from this text for a warehouse supervisor role',
  },
}

/** How many words a shape's brief may assume before it is really two requests. */
export const MAX_MUST_HAVE = 7
