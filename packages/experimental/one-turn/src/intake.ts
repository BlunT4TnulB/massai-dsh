/**
 * The interview: the part that pries details out of a person *before* a paid call.
 *
 * Every question here exists to prevent one specific way a build fails. That is
 * the whole design rule — if a question cannot name the failure it prevents, it
 * does not belong in the interview. A person answering all of these has, without
 * knowing it, written most of the mask themselves.
 *
 * The interview is also allowed to ask about odd things. Fiber tubing, a specific
 * supplier's part numbers, the exact wording of a lease clause — if the build
 * must not invent it, the interview must collect it.
 *
 * @module @deepseek-ai/dsh-one-turn/intake
 */

import { SHAPE_CONTRACT, SUPPORTED_SHAPES, type Shape } from './spec.ts'

/** The ways a one-turn build fails. Every question names the one it guards. */
export const FAILURE_BUCKETS = [
  'wrong-shape',
  'missed-requirement',
  'hallucinated-detail',
  'style-drift',
  'broken-run',
  'overbuilt',
  'underbuilt',
] as const

/** One bucket above. */
export type FailureBucket = (typeof FAILURE_BUCKETS)[number]

/** One question in the interview. */
export interface Question {
  /** Key the answer is stored under. */
  readonly key: string
  /** The question, in the product's voice. */
  readonly ask: string
  /** Hint under the field. */
  readonly hint?: string
  /** What happens when it is skipped. */
  readonly fallback: string
  /** The failure this question prevents. */
  readonly prevents: FailureBucket
  /** Two example answers, so a person sees the shape of a good one. */
  readonly examples: readonly string[]
  /** Whether an empty answer is a refusal rather than a default. */
  readonly required: boolean
}

/** A follow-up generated from what was already answered. */
export interface Probe extends Question {
  /** Why this probe appeared, for the interface to show honestly. */
  readonly because: string
}

/** The interview, in order. The first three carry most of the value. */
export function interview(): readonly Question[] {
  return [
    {
      key: 'goal',
      ask: 'What should exist when this is done? One sentence, your own words.',
      hint: 'Do not tidy it up. The roughness is information.',
      fallback: 'nothing — this one is required',
      prevents: 'wrong-shape',
      examples: ['a page for my lawn care business with prices and my phone number',
        'a parts list and cutting plan for a fiber tubing frame'],
      required: true,
    },
    {
      key: 'shape',
      ask: 'Which of these is it closest to?',
      hint: 'Pick the nearest one; the interview will ask for what matters.',
      fallback: 'inferred from your sentence; if that fails you are asked',
      prevents: 'wrong-shape',
      examples: [...SUPPORTED_SHAPES],
      required: false,
    },
    {
      key: 'details',
      ask: 'The particulars this must get right — names, numbers, sizes, materials, part numbers, wording.',
      hint: 'One per line. This is the most valuable box on this page: anything you leave here, the build has to invent, and invented details are the most common way a build fails.',
      fallback: 'nothing beyond your first sentence — expect the build to guess, and check it',
      prevents: 'hallucinated-detail',
      examples: ['Lawn & Order YEG', 'prices: 40/70/110 for small/medium/large',
        'fiber tubing: 12mm OD, 8mm ID, 3 m length, 6 pieces, aluminium ferrules'],
      required: false,
    },
    {
      key: 'mustHave',
      ask: 'Three things it must do. Each one checkable by looking.',
      hint: '"shows the phone number", not "feels professional". A check you cannot perform is not a requirement.',
      fallback: 'derived from your first sentence',
      prevents: 'missed-requirement',
      examples: ['phone number visible without scrolling', 'five services each with a price'],
      required: false,
    },
    {
      key: 'rejectWhy',
      ask: 'What would make you say "no, that is not it"?',
      hint: 'Say the thing out loud. If you cannot, the build cannot succeed by luck either.',
      fallback: 'the standard checks for this shape',
      prevents: 'underbuilt',
      examples: ['if it looks like a generic template', 'if any price is invented'],
      required: false,
    },
    {
      key: 'neverInvent',
      ask: 'What must it never make up?',
      hint: 'Testimonials, dates, prices, phone numbers, legal wording, certifications — name them and they will be marked as yours to fill.',
      fallback: 'no invented testimonials, prices, dates, credentials, or addresses',
      prevents: 'hallucinated-detail',
      examples: ['customer reviews', 'certification numbers', 'any date after today'],
      required: false,
    },
    {
      key: 'nonGoals',
      ask: 'What should it deliberately NOT include?',
      hint: 'Every extra section is a defect. This box is how you keep it small.',
      fallback: 'no external accounts, no backend, no sign-in, no newsletter popup',
      prevents: 'overbuilt',
      examples: ['no gallery', 'no newsletter', 'no chat widget'],
      required: false,
    },
    {
      key: 'styleWords',
      ask: 'Three words for how it should feel, and one look to match if you have one.',
      hint: 'Words become concrete values (colours, sizes, spacing). A link or image beats words every time.',
      fallback: 'a restrained two-colour palette with one accent; no gradients',
      prevents: 'style-drift',
      examples: ['calm, confident, warm — like a good bakery receipt', 'https://example.com/reference'],
      required: false,
    },
    {
      key: 'techLimits',
      ask: 'Any hard technical limits? Where will you open this?',
      hint: 'This decides whether the result runs at all.',
      fallback: 'one file opened directly in a browser, no build step, no internet',
      prevents: 'broken-run',
      examples: ['opens from a USB stick in Chrome', 'runs on Windows in Python 3.11'],
      required: false,
    },
    {
      key: 'dataSource',
      ask: 'Where does the data come from, and what are the columns or fields?',
      fallback: 'none — the artifact carries its own content',
      prevents: 'underbuilt',
      examples: ['monthly revenue csv with month, product, amount', 'a notes text file'],
      required: false,
    },
  ]
}

