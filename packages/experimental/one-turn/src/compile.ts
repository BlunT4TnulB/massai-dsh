/**
 * The mask: a sealed spec becomes one prompt that assumes nothing and leaves
 * nothing to ask about.
 *
 * The section order is deliberate. Identity first (who is speaking), then the
 * brief in the person's own words (so intent is never paraphrased away), then
 * the shape contract (so the build cannot wander into another kind of artifact),
 * then hard constraints, then style as *values* rather than adjectives, then the
 * acceptance checks the build must satisfy before it may say it is done.
 *
 * Everything here is free to run. That is the point of separating compiling from
 * running: the mask is refined without spending a token.
 *
 * @module @deepseek-ai/dsh-one-turn/compile
 */

import { SHAPE_CONTRACT, type OneTurnSpec } from './spec.ts'

/** One section of the compiled mask, kept separate so its weight can be measured. */
export interface MaskSection {
  /** Stable key for logs and diffs. */
  readonly key: string
  /** Section body, already formatted. */
  readonly body: string
  /** Rough token estimate (characters / 4), good enough for budgeting. */
  readonly tokens: number
}

/** The compiled result handed to the build call. */
export interface CompiledMask {
  /** The prompt to send. */
  readonly text: string
  /** Per-section weight, so a bloated section is visible rather than guessed. */
  readonly sections: readonly MaskSection[]
  /** Total estimated tokens. */
  readonly tokens: number
  /** Total characters. */
  readonly characters: number
}

/** Approximate tokens without shipping a tokenizer: close enough for budgeting. */
function estimate(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Render a list as bullet lines, or '' when empty. */
function bullets(items: readonly string[], prefix = '- '): string {
  return items.map(item => `${prefix}${item}`).join('\n')
}

/** What the environment offers the build, stated plainly so it cannot be assumed wrong. */
const ENVIRONMENT = [
  'You are writing files into an empty workspace. Nothing is preinstalled beyond a standard toolchain.',
  'There is no internet at build time: no CDN links, no package installs, no fonts from the network.',
  'Anything visual must work from a single file opened directly in a browser.',
  'Write real content, never lorem ipsum, never a placeholder image.',
].join('\n')

/** The report the build must leave behind, so verification is not a guess. */
const OUTPUT_PROTOCOL = [
  'For each requirement in "must do", state the file and the few lines that satisfy it.',
  'Run your own acceptance checks and report each as PASS or FAIL with the observation.',
  'If a check cannot pass within the constraints, say so plainly instead of lowering the bar.',
  'Do not claim a check passed that you did not run.',
].join('\n')

/** The self-check ritual that turns one call into a real attempt. */
const SELF_CHECK = [
  'Before answering: open the entry file mentally as a stranger would.',
  'Walk each acceptance check once. Fix what fails. Then walk them again.',
  'Remove every element that does not serve the brief — unused sections are defects, not generosity.',
]

/**
 * Compile a spec into the mask.
 * @param spec - the sealed specification.
 * @returns the prompt plus per-section weight.
 */
export function compile(spec: OneTurnSpec): CompiledMask {
  const contract = SHAPE_CONTRACT[spec.shape]
  const sections: MaskSection[] = []

  const add = (key: string, body: string): void => {
    const trimmed = body.trim()
    sections.push({ key, body: trimmed, tokens: estimate(trimmed) })
  }

  add('identity', [
    'You are the builder behind Massai, a workshop that turns one clear request into one working thing.',
    'You do not negotiate, you do not ask questions: the brief below is complete by construction.',
    'Build the smallest artifact that satisfies it, then stop.',
  ].join('\n'))

  add('brief', [
    `THE REQUEST, IN THEIR WORDS: ${spec.goal}`,
    `WHO IT IS FOR: ${spec.audience}`,
    '',
    'MUST DO:',
    bullets(spec.mustHave.length === 0 ? ['satisfy the request as written'] : spec.mustHave),
    '',
    'MUST NOT DO:',
    bullets(spec.nonGoals),
  ].join('\n'))

  add('shape', [
    `THIS IS A ${spec.shape.toUpperCase()}. Build nothing else.`,
    `Files to produce: ${spec.outputContract.files.join(', ')}`,
    `Entry point: ${spec.outputContract.entry}`,
    `Ceiling: ${spec.limits.maxFiles} files, ${spec.limits.maxBytes} bytes total.`,
    spec.data === '' ? 'No data file is supplied; the artifact must carry its own content.' : `DATA FILE SUPPLIED: ${spec.data}`,
  ].join('\n'))

  if (spec.extrapolated !== '') add('extrapolated', spec.extrapolated)

  add('particulars', spec.details.length === 0
    ? [
        'NO PARTICULARS WERE SUPPLIED.',
        'Use only what the brief states. Where a specific value would be needed (a price, a phone number,',
        'a size, a date), leave a visible marker instead of inventing one: [your price].',
      ].join('\n')
    : [
        'THE PARTICULARS. Use these exactly; invent nothing beyond them:',
        bullets(spec.details),
      ].join('\n'))

  add('never-invent', [
    'NEVER INVENT ANY OF THE FOLLOWING. Leave a visible marker such as [your review] instead:',
    bullets(spec.neverInvent),
    'A visible blank is a correct answer. A plausible invention is a failed build.',
  ].join('\n'))

  add('runtime', [
    'WHERE IT RUNS — this decides whether it works at all:',
    spec.techLimits,
  ].join('\n'))

  add('constraints', ENVIRONMENT)

  add('style', [
    spec.style.reference === ''
      ? 'No visual reference was given, so the fallback applies:'
      : `MATCH THIS REFERENCE: ${spec.style.reference}`,
    `Palette: ${spec.style.palette}`,
    `Type: ${spec.style.type}`,
    `Spacing: ${spec.style.spacing}`,
    `Corners: ${spec.style.radius}`,
    `AVOID: ${spec.style.avoid}`,
    'Type sizes and spacing must be stated in numbers in the file, not left to taste.',
  ].join('\n'))

  add('acceptance', [
    'These checks define "done". Every one must pass:',
    bullets(spec.acceptance),
    '',
    `Shape defaults that also apply:`,
    bullets(contract.defaultAcceptance),
  ].join('\n'))

  if (spec.decision !== '') add('decision', spec.decision)
  if (spec.lessons !== '') add('lessons', spec.lessons)
  if (spec.voice !== '') add('voice', spec.voice)

  add('protocol', OUTPUT_PROTOCOL)

  add('self-check', SELF_CHECK.join('\n'))

  const text = sections.map(section => section.body).join('\n\n')
  return {
    text,
    sections,
    tokens: estimate(text),
    characters: text.length,
  }
}

/**
 * A short human-readable audit of the mask, for the console.
 * @param compiled - the compiled mask.
 * @returns aligned lines with per-section weight.
 */
export function maskAudit(compiled: CompiledMask): string {
  const width = Math.max(...compiled.sections.map(section => section.key.length))
  const lines = compiled.sections.map(section =>
    `${section.key.padEnd(width)}  ${String(section.tokens).padStart(5)} tok  ${String(section.body.length).padStart(6)} chars`)
  lines.push(`${'TOTAL'.padEnd(width)}  ${String(compiled.tokens).padStart(5)} tok  ${String(compiled.characters).padStart(6)} chars`)
  return lines.join('\n')
}
