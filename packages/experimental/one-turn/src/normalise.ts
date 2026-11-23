/**
 * The normaliser: person's words in, a sealed spec out — or an honest refusal.
 *
 * This is pure code on purpose. No model is called here, so it can be reasoned
 * about, tested exhaustively, and refined for free. Its job is to decide *before
 * any money is spent* whether the request is one this system can deliver in a
 * single turn.
 *
 * @module @deepseek-ai/dsh-one-turn/normalise
 */

import { decisionBlock, readings } from './ambiguity.ts'
import { lessonBlock } from './lessons.ts'
import { extrapolate, extrapolationBlock } from './extrapolator/index.ts'
import { readVoice, voiceBlock } from './voice.ts'
import {
  MAX_MUST_HAVE, SHAPE_CONTRACT, SUPPORTED_SHAPES,
  type IntakeAnswers, type Normalised, type OneTurnSpec, type Shape,
} from './spec.ts'

/** Words that suggest a page rather than an app. */
const SITE_HINTS = ['page', 'site', 'website', 'landing', 'portfolio', 'invitation', 'pricing page']
/** Words that suggest an interactive single file. */
const APP_HINTS = ['calculator', 'timer', 'countdown', 'todo', 'kanban', 'quiz', 'converter', 'splits', 'board', 'tracker']
/** Words that suggest a terminal script. */
const SCRIPT_HINTS = ['script', 'rename', 'csv', 'clean', 'folder', 'backup', 'duplicate', 'batch', 'automate']
/** Words that suggest a view over data. */
const DATA_HINTS = ['dashboard', 'chart', 'graph', 'table', 'heatmap', 'csv file', 'this csv', 'this json', 'sort and filter']
/** Words that suggest a document. */
const DOC_HINTS = ['resume', 'cv', 'invoice', 'readme', 'contract', 'letter', 'one-pager', 'proposal',
  'parts list', 'cutting plan', 'spec sheet', 'bill of materials', 'manual', 'guide', 'checklist', 'instructions', 'plan']

/** Requests that are plainly outside one turn; matched before anything else. */
const IMPOSSIBLE_HINTS: readonly { readonly match: RegExp; readonly why: string }[] = [
  { match: /\b(app|platform|marketplace) like (uber|airbnb|facebook|twitter|x|amazon|netflix)\b/i, why: '"an app like Uber" is a company, not a one-turn artifact' },
  { match: /\b(clone|copy)\b.*\b(instagram|tiktok|youtube|whatsapp)\b/i, why: 'a social platform clone needs accounts, servers and moderation' },
  { match: /\b(login|sign[- ]?up|authentication|accounts?)\b/i, why: 'accounts and sign-in need a backend and a database' },
  { match: /\b(payment|stripe|paypal|checkout|subscription)\b/i, why: 'taking money needs a merchant account and a server' },
  { match: /\b(real[- ]time|multiplayer|chat with|collaborate)\b/i, why: 'multiple live users need a persistent server' },
  { match: /\b(ai|machine learning|chatbot|llm)\b.*\b(train|model)\b/i, why: 'training a model is not a one-turn build' },
]

/** How many words is too vague to build from. */
const MIN_GOAL_WORDS = 3

/** Lowercase, collapse whitespace, trim. The only text surgery the normaliser does. */
function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Pick the shape from an explicit choice, then from the words used.
 * Exported because the interview needs it before the person has chosen anything.
 * @param goal - the request as typed.
 * @param chosen - the shape the person picked, when they picked one.
 * @returns the shape, or undefined when the words do not decide it.
 */
export function detectShape(goal: string, chosen?: string): Shape | undefined {
  const explicit = SUPPORTED_SHAPES.find(shape => shape === clean(chosen))
  if (explicit !== undefined) return explicit
  const haystack = ` ${goal.toLowerCase()} `
  const score = (hints: readonly string[]): number => hints.filter(hint => haystack.includes(hint)).length
  const ranked: Array<[Shape, number]> = [
    ['data-view', score(DATA_HINTS)],
    ['document', score(DOC_HINTS)],
    ['script', score(SCRIPT_HINTS)],
    ['single-file-app', score(APP_HINTS)],
    ['single-page-site', score(SITE_HINTS)],
  ]
  ranked.sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  if (top === undefined || top[1] === 0) return undefined
  return top[0]
}

/** How this shape is opened, for the default runtime line. */
function spec_shape_hint(shape: Shape): string {
  return shape === 'script' ? 'run from a terminal' : 'opened in a browser'
}

/** Turn "I want a page that has X" into a bare requirement, without inventing content. */
function tidyRequirement(value: string): string {
  return clean(value)
    .replace(/^(it|this|that)\s+(must|should|needs? to|has to)\s+/i, '')
    .replace(/^(please|also|and)\s+/i, '')
    .replace(/[.;]+$/, '')
}

/**
 * Adjectives are guesses; numbers are instructions. This turns the words a person
 * used into values the build can obey, which is the difference between "calm" and
 * a page that is actually calm.
 */