/** Keywords that suggest a domain the build must not invent specifics for. */
const DOMAIN_PROBES: ReadonlyArray<{
  readonly match: RegExp
  readonly probe: Omit<Probe, 'because'>
  readonly because: string
}> = [
  {
    match: /\b(tub(e|ing)|pipe|fitting|ferrule|hose|flange|elbow|thread|bolt|bracket|panel|sheet|rod)\b/i,
    probe: {
      key: 'dimensions',
      ask: 'Give me the exact sizes and quantities: outside diameter, inside diameter, length, wall, count.',
      hint: 'Include units and tolerances. "12 mm OD, 8 mm ID, 3 m, six pieces" is the shape.',
      fallback: 'no dimensions supplied — the build will mark every size as yours to fill in',
      prevents: 'hallucinated-detail',
      examples: ['12 mm OD / 8 mm ID carbon tube, 3 m, qty 6', '3/4 inch copper, 10 ft, qty 2'],
      required: false,
    },
    because: 'the request names physical parts, and sizes are the details people most often get wrong',
  },
  {
    match: /\b(price|cost|rate|fee|budget|\$|usd|cad)\b/i,
    probe: {
      key: 'prices',
      ask: 'What are the actual prices, and is tax included?',
      hint: 'Leave this empty and the build will invent numbers — that is the failure this stops.',
      fallback: 'no prices supplied — the build shows ranges clearly marked as placeholders',
      prevents: 'hallucinated-detail',
      examples: ['40 / 70 / 110 CAD, tax not included', 'free consult, 85/hr after'],
      required: false,
    },
    because: 'the request mentions money, and invented prices are the most costly detail to get wrong',
  },
  {
    match: /\b(legal|contract|lease|terms|clause|policy|compliance|permit)\b/i,
    probe: {
      key: 'wording',
      ask: 'Which wording must be exact? Paste it, or say "paraphrase only".',
      hint: 'Legal language is never safe to improvise.',
      fallback: 'no exact wording supplied — the build paraphrases nothing legal and marks it for review',
      prevents: 'hallucinated-detail',
      examples: ['paste clause 4.2 verbatim', 'paraphrase only, no legal claims'],
      required: false,
    },
    because: 'the request touches words that cannot be improvised',
  },
  {
    match: /\b(logo|brand|colou?r|font|look|style|design)\b/i,
    probe: {
      key: 'brandTokens',
      ask: 'Exact brand values you already have: colour codes, font names, logo file.',
      hint: 'Hex codes and font names are obeyed; adjectives are guessed at.',
      fallback: 'no brand values supplied — a restrained palette is generated and stated in the file',
      prevents: 'style-drift',
      examples: ['#0E3B2E green, #F4E3C1 cream, Fraunces for headings', 'no logo yet'],
      required: false,
    },
    because: 'the request mentions looks, and looks drift without numbers',
  },
]

