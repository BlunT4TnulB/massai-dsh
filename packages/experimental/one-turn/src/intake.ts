/**
 * The intake questions, as data.
 *
 * The interview is what makes the mask possible: by the time the expensive call
 * happens, every ambiguity the model would otherwise have to guess about has
 * either been answered or given a stated default. Defined here as plain data so
 * a web form, a CLI, or a test can render the same interview and never drift.
 *
 * @module @deepseek-ai/dsh-one-turn/intake
 */

import { SHAPE_CONTRACT, SUPPORTED_SHAPES } from './spec.ts'

/** One question in the interview. */
export interface Question {
  /** Key the answer is stored under. */
  readonly key: string
  /** The question, in the product's voice. */
  readonly ask: string
  /** What happens when it is skipped. */
  readonly fallback: string
  /** Hint text under the field. */
  readonly hint?: string
  /** Prefilled choices, when a free-text answer is worse. */
  readonly choices?: readonly string[]
  /** Whether an empty answer is a refusal rather than a default. */
  readonly required: boolean
}

/** The interview, in the order it is asked. The first two carry most of the value. */
export function interview(): readonly Question[] {
  return [
    {
      key: 'goal',
      ask: 'What should exist when this is done?',
      fallback: 'nothing — this one is required',
      hint: 'One sentence, your own words. Do not tidy it up.',
      required: true,
    },
    {
      key: 'shape',
      ask: 'Which of these is it closest to?',
      fallback: 'inferred from your sentence; if that fails, you are asked',
      choices: SUPPORTED_SHAPES,
      required: false,
    },
    {
      key: 'audience',
      ask: 'Who is it for?',
      fallback: 'someone who has never seen this before',
      required: false,
    },
    {
      key: 'mustHave',
      ask: 'Three things it must do.',
      fallback: 'derived from your first sentence',
      hint: 'Each one testable: "shows the phone number", not "feels professional".',
      required: false,
    },
    {
      key: 'nonGoals',
      ask: 'One thing it must NOT do.',
      fallback: 'no external accounts, no backend, no sign-in',
      required: false,
    },
    {
      key: 'reference',
      ask: 'Any look you want to match?',
      fallback: 'a restrained two-colour palette with one accent',
      hint: 'A link or an image. Without one, "beautiful" is luck.',
      required: false,
    },
    {
      key: 'data',
      ask: 'Where does the data come from?',
      fallback: 'none — the artifact carries its own content',
      required: false,
    },
    {
      key: 'acceptance',
      ask: 'What must be true for you to accept it?',
      fallback: 'the standard checks for this shape',
      required: false,
    },
    {
      key: 'notes',
      ask: 'Anything else, or anything already built to reuse?',
      fallback: 'nothing',
      required: false,
    },
  ]
}

/**
 * What each shape promises, for the intake screen: an example and its checks.
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
