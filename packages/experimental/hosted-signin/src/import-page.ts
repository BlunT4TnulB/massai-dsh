/**
 * Universal conversation import: paste a transcript from Gemini, ChatGPT, Claude
 * or anywhere else, and it is distilled into a durable memory record that later
 * sessions recall.
 *
 * Deliberately format-agnostic. Each provider exports differently; every one of
 * them can be copied and pasted. This trades fidelity (attachments, exact times)
 * for a single path that works for all of them today.
 *
 * @module @deepseek-ai/dsh-hosted-signin/import-page
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** One durable memory record, matching the shape `session-memory` writes. */
export interface MemoryRecord {
  at: number
  cwd: string
  session: string
  text: string
}

/** Label stored as the record's project so recall can treat imports specially. */
export const IMPORTED_PROJECT = '_imported'

/** Where memory files live. */
function memoryDir(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'memory')
}

/**
 * Append one imported summary to the shared imported-knowledge file.
 * @param record - the record to store.
 * @returns whether it was written.
 */
export function appendImported(record: MemoryRecord): boolean {
  try {
    const dir = memoryDir()
    mkdirSync(dir, { recursive: true })
    const path = join(dir, `${IMPORTED_PROJECT}.jsonl`)
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
    appendFileSync(path, `${existing.endsWith('\n') || existing === '' ? '' : '\n'}${JSON.stringify(record)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}

/** Escape one string for HTML text. */
function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Render the import page.
 * @param message - optional result line to show.
 * @returns the page HTML.
 */
export function importPageHtml(message = ''): string {
  const dir = memoryDir()
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — import a conversation</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.13),transparent 70%)}
  main{max-width:46rem;margin:0 auto}
  h1{margin:0 0 .4rem;font-size:1.25rem;font-weight:700}
  .lede{margin:0 0 1.4rem;color:#a9a9b3;font-size:.9rem;line-height:1.6}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin-bottom:1rem}
  h2{margin:0 0 .6rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  label{display:block;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#82828b;font-weight:600;margin:.6rem 0 .3rem}
  input,textarea,select{width:100%;padding:.6rem .7rem;border-radius:.5rem;border:1px solid #3a3a44;
    background:#101014;color:#F2F2F4;font:inherit;font-size:.88rem}
  textarea{min-height:14rem;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;line-height:1.5}
  button{margin-top:.9rem;padding:.6rem 1rem;border-radius:.5rem;border:none;background:#C1440E;color:#fff;
    font-weight:700;font-size:.9rem;cursor:pointer}
  button:hover{background:#d4531a}
  .ok{margin:.8rem 0 0;color:#7ee2a8;font-size:.85rem}
  .bad{margin:.8rem 0 0;color:#f0b46a;font-size:.85rem}
  .hint{margin:.5rem 0 0;font-size:.76rem;color:#6f6f78;line-height:1.6}
  code{background:#1f1f27;padding:.1rem .3rem;border-radius:.3rem;font-size:.78rem}
  a{color:#7ee2a8;text-decoration:none}
  .foot{margin-top:1.2rem;font-size:.8rem;color:#6f6f78}
</style></head><body><main>
<h1>Bring a conversation in</h1>
<p class="lede">Paste a conversation from Gemini, ChatGPT, Claude — anywhere. It is summarised once and
kept as knowledge your next sessions will recall: the decisions, the traps, the useful bits.</p>

<section>
  <h2>The paste</h2>
  <form method="POST" action="/api/import/paste">
    <label for="title">What was it about? (optional)</label>
    <input id="title" name="title" placeholder="Gemini: database schema for the shop app">
    <label for="transcript">The conversation</label>
    <textarea id="transcript" name="transcript" placeholder="Paste the whole exchange here — questions and answers, in order." required></textarea>
    <button type="submit">Import and remember</button>
  </form>
  ${message.startsWith('ok:') ? `<p class="ok">${esc(message.slice(3))}</p>` : ''}
  ${message.startsWith('bad:') ? `<p class="bad">${esc(message.slice(4))}</p>` : ''}
  <p class="hint">Imports are stored as a summary in <code>${esc(join(dir, `${IMPORTED_PROJECT}.jsonl`))}</code>.
  Nothing is sent anywhere except the one summarisation call on this deployment's own model.</p>
</section>

<section>
  <h2>How to get a transcript</h2>
  <p class="hint">Gemini: open the conversation, select the turns, copy. ChatGPT: same. Claude: same.
  A shared link's text works too. There is no format to match — plain text is fine.</p>
</section>

<p class="foot"><a href="/">← The door</a> &nbsp;·&nbsp; <a href="/memory">What Massai remembers</a></p>
</main></body></html>`
}
