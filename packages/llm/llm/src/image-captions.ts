/**
 * Durable image captions: a text description of each image, produced once by a
 * vision model and reused whenever a text-only model must work with that image.
 *
 * An image can never be handed to a text-only model, and the harness refuses the
 * request rather than silently omitting it. A caption turns that refusal into a
 * usable projection: the text model reads what the picture shows, in words.
 *
 * @module @deepseek-ai/dsh-llm
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** One stored caption. */
export interface ImageCaption {
  /** The description text. */
  text: string
  /** Model that produced it. */
  model: string
  /** When it was produced (ms since epoch). */
  at: number
}

/** Storage shape on disk. */
interface CaptionFile {
  version: 1
  captions: Record<string, ImageCaption>
}

/** Path of the caption store. */
export function imageCaptionPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'image-captions.json')
}

/**
 * Read the whole caption store.
 * @returns captions keyed by attachment id.
 */
function readStore(path: string): CaptionFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<CaptionFile>
    if (parsed.version !== 1 || typeof parsed.captions !== 'object' || parsed.captions === null) {
      return { version: 1, captions: {} }
    }
    return { version: 1, captions: parsed.captions }
  } catch {
    return { version: 1, captions: {} }
  }
}

/**
 * Look up a stored caption.
 * @param attachmentId - durable attachment identity (`sha256:…`).
 * @param path - store path, overridable for tests.
 * @returns the caption, or undefined when none was produced yet.
 */
export function readImageCaption(attachmentId: string, path: string = imageCaptionPath()): ImageCaption | undefined {
  return readStore(path).captions[attachmentId]
}

/**
 * Store a caption for one attachment, atomically.
 * @param attachmentId - durable attachment identity.
 * @param caption - the description and its provenance.
 * @param path - store path, overridable for tests.
 */
export function writeImageCaption(attachmentId: string, caption: ImageCaption, path: string = imageCaptionPath()): void {
  try {
    const store = readStore(path)
    store.captions[attachmentId] = caption
    mkdirSync(dirname(path), { recursive: true })
    const temporary = `${path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, JSON.stringify(store), 'utf8')
    renameSync(temporary, path)
  } catch {
    /* a lost caption only costs one extra vision call later */
  }
}

/**
 * Render a caption as the text a text-only model receives in place of the image.
 * @param caption - stored caption.
 * @returns projection text.
 */
export function captionProjection(caption: ImageCaption): string {
  return `[image described by ${caption.model}, because this model accepts text only]\n${caption.text}`
}
