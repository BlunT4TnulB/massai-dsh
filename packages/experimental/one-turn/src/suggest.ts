/**
 * The suggester: an interview that already knows, rather than one that asks.
 *
 * The difference between a guided form and a conversation with someone competent
 * is that the competent one leads with an opinion. So every step here arrives
 * with a *suggested answer* and a reason, and the person accepts with one tap or
 * types over it. Questions whose answer is confidently inferred are marked as
 * skippable-with-confidence, and the interview can stop early.
 *
 * Its opinions come from three places, in order of trust:
 *   1. the shape contract — what this kind of artifact always needs
 *   2. the shelf — what went wrong on this shape before (lessons)
 *   3. the words in the request — domain hedging
 *
 * @module @deepseek-ai/dsh-one-turn/suggest
 */

import { interview, probes, type Question } from './intake.ts'
import { lessonsFor } from './lessons.ts'
import { detectShape } from './normalise.ts'
import { SHAPE_CONTRACT, SUPPORTED_SHAPES, type Shape } from './spec.ts'

/** A suggestion the person can accept, or type over. */
export interface Suggestion {
  /** The pre-filled answer. */
  readonly value: string
  /** How much the system believes it. */
  readonly confidence: 'high' | 'medium' | 'low'
  /** Why this was suggested, in plain words. */
  readonly reason: string
}

/** One step of the interview: a single question, leading with an opinion. */
export interface InterviewStep {
  /** The question key. */
  readonly key: string
  /** The question, in the product's voice. */
  readonly ask: string
  /** Hint under the field, when there is one. */
  readonly hint: string
  /** The suggested answer, or undefined when there is nothing honest to suggest. */
  readonly suggestion?: Suggestion
  /** What skipping does. */
  readonly fallback: string
  /** The failure this prevents. */
  readonly prevents: string
  /** True when the suggestion is strong enough to skip without reading. */
  readonly canSkip: boolean
  /** 1-based position, for a progress line that never shows a total façade. */
  readonly position: number
}

/** Confidence in a shape inferred from words. */
function shapeConfidence(goal: string, shape: Shape): 'high' | 'medium' | 'low' {
  const text = ` ${goal.toLowerCase()} `
  const words = SHAPE_CONTRACT[shape].example.toLowerCase().split(/\s+/).filter(word => word.length > 4)
  const hits = words.filter(word => text.includes(word)).length
  if (hits >= 2) return 'high'
  if (hits === 1) return 'medium'
  return 'low'
}

/** Plain-language defaults per question key, used when the shelf is empty. */
const DEFAULT_SUGGESTIONS: Readonly<Record<string, string>> = {
  audience: 'someone who has never seen this before',
  mustHave: '',
  rejectWhy: 'if it looks like a generic template, or if any specific was invented',
  neverInvent: 'testimonials, prices, dates, credentials, addresses that were not supplied',
  nonGoals: 'no gallery, no newsletter, no chat widget, no sign-in',
  techLimits: 'one file opened directly in the browser; no build step, no internet',
  dataSource: 'none — the artifact carries its own content',
}

/** Templates for probes: the shape of a good answer, so nobody faces a blank box. */
const PROBE_TEMPLATES: Readonly<Record<string, { readonly value: string; readonly reason: string }>> = {
  dimensions: {
    value: '[OD] × [ID] × [length] × [qty] — fill what you know, leave the rest as [brackets]',
    reason: 'sizes are the details people most often get wrong, so the template keeps them explicit',
  },
  prices: {
    value: '[price] per [what], [tax included?] — or a range if it varies',
    reason: 'an invented price is the most expensive mistake in this shape',
  },
  wording: {
    value: 'paste the exact clause, or write "paraphrase only, no legal claims"',
    reason: 'legal wording must never be improvised',
  },
  brandTokens: {
    value: '[hex] ground, [hex] text, [hex] accent, [font] for headings',
    reason: 'codes and font names are obeyed; adjectives are guessed at',
  },
  contact: {
    value: '[phone] · [hours] · [address]',
    reason: 'invented contact details send real people nowhere',
  },
  facts: {
    value: '[employer] · [dates] · [exact title] · [amount]',
    reason: 'anything not listed here becomes a visible blank instead of a plausible invention',
  },
  columns: {
    value: '[field], [field], [field] — requested view first, the rest after',
    reason: 'naming the fields is what makes a data view correct rather than generic',
  },
  units: {
    value: '[currency] [thousands?] [decimals?]',
    reason: 'units are where silent wrongness hides',
  },
}

/** Shape-specific pre-fills that make the interview feel like it read the request. */
const SHAPE_SUGGESTIONS: Readonly<Record<Shape, Readonly<Record<string, string>>>> = {
  'single-page-site': {
    sections: 'hero, what we do with prices, proof, contact — in that order',
    contact: '[your phone] · [your hours] · [your address]',
  },
  'single-file-app': {
    rules: 'show the main control first; every change updates the result immediately; bad input shows a plain warning',
    persistence: 'nothing survives a reload unless the brief asks for it',
  },
  script: {
    runtime: 'Python 3, standard library only, runs on Windows and macOS',
    safety: 'dry-run by default; writes only inside the folder given; never deletes',
  },
  'data-view': {
    columns: 'every field present, the requested view first, alphabetical after',
    units: 'no currency symbol; two decimal places',
  },
  document: {
    facts: '[employer] · [dates] · [titles] — everything else becomes a marked blank',
    length: 'one page, read by a busy stranger',
  },
}

