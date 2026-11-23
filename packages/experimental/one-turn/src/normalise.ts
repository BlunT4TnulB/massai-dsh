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
const DOC_HINTS = ['resume', 'cv', 'invoice', 'readme', 'contract', 'letter', 'one-pager', 'proposal']

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

/** Pick the shape from explicit choice, then keywords, then nothing. */
function inferShape(goal: string, chosen: string | undefined): Shape | undefined {
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

/** Turn "I want a page that has X" into a bare requirement, without inventing content. */
function tidyRequirement(value: string): string {
  return clean(value)
    .replace(/^(it|this|that)\s+(must|should|needs? to|has to)\s+/i, '')
    .replace(/^(please|also|and)\s+/i, '')
    .replace(/[.;]+$/, '')
}

/** Default acceptance checks for a style with no reference: honest, not aspirational. */
function styleOf(answers: IntakeAnswers): OneTurnSpec['style'] {
  const reference = clean(answers.reference)
  return {
    reference,
    palette: reference === ''
      ? 'a restrained two-colour palette with one accent; no gradients, no stock-photo feel'
      : 'derived from the reference',
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

  const shape = inferShape(goal, answers.shape)
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