function styleOf(answers: IntakeAnswers): OneTurnSpec['style'] {
  const reference = clean(answers.reference)
  const words = (answers.styleWords ?? []).join(' ').toLowerCase()

  const palette = reference !== ''
    ? 'derived from the reference'
    : /warm|cosy|cozy|friendly|sun|bakery/.test(words)
      ? 'cream #FAF3E7 ground, ink #1C1A17 text, terracotta #C1440E accent'
      : /calm|quiet|minimal|clean|restrained/.test(words)
        ? 'off-white #F7F6F3 ground, slate #2B2B2B text, one muted accent'
        : 'off-white ground, near-black text, one saturated accent used at most twice'

  const type = /bold|loud|strong|dramatic/.test(words)
    ? 'three sizes only: 48/20/15px, heavy weight for headings, generous line-height 1.5'
    : 'three sizes only: 36/18/15px, one serif for headings and one sans for body, line-height 1.6'

  const spacing = /airy|spacious|generous|calm/.test(words)
    ? 'vertical rhythm of 24/48/96px; never two margins inside one block'
    : 'vertical rhythm of 16/32/64px; never two margins inside one block'

  const radius = /soft|round|friendly|warm/.test(words) ? '10px on cards, 999px on pills' : '4px on cards, 4px on buttons'

  return {
    reference,
    palette,
    type,
    spacing,
    radius,
    avoid: 'lorem ipsum, placeholder images with watermarks, smiley emoji, three-column feature grids',
  }
}

/**
 * Normalise intake answers into a spec, or refuse.
 * @param answers - what the interview collected.
 * @returns the sealed spec, or a refusal naming the shapes that would work.
 */
export function normalise(answers: IntakeAnswers): Normalised {
  const goal = clean(answers.goal)
  const words = goal.split(' ').filter(word => word !== '')

  const impossible = IMPOSSIBLE_HINTS.find(hint => hint.match.test(goal))
  if (impossible !== undefined) {
    return {
      ok: false,
      refusal: {
        reason: impossible.why,
        understood: goal === '' ? 'nothing was described yet' : goal,
        shapes: [...SUPPORTED_SHAPES],
      },
    }
  }

  if (words.length < MIN_GOAL_WORDS) {
    return {
      ok: false,
      refusal: {
        reason: 'there is not enough here to build from — one full sentence is the whole requirement',
        understood: goal === '' ? 'nothing was described yet' : goal,
        shapes: [...SUPPORTED_SHAPES],
      },
    }
  }

  const shape = detectShape(goal, answers.shape)
  if (shape === undefined) {
    return {
      ok: false,
      refusal: {
        reason: 'this does not match a shape that one turn can deliver reliably',
        understood: goal,
        shapes: [...SUPPORTED_SHAPES],
      },
    }
  }

  const contract = SHAPE_CONTRACT[shape]
  const mustHave = (answers.mustHave ?? []).map(tidyRequirement).filter(item => item !== '')
  const acceptance = (answers.acceptance ?? []).map(tidyRequirement).filter(item => item !== '')

  return {
    ok: true,
    spec: {
      version: 1,
      shape,
      goal,
      audience: clean(answers.audience) === '' ? 'someone who has never seen this before' : clean(answers.audience),
      // A brief that needs more than seven hard requirements is two requests.
      mustHave: mustHave.slice(0, MAX_MUST_HAVE),
      nonGoals: [...(answers.nonGoals ?? []).map(tidyRequirement).filter(item => item !== ''),
        'no external accounts, no backend, no sign-in'],
      acceptance: acceptance.length === 0 ? contract.defaultAcceptance : acceptance,
      style: styleOf(answers),
      details: (answers.details ?? []).map(clean).filter(item => item !== ''),
      neverInvent: (answers.neverInvent ?? []).map(clean).filter(item => item !== '').length === 0
        ? ['testimonials, customer names, prices, dates, credentials, addresses that were not supplied']
        : (answers.neverInvent ?? []).map(clean).filter(item => item !== ''),
      lessons: lessonBlock(shape),
      decision: (() => {
        const all = readings(goal, shape)
        const taken = all[0]
        return taken === undefined ? '' : decisionBlock(taken, all.slice(1))
      })(),
      voice: voiceBlock(readVoice(), false),
      extrapolated: extrapolationBlock(extrapolate(answers, shape)),
      techLimits: clean(answers.techLimits) === ''
        ? `one file, opened directly by the person; no build step, no network at run time (${spec_shape_hint(shape)})`
        : clean(answers.techLimits),
      data: clean(answers.data),
      outputContract: { files: contract.files, entry: contract.entry },
      limits: { maxFiles: contract.maxFiles, maxBytes: contract.maxBytes },
    },
  }
}

/**
 * Explain a refusal for a person, in the same voice as the product.
 * @param refusal - the refusal produced by {@link normalise}.
 * @returns two short paragraphs of text.
 */
export function refusalText(refusal: {
  reason: string; understood: string; shapes: readonly Shape[]
}): string {
  const list = refusal.shapes.map(shape => `- ${shape}: ${SHAPE_CONTRACT[shape].example}`).join('\n')
  return [
    `Nothing was built, so nothing was spent. ${refusal.reason}.`,
    `What was understood: "${refusal.understood}".`,
    'What one turn can genuinely deliver:',
    list,
    'Pick the closest one, or split the request — the second turn is free of surprises.',
  ].join('\n')
}
