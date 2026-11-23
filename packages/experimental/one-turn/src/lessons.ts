/**
 * Lessons: what went wrong before, remembered so the interview asks differently.
 *
 * Every failed trial is tagged with a failure bucket. Those tags accumulate per
 * shape, and the interview reads them back in two ways: it adds probes for the
 * buckets that keep biting, and the mask carries a short "this has gone wrong
 * before" section so the build itself is warned.
 *
 * Storage is a JSON file under the state directory. It survives restarts on a
 * machine with a disk; on an ephemeral host it lives as long as the container
 * does, which is the same lifespan as the trial artifacts it learns from. When
 * durable storage arrives (R2), this file moves there and nothing else changes.
 *
 * @module @deepseek-ai/dsh-one-turn/lessons
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** One remembered failure, aggregated by shape and bucket. */
export interface Lesson {
  /** The artifact shape the failure happened on. */
  readonly shape: string
  /** The failure bucket. */
  readonly bucket: string
  /** How many trials have failed this way. */
  readonly count: number
  /** Epoch ms of the most recent occurrence. */
  readonly at: number
  /** One short note, usually the check that failed. */
  readonly note: string
}

/** Where lessons live. */
export function lessonsPath(): string {
  return join(process.env.DSH_HOME ?? join(process.env.HOME ?? '/tmp', '.dsh'), 'one-turn', 'lessons.json')
}

/** Read everything remembered. Never throws: a missing or broken file is an empty shelf. */
export function readLessons(): Lesson[] {
  try {
    const parsed = JSON.parse(readFileSync(lessonsPath(), 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const row = item as Partial<Lesson>
      if (typeof row.shape !== 'string' || typeof row.bucket !== 'string') return []
      return [{
        shape: row.shape,
        bucket: row.bucket,
        count: Number(row.count ?? 1),
        at: Number(row.at ?? Date.now()),
        note: typeof row.note === 'string' ? row.note : '',
      }]
    })
  } catch {
    return []
  }
}

/** Write the whole shelf back. */
function writeLessons(lessons: readonly Lesson[]): void {
  try {
    const path = lessonsPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(lessons, null, 2), 'utf8')
  } catch {
    /* a failing disk must not break a trial */
  }
}

/**
 * Remember one failure, merging with any identical shape+bucket pair.
 * @param lesson - what failed, where, and the short note.
 */
export function recordLesson(lesson: { shape: string; bucket: string; note?: string }): void {
  const lessons = readLessons()
  const existing = lessons.find(row => row.shape === lesson.shape && row.bucket === lesson.bucket)
  const note = (lesson.note ?? '').slice(0, 160)
  if (existing === undefined) {
    writeLessons([...lessons, { shape: lesson.shape, bucket: lesson.bucket, count: 1, at: Date.now(), note }])
    return
  }
  writeLessons(lessons.map(row => row === existing
    ? { ...row, count: row.count + 1, at: Date.now(), note: note === '' ? row.note : note }
    : row))
}

/**
 * What has gone wrong for this shape, worst first.
 * @param shape - the artifact shape.
 * @param minimum - ignore buckets seen fewer times than this.
 * @returns the remembered lessons for that shape.
 */
export function lessonsFor(shape: string, minimum = 1): Lesson[] {
  return readLessons()
    .filter(row => row.shape === shape && row.count >= minimum)
    .sort((a, b) => b.count - a.count)
}

/** One plain-language sentence per bucket, for the mask and the interview. */
const BUCKET_ADVICE: Readonly<Record<string, string>> = {
  'missed-requirement': 'a stated requirement was silently dropped',
  'hallucinated-detail': 'a specific was invented instead of left blank',
  'wrong-shape': 'the wrong kind of artifact was built',
  'style-drift': 'the look ignored the stated values',
  'broken-run': 'it did not run when opened',
  overbuilt: 'it grew sections and files nobody asked for',
  underbuilt: 'it was visibly incomplete',
  'refused-wrongly': 'a supported request was refused',
}

/**
 * The warning block the mask carries, built from the shelf.
 * @param shape - the artifact shape being built.
 * @returns lines for the mask, or '' when this shape has no history.
 */
export function lessonBlock(shape: string): string {
  const remembered = lessonsFor(shape, 1)
  if (remembered.length === 0) return ''
  const lines = remembered.slice(0, 4).map(lesson =>
    `- ${BUCKET_ADVICE[lesson.bucket] ?? lesson.bucket} (${lesson.count} previous build${lesson.count === 1 ? '' : 's'} failed this way${lesson.note === '' ? '' : `: ${lesson.note}`})`)
  return [
    'THIS SHAPE HAS FAILED BEFORE. The failures are listed below; do not repeat them:',
    ...lines,
    'If a line above conflicts with the brief, the brief wins — but say so in your report.',
  ].join('\n')
}

/**
 * Map a failed check onto the failure bucket it represents.
 * @param check - the check key from a trial.
 * @param detail - its detail line.
 * @returns the bucket, or undefined when the check passed.
 */
export function bucketOfCheck(check: string, detail: string): string | undefined {
  switch (check) {
    case 'requirements-traced': return 'missed-requirement'
    case 'no-placeholders': return 'hallucinated-detail'
    case 'no-external-requests': return 'broken-run'
    case 'entry-exists': return 'broken-run'
    case 'size':
    case 'file-count': return detail.includes('ceiling') ? 'overbuilt' : 'underbuilt'
    default: return undefined
  }
}
