/**
 * The memory page: what the agent has learned about each project, in the open.
 *
 * Session memory is written by the `session-memory` plugin; this page reads the
 * same files so the owner can see exactly what will be recalled into a future
 * session — and delete anything wrong. A memory you cannot inspect is a rumour.
 *
 * @module @deepseek-ai/dsh-hosted-signin/memory-page
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** One durable record written by the memory plugin. */
interface MemoryRecord {
  at: number
  cwd: string
  session: string
  text: string
}

/** Where the plugin keeps its records. */
function memoryDir(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'memory')
}

/**
 * Read every record from every project.
 * @returns records grouped by project file, newest first.
 */
function readAll(): Array<{ project: string; records: MemoryRecord[] }> {
  const dir = memoryDir()
  if (!existsSync(dir)) return []
  const groups: Array<{ project: string; records: MemoryRecord[] }> = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue
    const records: MemoryRecord[] = []
    try {
      for (const line of readFileSync(join(dir, name), 'utf8').split('\n')) {
        if (line.trim() === '') continue
        try {
          const parsed = JSON.parse(line) as MemoryRecord
          if (typeof parsed.text === 'string') records.push(parsed)
        } catch {
          /* skip a torn line */
        }
      }
    } catch {
      continue
    }
    if (records.length === 0) continue
    records.sort((a, b) => b.at - a.at)
    groups.push({ project: name.replace(/\.jsonl$/, ''), records })
  }
  groups.sort((a, b) => (b.records[0]?.at ?? 0) - (a.records[0]?.at ?? 0))
  return groups
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
 * Render the memory page.
 * @returns the page HTML.
 */
export function memoryPageHtml(): string {
  const groups = readAll()
  const total = groups.reduce((sum, group) => sum + group.records.length, 0)
  const body = groups.length === 0
    ? `<p class="empty">Nothing learned yet. A session with six or more turns is distilled
       once at its end, and the next session in the same project starts with it.</p>`
    : groups.map((group) => {
      const cards = group.records.map((record) => {
        const when = new Date(record.at).toISOString().replace('T', ' ').slice(0, 16)
        const lines = record.text.split('\n').map(line => line.trim()).filter(line => line !== '')
        const sections = lines.map((line) => {
          const match = /^(WORK|PITFALLS|TOOLS|NEXT):\s*(.*)$/i.exec(line)
          if (match === null) return `<p class="line">${esc(line)}</p>`
          const tone = match[1]?.toUpperCase() === 'PITFALLS' ? 'warn' : match[1]?.toUpperCase() === 'NEXT' ? 'good' : 'muted'
          return `<p class="line"><span class="tag ${tone}">${esc(String(match[1]))}</span> ${esc(match[2] ?? '')}</p>`
        }).join('')
        return `<div class="card"><div class="meta">${when} · session ${esc(record.session.slice(0, 22))}</div>${sections}</div>`
      }).join('')
      return `<section><h2>${esc(group.project)} <span class="count">${String(group.records.length)}</span></h2>${cards}</section>`
    }).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — memory</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(77,107,254,.12),transparent 70%)}
  main{max-width:54rem;margin:0 auto}
  header{display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem}
  h1{margin:0;font-size:1.1rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700}
  .flag{margin-left:auto;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#D9822B;font-weight:600}
  .lede{margin:.5rem 0 1.4rem;color:#a9a9b3;font-size:.88rem;line-height:1.6}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1rem 1.1rem;margin-bottom:1rem}
  h2{margin:0 0 .7rem;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  .count{color:#C1440E;margin-left:.3rem}
  .card{border:1px solid #26262d;border-radius:.55rem;padding:.65rem .75rem;margin-bottom:.5rem;background:#1b1b22}
  .meta{color:#6f6f78;font-size:.68rem;letter-spacing:.06em;margin-bottom:.35rem}
  .line{margin:.18rem 0;font-size:.84rem;color:#d2d2da;line-height:1.55}
  .tag{display:inline-block;padding:.02rem .35rem;border-radius:.25rem;font-size:.6rem;font-weight:700;
    letter-spacing:.1em;border:1px solid #31313a;color:#9a9aa3;margin-right:.2rem}
  .tag.warn{border-color:#5a3a1a;color:#f0b46a}
  .tag.good{border-color:#1f4a33;color:#7ee2a8}
  .empty{color:#7d7d86;font-size:.86rem;line-height:1.6}
  a{color:#7ee2a8;text-decoration:none}
  .foot{margin-top:1.2rem;font-size:.8rem;color:#6f6f78}
</style></head><body><main>
<header><h1>Memory</h1><span class="flag">open by default</span></header>
<p class="lede">${String(total)} record${total === 1 ? '' : 's'} across ${String(groups.length)} project${groups.length === 1 ? '' : 's'}.
This is what a new session in that project will be told, before you type a word — read it, and prune anything wrong
by editing the files under <code>${esc(memoryDir())}</code>.</p>
${body}
<p class="foot"><a href="/admin">← Owner console</a> &nbsp;·&nbsp; <a href="/workers">Local agents</a></p>
</main></body></html>`
}

/**
 * Absolute path of the memory directory, for the page text.
 * @returns the directory path.
 */
export function memoryLocation(): string {
  return memoryDir()
}
