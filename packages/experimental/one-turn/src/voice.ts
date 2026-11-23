/**
 * Voice: the operator's own reference points, usable as style without becoming a
 * liability.
 *
 * A workshop has a character. Massai's is playful, absurdist, machine-room warm,
 * and fond of a bad pun — "into the unknown", fiber tubing, squirting off in five
 * directions at once. That voice makes the product feel like a person built it,
 * which is most of why anyone trusts it.
 *
 * But a voice written straight into a build is a hazard: the crude joke lands in
 * a client's invoice, or the in-joke confuses a stranger. So the voice is stored
 * as **material**, not as text — rhythm, metaphor, reference points, with an
 * explicit instruction to borrow the energy and never print the profanity in
 * anything a third party will see.
 *
 * @module @deepseek-ai/dsh-one-turn/voice
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** A stored voice: who it belongs to, and how it should be used. */
export interface Voice {
  /** A short label, for the console. */
  readonly name: string
  /** Plain-language description of the character. */
  readonly character: string
  /** Reference points: the things this person actually says and laughs at. */
  readonly references: readonly string[]
  /** False when the voice should not touch the artifact at all. */
  readonly enabled: boolean
  /** Hard line: what must never appear in an artifact a third party sees. */
  readonly neverPrint: readonly string[]
}

/** The voice the workshop ships with. */
export function defaultVoice(): Voice {
  return {
    name: 'the workshop',
    character: 'playful, absurdist, warm, a bad pun away from a good idea; never precious, never corporate',
    references: [
      'into the unknown',
      'a workbench, not a vault',
      'fiber tubing',
      'squirting off in five directions',
      'massai massai massai',
      'tip jar, not a shop',
    ],
    enabled: true,
    neverPrint: [
      'profanity and crude words, however funny',
      'drunk typing and typos',
      'private in-jokes that a stranger could not follow',
      'anything mocking a real person',
    ],
  }
}

/** Where the voice file lives. */
export function voicePath(): string {
  return join(process.env.DSH_HOME ?? join(process.env.HOME ?? '/tmp', '.dsh'), 'one-turn', 'voice.json')
}

/**
 * Read the stored voice, falling back to the shipped one.
 * @returns the voice in effect.
 */
export function readVoice(): Voice {
  try {
    if (!existsSync(voicePath())) return defaultVoice()
    const parsed = JSON.parse(readFileSync(voicePath(), 'utf8')) as Partial<Voice>
    const base = defaultVoice()
    return {
      name: typeof parsed.name === 'string' ? parsed.name : base.name,
      character: typeof parsed.character === 'string' ? parsed.character : base.character,
      references: Array.isArray(parsed.references) ? parsed.references.filter((item): item is string => typeof item === 'string') : base.references,
      enabled: parsed.enabled !== false,
      neverPrint: Array.isArray(parsed.neverPrint) ? parsed.neverPrint.filter((item): item is string => typeof item === 'string') : base.neverPrint,
    }
  } catch {
    return defaultVoice()
  }
}

/**
 * Store a voice.
 * @param voice - what to remember.
 */
export function writeVoice(voice: Voice): void {
  const path = voicePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(voice, null, 2), 'utf8')
}

/**
 * The mask section the voice contributes.
 *
 * Deliberately short and strictly bounded: borrow the rhythm, keep the substance
 * plain, and never let a joke into a caption a customer reads.
 * @param voice - the voice in effect.
 * @param personal - true when the artifact is for the person who made it, not for strangers.
 * @returns the section body, or '' when the voice is disabled.
 */
export function voiceBlock(voice: Voice, personal: boolean): string {
  if (!voice.enabled) return ''
  const lines = [
    `VOICE — borrow the rhythm, never the profanity: ${voice.character}.`,
    `REFERENCE POINTS (use their spirit, do not quote them at a stranger): ${voice.references.join('; ')}.`,
  ]
  if (personal) {
    lines.push('This artifact is for the person who asked, so a light in-joke is welcome in one place at most.')
  } else {
    lines.push('This artifact is public, so keep all copy plain and professional; the playfulness shows in the layout and naming, never in a claim a customer reads.')
  }
  lines.push(`NEVER PRINT: ${voice.neverPrint.join('; ')}.`)
  return lines.join('\n')
}
