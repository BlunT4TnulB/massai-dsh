/**
 * Visitor notes: a small form anyone can use before signing up, written to a
 * JSONL file beside the harness home, plus a semi-live view for the owner.
 *
 * @module @deepseek-ai/dsh-hosted-signin/feedback
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** One note as stored. */
export interface FeedbackNote {
  /** ISO timestamp of submission. */
  at: string
  /** What the visitor is building. */
  text: string
  /** Optional contact. */
  email?: string
}

/** Where notes land: `<harness home>/massai-feedback.jsonl`. */
function notesPath(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'massai-feedback.jsonl')
}

/**
 * Append one note.
 * @param note - the submitted note.
 */
export function saveNote(note: FeedbackNote): void {
  const path = notesPath()
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(note)}\n`, 'utf8')
}

/**
 * Read the newest notes, newest first.
 * @param limit - maximum entries to return.
 * @returns the notes that could be parsed.
 */
export function recentNotes(limit = 50): FeedbackNote[] {
  const path = notesPath()
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8').split('\n').filter(line => line.trim() !== '')
  const notes: FeedbackNote[] = []
  for (const line of lines.slice(-limit)) {
    try {
      notes.push(JSON.parse(line) as FeedbackNote)
    } catch {
      /* a torn line is skipped, never fatal */
    }
  }
  return notes.reverse()
}

/** Shared page chrome for the note pages. */
const CHROME = (title: string, body: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;
    background:#0e0e10;color:#F2F2F4;font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 18% 8%,rgba(193,68,14,.14),transparent 70%)}
  .win{width:100%;max-width:32rem;border-radius:1rem;overflow:hidden;background:#17171c;
    border:1px solid #2c2c33;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .bar{display:flex;align-items:center;gap:.55rem;padding:.6rem .9rem;background:#1d1d24;
    border-bottom:1px solid #2a2a31;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:#8a8a93;font-weight:600}
  .bar .dot{width:.5rem;height:.5rem;border-radius:50%;background:#33333c}
  .bar .dot:first-child{background:#C1440E}
  .card{padding:1.5rem 1.6rem}
  h1{margin:.1rem 0 .5rem;font-size:1.5rem;font-weight:700}
  p{margin:.4rem 0;color:#a6a6b0;font-size:.9rem;line-height:1.6;font-weight:500}
  textarea,input[type=email]{width:100%;padding:.7rem .85rem;border-radius:.5rem;border:1px solid #3a3a44;
    background:#101014;color:#F2F2F4;font:inherit;font-size:.92rem}
  textarea{min-height:7rem;resize:vertical}
  label{display:block;margin:.9rem 0 .4rem;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#82828b;font-weight:600}
  button{margin-top:1rem;padding:.65rem 1.2rem;border-radius:.5rem;border:none;background:#2f6fed;color:#fff;
    font-weight:600;font-size:.92rem;cursor:pointer}
  a{color:#7ee2a8;text-decoration:none}
  .note{border:1px solid #2a2a33;border-radius:.6rem;padding:.75rem .85rem;margin:.6rem 0;background:#1b1b22}
  .note time{display:block;color:#6f6f78;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.25rem}
  .note p{margin:0;color:#d6d6de;font-size:.9rem;white-space:pre-wrap}
  .note .mail{color:#82828b;font-size:.75rem;margin-top:.3rem}
  .empty{color:#6f6f78;font-size:.87rem}
</style></head><body><div class="win">
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
    <span style="flex:1"></span><span>massai · notes</span></div>
  <div class="card">${body}</div>
</div></body></html>`

/** The note form. */
export function feedbackPageHtml(): string {
  return CHROME('Massai — tell us what you\'re building', `
    <h1>What are you building?</h1>
    <p>One line is plenty. It goes straight to the person who runs this and it shapes what
    gets built next. No account needed.</p>
    <form method="POST" action="/api/feedback">
      <label for="text">Your note</label>
      <textarea id="text" name="text" required maxlength="1000"
        placeholder="A recipe box for my mum…"></textarea>
      <label for="email">Email (optional — only if you want a reply)</label>
      <input id="email" type="email" name="email" maxlength="200" placeholder="you@example.com">
      <button type="submit">Send it</button>
    </form>
    <p style="margin-top:1rem"><a href="/">← back to the door</a></p>`)
}

/** Confirmation page after a note is stored. */
export function thanksPageHtml(): string {
  return CHROME('Massai — thank you', `
    <h1>Got it. Thank you.</h1>
    <p>Your note is in. If you left an email, you may hear back — otherwise know it was read.</p>
    <p style="margin-top:1.2rem"><a href="/">← back to the door</a></p>`)
}

/**
 * The owner's semi-live view.
 * @param notes - notes to show, newest first.
 * @returns the page.
 */
export function recentPageHtml(notes: readonly FeedbackNote[]): string {
  const body = notes.length === 0
    ? '<p class="empty">No notes yet.</p>'
    : notes.map(note => `<div class="note"><time>${note.at}</time><p>${escapeHtml(note.text)}</p>${note.email === undefined ? '' : `<div class="mail">${escapeHtml(note.email)}</div>`}</div>`).join('')
  return CHROME('Massai — notes', `
    <h1>Notes from visitors</h1>
    <p>Newest first · ${notes.length} shown</p>
    <div style="margin-top:1rem">${body}</div>
    <p style="margin-top:1.2rem"><a href="/start">← start page</a></p>`)
}

/**
 * Escape one user-supplied string for HTML text.
 * @param value - raw text.
 * @returns the escaped text.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
