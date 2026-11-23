/**
 * Owner console: presence-only health of the hosted deployment. It never
 * prints secrets — only whether each one exists — plus the notes wall, a
 * session-log census and quick links to the other owner-facing pages.
 *
 * @module @deepseek-ai/dsh-hosted-signin/admin-page
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { recentNotes } from './feedback.ts'

/** Where the harness home points. */
function harnessHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** One row of the status table. */
interface Fact {
  /** Row label. */
  label: string
  /** Rendered value. */
  value: string
  /** How it should read: fine, caution, or unknown. */
  tone: 'ok' | 'warn' | 'info'
}

/** Census of session logs under the harness home. */
function sessionCensus(): { count: number; newest: string; megabytes: string } {
  let count = 0
  let newest = 0
  let bytes = 0
  const walk = (dir: string, depth: number): void => {
    if (depth > 4 || count > 5000) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = join(dir, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(full, depth + 1)
      } else if (name.endsWith('.jsonl')) {
        count += 1
        bytes += stat.size
        newest = Math.max(newest, stat.mtimeMs)
      }
    }
  }
  walk(harnessHome(), 0)
  return {
    count,
    newest: newest === 0 ? '—' : new Date(newest).toISOString().replace('T', ' ').slice(0, 19),
    megabytes: (bytes / (1024 * 1024)).toFixed(1),
  }
}

/** Compose the owner console. */
/** One line about the thing that decides whether the free preview can run at all. */
function fuelSection(fuel?: {
  available: boolean; usd: number; currency: string; low: number; at: number; error?: string
}): string {
  if (fuel === undefined) {
    return '<p class="empty">Balance unknown yet — it is read on the first console visit, then every ten minutes.</p>'
  }
  const age = Math.max(0, Math.round((Date.now() - fuel.at) / 60000))
  if (fuel.error !== undefined) {
    return `<p class="warn">Could not read the balance: <code>${fuel.error}</code>. Until it is readable the free`
      + ' preview may fail for visitors without explanation.</p>'
  }
  const money = `${fuel.usd.toFixed(2)} ${fuel.currency}`
  if (!fuel.available || fuel.usd <= 0) {
    return `<p class="warn"><b>EMPTY — the free preview cannot answer right now.</b> Top up the DeepSeek account;`
      + ' visitors are being told the preview is paused, not left to hit an error.</p>'
  }
  if (fuel.usd <= fuel.low) {
    return `<p class="warn"><b>Low: ${money}.</b> The door already warns visitors. Roughly `
      + `${Math.floor(fuel.usd / 0.002)} short conversations left at flash prices.</p>`
  }
  return `<p class="ok"><b>${money}</b> available — read ${age} min ago. The free preview is running.</p>`
}