/**
 * Build the suggestion for one question.
 * @param key - the question key.
 * @param goal - the request as typed.
 * @param shape - the shape, when known.
 * @returns the suggestion, or undefined when there is nothing honest to say.
 */
export function suggestFor(key: string, goal: string, shape: Shape | undefined): Suggestion | undefined {
  const template = PROBE_TEMPLATES[key]
  if (template !== undefined) {
    return { value: template.value, confidence: 'medium', reason: template.reason }
  }

  if (key === 'shape' && shape !== undefined) {
    const confidence = shapeConfidence(goal, shape)
    return { value: shape, confidence, reason: 'read from the words you used' }
  }

  if (key === 'styleWords') {
    const remembered = shape === undefined ? [] : lessonsFor(shape, 1)
    const styleFailures = remembered.find(lesson => lesson.bucket === 'style-drift')
    return {
      value: 'calm, confident, modern — a restrained two-colour palette',
      confidence: styleFailures === undefined ? 'medium' : 'high',
      reason: styleFailures === undefined
        ? 'a safe default that reads well on a phone'
        : `this shape has drifted before (${styleFailures.count}×), so values are suggested rather than words left open`,
    }
  }

  if (key === 'details' || key === 'particulars') {
    const remembered = shape === undefined ? [] : lessonsFor(shape, 1)
    const inventions = remembered.find(lesson => lesson.bucket === 'hallucinated-detail')
    if (inventions !== undefined) {
      return {
        value: '',
        confidence: 'high',
        reason: `invented details are the #1 failure on this shape (${inventions.count}×) — this box is worth two minutes`,
      }
    }
    return { value: '', confidence: 'medium', reason: 'the single most valuable box on the page' }
  }

  const fromShape = shape === undefined ? undefined : SHAPE_SUGGESTIONS[shape][key]
  if (fromShape !== undefined) {
    return { value: fromShape, confidence: 'high', reason: 'the standard shape for this kind of artifact' }
  }

  const fallback = DEFAULT_SUGGESTIONS[key]
  if (fallback !== undefined && fallback !== '') {
    return { value: fallback, confidence: 'medium', reason: 'a safe default, stated so it can be changed' }
  }

  return undefined
}

/** Turn one question and its suggestion into a step. */
function toStep(question: Question, position: number, goal: string, shape: Shape | undefined): InterviewStep {
  const suggestion = suggestFor(question.key, goal, shape)
  return {
    key: question.key,
    ask: question.ask,
    hint: question.hint ?? '',
    ...(suggestion === undefined ? {} : { suggestion }),
    fallback: question.fallback,
    prevents: question.prevents,
    canSkip: suggestion !== undefined && suggestion.confidence === 'high',
    position,
  }
}

/**
 * The next thing worth asking, given what is already known.
 *
 * This is one step at a time on purpose: a form of ten fields feels like paperwork,
 * while one question with a good opinion feels like a colleague. Probes earned by
 * the request come before the remaining stock questions, because they are the ones
 * that change the outcome.
 *
 * @param answers - keys already answered (values optional; only presence matters).
 * @param context - the request and shape so far.
 * @returns the next step, or `done` when nothing valuable is left to ask.
 */
export function nextStep(
  answers: Readonly<Record<string, string | readonly string[] | undefined>>,
  context: { readonly goal: string; readonly shape?: string },
): InterviewStep | { readonly done: true; readonly asked: number } {
  const shape = SUPPORTED_SHAPES.find(candidate => candidate === context.shape)
    ?? detectShape(context.goal)
  const answered = new Set(Object.keys(answers).filter(key => {
    const value = answers[key]
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim() !== ''
  }))

  const earned = probes({ goal: context.goal, ...(context.shape === undefined ? {} : { shape: context.shape }) })
  let position = answered.size + 1

  for (const probe of earned) {
    if (answered.has(probe.key)) continue
    const suggestion = suggestFor(probe.key, context.goal, shape)
    return {
      key: probe.key,
      ask: probe.ask,
      hint: probe.hint ?? probe.because,
      ...(suggestion === undefined ? {} : { suggestion }),
      fallback: probe.fallback,
      prevents: probe.prevents,
      canSkip: suggestion !== undefined && suggestion.confidence === 'high',
      position,
    }
  }

  for (const question of interview()) {
    if (answered.has(question.key)) continue
    // The shape question is worthless once the shape is known.
    if (question.key === 'shape' && shape !== undefined) continue
    position = answered.size + 1
    return toStep(question, position, context.goal, shape)
  }

  return { done: true, asked: answered.size }
}