/** Shape-specific probes: the questions that shape always benefits from. */
const SHAPE_PROBES: Readonly<Record<Shape, readonly Omit<Probe, 'because'>[]>> = {
  'single-page-site': [
    {
      key: 'contact',
      ask: 'What contact details and opening hours are real?',
      hint: 'Phone, address, email, hours. Invented contact details send real people nowhere.',
      fallback: 'no contact details supplied — the page shows a marked placeholder',
      prevents: 'hallucinated-detail',
      examples: ['(780) 555-0142, Mon–Sat 8–6, Edmonton AB', 'email only'],
      required: false,
    },
    {
      key: 'sections',
      ask: 'Which sections, in order, and how many?',
      fallback: 'the shortest set that satisfies the brief',
      prevents: 'overbuilt',
      examples: ['hero, services with prices, about, contact'],
      required: false,
    },
  ],
  'single-file-app': [
    {
      key: 'rules',
      ask: 'Walk me through the exact interaction, step by step.',
      hint: 'What is shown first, what changes on click, what happens on bad input.',
      fallback: 'the obvious flow, stated in the file',
      prevents: 'underbuilt',
      examples: ['enter bill, choose tip, choose people, see total per person'],
      required: false,
    },
    {
      key: 'persistence',
      ask: 'Should anything survive a reload?',
      fallback: 'nothing survives; a reload starts clean',
      prevents: 'broken-run',
      examples: ['remember the todos', 'start fresh every time'],
      required: false,
    },
  ],
  script: [
    {
      key: 'runtime',
      ask: 'Which machine, OS and language version will run this?',
      fallback: 'Python 3, standard library only',
      prevents: 'broken-run',
      examples: ['Windows 11, Python 3.11', 'macOS, bash'],
      required: false,
    },
    {
      key: 'safety',
      ask: 'What must it never touch, and should it dry-run first?',
      hint: 'A script that deletes by default has already failed.',
      fallback: 'dry-run by default, writes only inside the folder given',
      prevents: 'broken-run',
      examples: ['never delete originals; dry-run unless --apply'],
      required: false,
    },
  ],
  'data-view': [
    {
      key: 'columns',
      ask: 'Name the fields that matter and the order you want to see them.',
      fallback: 'every field, alphabetical',
      prevents: 'missed-requirement',
      examples: ['month, revenue, top 5 products'],
      required: false,
    },
    {
      key: 'units',
      ask: 'Units, currency and rounding.',
      fallback: 'no currency symbol; two decimal places',
      prevents: 'hallucinated-detail',
      examples: ['CAD thousands, no decimals'],
      required: false,
    },
  ],
  document: [
    {
      key: 'facts',
      ask: 'The facts that are true: dates, employers, amounts, exact titles.',
      hint: 'Everything not here will be left as a marked blank rather than invented.',
      fallback: 'no facts supplied — every specific becomes a marked blank',
      prevents: 'hallucinated-detail',
      examples: ['Warehouse Supervisor, 2019–2023, Acme Edmonton'],
      required: false,
    },
    {
      key: 'length',
      ask: 'How long, and who reads it?',
      fallback: 'one page, read by a busy stranger',
      prevents: 'overbuilt',
      examples: ['one page, read by a hiring manager'],
      required: false,
    },
  ],
}

/**
 * Follow-up questions this person's answers have earned.
 * @param answers - what was answered so far (any subset).
 * @returns at most three probes, most valuable first.
 */
export function probes(answers: {
  readonly goal?: string
  readonly shape?: string
}): readonly Probe[] {
  const goal = answers.goal ?? ''
  const shape = SUPPORTED_SHAPES.find(candidate => candidate === answers.shape)
  const chosen: Probe[] = []

  for (const entry of DOMAIN_PROBES) {
    if (entry.match.test(goal)) chosen.push({ ...entry.probe, because: entry.because })
  }
  if (shape !== undefined) {
    for (const probe of SHAPE_PROBES[shape]) {
      chosen.push({ ...probe, because: `every ${shape.replaceAll('-', ' ')} benefits from this` })
    }
  }

  // Never more than three: the interview must stay faster than the build.
  return chosen.slice(0, 3)
}

/**
 * The shape contracts for the intake screen: an example and its checks.
 * @returns one row per supported shape.
 */
export function shapeChoices(): ReadonlyArray<{
  shape: string; example: string; files: readonly string[]; checks: readonly string[]
}> {
  return SUPPORTED_SHAPES.map(shape => ({
    shape,
    example: SHAPE_CONTRACT[shape].example,
    files: SHAPE_CONTRACT[shape].files,
    checks: SHAPE_CONTRACT[shape].defaultAcceptance,
  }))
}