export function adminPageHtml(spend?: {
  tracked: boolean
  spent: number
  cap: number
  userCap: number
  ratio: number
  month: string
  users: Array<{ userId: string; calls: number; cost: number; last: number }>
}, guests?: Array<{ guestKey: string; day: string; count: number }>,
  credits?: Array<{ userId: string; usd: number; entries: number; last: number }>,
  fuel?: { available: boolean; usd: number; currency: string; low: number; at: number; error?: string }): string {
  const home = harnessHome()
  const hosted = process.env.DSH_ALLOW_WILDCARD_HOST !== undefined
  const ownerKey = process.env.DEEPSEEK_API_KEY !== undefined && process.env.DEEPSEEK_API_KEY !== ''
  const notes = recentNotes(8)
  const sessions = sessionCensus()
  // The ledger section. Concatenated, not templated inside the page string:
  // a nested template literal here once broke this file's sibling.
  const spendSection = spend === undefined || !spend.tracked
    ? '<section><h2>Spend</h2><p class="empty">No database configured — the ledger needs DATABASE_URL.</p></section>'
    : [
      '<section><h2>Spend · ' + spend.month + '</h2>',
      '<p class="empty" style="margin:0 0 .6rem">$' + spend.spent.toFixed(2)
        + (spend.cap > 0 ? ' of $' + spend.cap.toFixed(2) + ' monthly cap' : ' — no monthly cap set')
        + ' · per-person cap ' + (spend.userCap > 0 ? '$' + spend.userCap.toFixed(2) : 'none') + '</p>',
      spend.cap > 0
        ? '<div style="height:.5rem;border-radius:.3rem;background:#22222a;overflow:hidden;margin:0 0 1rem">'
          + '<div style="height:100%;width:' + Math.round(spend.ratio * 100) + '%;background:'
          + (spend.ratio > 0.9 ? '#C4121A' : spend.ratio > 0.7 ? '#D9822B' : '#7ee2a8') + '"></div></div>'
        : '',
      spend.users.length === 0
        ? '<p class="empty">Nobody has spent anything this month yet.</p>'
        : '<table><thead><tr><th>who</th><th>calls</th><th>spent</th><th>last seen</th></tr></thead><tbody>'
          + spend.users.slice(0, 25).map(user => '<tr><td>' + user.userId + '</td><td>' + String(user.calls)
            + '</td><td>$' + user.cost.toFixed(3) + '</td><td>'
            + (user.last === 0 ? '—' : new Date(user.last).toISOString().slice(0, 16).replace('T', ' ')) + '</td></tr>').join('')
          + '</tbody></table>',
      '</section>',
    ].join('\n')

  // Guest sessions per visitor-derived key: the shape an abuse loop makes.
  const guestRows = guests === undefined || guests.length === 0
    ? '<p class="empty">No guest sessions recorded yet.</p>'
    : ['<table><thead><tr><th>visitor key</th><th>day</th><th>sessions</th></tr></thead><tbody>',
      ...guests.slice(0, 20).map(g => '<tr><td style="font-family:ui-monospace,monospace;font-size:.74rem">'
        + g.guestKey.slice(0, 16) + '…</td><td>' + g.day + '</td><td>'
        + (g.count >= 3 ? '<b style="color:#f0b46a">' + String(g.count) + '</b>' : String(g.count)) + '</td></tr>'),
      '</tbody></table>'].join('\n      ')
  // Credit: a tip becomes somebody's allowance, as a discretionary thank-you. Listed plainly, with a form
  // to add one by hand until a payment rail exists.
  const creditRows = credits === undefined || credits.length === 0
    ? '<p class="empty">Nobody has credit yet. $5 of top-up is roughly a month of light use.</p>'
    : ['<table><thead><tr><th>who</th><th>balance</th><th>grants</th><th>last</th></tr></thead><tbody>',
      ...credits.slice(0, 20).map(c => '<tr><td>' + c.userId + '</td><td>$'
        + c.usd.toFixed(2) + '</td><td>' + String(c.entries) + '</td><td>'
        + (c.last === 0 ? '—' : new Date(c.last).toISOString().slice(0, 16).replace('T', ' ')) + '</td></tr>'),
      '</tbody></table>'].join('\n      ')
  const creditSection = [
    '<section><h2>Fuel · the DeepSeek balance</h2>${fuelSection(fuel)}</section>
<section><h2>Credit · top-ups</h2>',
    '<form method="POST" action="/api/credits/grant" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin:0 0 .9rem">',
    '<input name="userId" placeholder="guest-… / user id" required style="flex:1;min-width:12rem;padding:.5rem .6rem;border-radius:.4rem;border:1px solid #3a3a44;background:#101014;color:#F2F2F4">',
    '<input name="usd" placeholder="5.00" required style="width:7rem;padding:.5rem .6rem;border-radius:.4rem;border:1px solid #3a3a44;background:#101014;color:#F2F2F4">',
    '<input name="note" placeholder="kofi ref" style="width:10rem;padding:.5rem .6rem;border-radius:.4rem;border:1px solid #3a3a44;background:#101014;color:#F2F2F4">',
    '<button type="submit" style="padding:.5rem .9rem;border-radius:.4rem;border:none;background:#C1440E;color:#fff;font-weight:700;cursor:pointer">Grant</button>',
    '</form>',
    creditRows,
    '<form method="POST" action="/api/guest/freeze" style="margin-top:1rem">',
    '<button type="submit" style="padding:.45rem .8rem;border-radius:.4rem;border:1px solid #31313a;background:#1f1f27;color:#f0b46a;font-weight:600;cursor:pointer">Pause new guest previews</button>',
    '</form>',
    '<p class="fine" style="margin:.6rem 0 0;color:#6f6f78;font-size:.72rem">Credit raises one person\'s ceiling on top of the shared allowance. A pause stops new guests without a deploy; existing keys are never affected.</p>',
    '</section>',
  ].join('\n')
  const vault = join(home, '.credentials.yaml')
  const facts: Fact[] = [
    { label: 'Hosted mode', value: hosted ? 'on — shell tools disabled for visitors' : 'off — local/trusted use', tone: hosted ? 'ok' : 'warn' },
    { label: 'Owner DeepSeek key', value: ownerKey ? 'configured (value hidden)' : 'absent — visitors must bring their own', tone: ownerKey ? 'ok' : 'info' },
    { label: 'Harness home', value: `${home}${existsSync(home) ? '' : ' (missing)'}`, tone: existsSync(home) ? 'ok' : 'warn' },
    { label: 'Credential vault', value: existsSync(vault) ? 'present (contents hidden)' : 'absent', tone: existsSync(vault) ? 'ok' : 'info' },
    { label: 'Session logs', value: `${sessions.count} files · ${sessions.megabytes} MB · newest ${sessions.newest}`, tone: 'info' },
    { label: 'Notes wall', value: `${notes.length === 0 ? 'empty' : 'has entries'} · export available`, tone: 'info' },
    { label: 'Node', value: `${process.version} · up ${Math.round(process.uptime() / 60)} min`, tone: 'info' },
  ]
  const rows = facts.map(f => `<tr><th>${f.label}</th><td class="t-${f.tone}">${f.value}</td></tr>`).join('')
  const noteList = notes.length === 0
    ? '<p class="empty">No notes yet.</p>'
    : notes.map(note => `<div class="note"><time>${note.at}</time><p>${escapeText(note.text)}</p>${note.email === undefined ? '' : `<div class="mail">${escapeText(note.email)}</div>`}</div>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — owner console</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.14),transparent 70%)}
  main{max-width:52rem;margin:0 auto}
  header{display:flex;align-items:center;gap:.65rem;margin-bottom:1.4rem}
  header svg{width:2rem;height:auto}
  .badge{width:1.6rem;height:1.6rem;flex:none}
  h1{display:flex;align-items:center;gap:.55rem;margin:0;font-size:1.15rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700}
  .flag{margin-left:auto;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#D9822B;font-weight:600}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin-bottom:1rem}
  h2{margin:0 0 .8rem;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:.86rem}
  th{text-align:left;font-weight:600;color:#9a9aa3;padding:.34rem 0;width:12rem;vertical-align:top}
  td{padding:.34rem 0;color:#d6d6de}
  .t-ok{color:#7ee2a8}.t-warn{color:#f0b46a}.t-info{color:#d6d6de}
  .links{display:flex;flex-wrap:wrap;gap:.5rem}
  .links a{display:inline-block;padding:.42rem .75rem;border-radius:.4rem;border:1px solid #31313a;
    background:#1f1f27;color:#e6e6ec;text-decoration:none;font-size:.82rem;font-weight:600}
  .links a:hover{border-color:#C1440E}
  .note{border:1px solid #26262d;border-radius:.55rem;padding:.6rem .7rem;margin:.45rem 0;background:#1b1b22}
  .note time{display:block;color:#6f6f78;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase}
  .note p{margin:.2rem 0 0;font-size:.86rem;color:#dcdce4;white-space:pre-wrap}
  .note .mail{color:#82828b;font-size:.72rem;margin-top:.25rem}
  .empty{color:#6f6f78;font-size:.85rem;margin:0}
</style></head><body><main>
<header>
  <svg viewBox="0 0 120 132" aria-hidden="true">
    <ellipse cx="60" cy="10" rx="21" ry="5.6" fill="none" stroke="#C9A227" stroke-width="3"/>
    <path d="M16 100L104 22M104 100L16 22" stroke="#C1440E" stroke-width="3.2" stroke-linecap="round" opacity=".6"/>
    <path d="M60 16c24 0 35 14 35 33 0 24-17 40-28 46 4 6 8 11 8 11s-9-4-15-4-15 4-15 4 4-5 8-11c-11-6-28-22-28-46 0-19 11-33 35-33z"
      fill="#151517" stroke="#C1440E" stroke-width="4.5"/>
  </svg>
  <h1><img class="badge" src="/massai-badge.svg" alt="" width="26" height="26">Owner console</h1><span class="flag">open by default</span>
</header>
<section><h2>Status</h2><table>${rows}</table></section>
${spendSection}
${creditSection}
<section><h2>Guest sessions per network</h2>${guestRows}
  <p class="fine" style="margin:.6rem 0 0;color:#6f6f78;font-size:.72rem">Three per day by default (<code>DSH_GUEST_SESSIONS_PER_DAY</code>). Highlighted rows are at the limit — that pattern is what a cookie-clearing loop looks like.</p></section>
<section><h2>Notes wall (newest ${notes.length})</h2>${noteList}
  <p style="margin:.8rem 0 0"><a href="/feedback/export.jsonl" style="color:#7ee2a8;text-decoration:none;font-size:.82rem;font-weight:600">Download all notes →</a></p>
</section>
<section><h2>Owner pages</h2><div class="links">
  <a href="/usage">Usage timeline</a><a href="/rates">Rates &amp; happy hour</a><a href="/models">Model guide</a><a href="/workers">Local agents</a><a href="/memory">Memory</a><a href="/import">Import a chat</a><a href="/limits">Limits (public)</a><a href="/me">Your id &amp; spend</a>
  <a href="/">Door</a><a href="/start">Guided start</a><a href="/feedback">Leave-note form</a>
  <a href="/feedback/recent">Notes (full)</a><a href="/logo-preview">Logo concepts</a>
  <a href="/login-preview">Sign-in card preview</a><a href="/healthz">Health</a>
</div></section>
</main></body></html>`
}

/**
 * Escape one user-supplied string for HTML text.
 * @param value - raw text.
 * @returns the escaped text.
 */
function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
