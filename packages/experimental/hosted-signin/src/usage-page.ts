/**
 * The two owner-facing analytics pages: `/usage` (measured per-request timeline
 * with a money estimate) and `/rates` (the price card, including DeepSeek's
 * off-peak "happy hour" window).
 *
 * @module @deepseek-ai/dsh-hosted-signin/usage-page
 */

import {
  byDay, byHour, byModel, bySession, compact, costOf, efficiencyVerdict, isOffPeak,
  OFF_PEAK_UTC, RATES, readUsage,
} from './usage.ts'

/** Shared page chrome. */
function chrome(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.13),transparent 70%)}
  main{max-width:56rem;margin:0 auto}
  header{display:flex;align-items:center;gap:.6rem;margin-bottom:1.3rem}
  header svg{width:1.9rem;height:auto}
  h1{margin:0;font-size:1.1rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700}
  .flag{margin-left:auto;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#D9822B;font-weight:600}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin-bottom:1rem}
  h2{margin:0 0 .8rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  .kpis{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))}
  .kpi{border:1px solid #26262d;border-radius:.6rem;padding:.7rem .8rem;background:#1b1b22}
  .kpi b{display:block;font-size:1.25rem;font-weight:700;letter-spacing:-.01em}
  .kpi span{display:block;margin-top:.15rem;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:#82828b;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  th{text-align:left;color:#82828b;font-weight:600;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;padding:.35rem .4rem;border-bottom:1px solid #26262d}
  td{padding:.38rem .4rem;border-bottom:1px solid #1f1f26;color:#d6d6de;font-variant-numeric:tabular-nums}
  tr:last-child td{border-bottom:none}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem}
  .muted{color:#7d7d86}
  .good{color:#7ee2a8}
  .warn{color:#f0b46a}
  a{color:#7ee2a8;text-decoration:none}
  .links{display:flex;flex-wrap:wrap;gap:.5rem}
  .links a{display:inline-block;padding:.4rem .7rem;border-radius:.4rem;border:1px solid #31313a;background:#1f1f27;color:#e6e6ec;font-size:.8rem;font-weight:600}
  .note{margin:.7rem 0 0;font-size:.76rem;color:#6f6f78;line-height:1.6}
</style></head><body><main>
<header>
  <svg viewBox="0 0 120 132" aria-hidden="true">
    <ellipse cx="60" cy="10" rx="21" ry="5.6" fill="none" stroke="#C9A227" stroke-width="3"/>
    <path d="M16 100L104 22M104 100L16 22" stroke="#C1440E" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>
    <path d="M60 16c24 0 35 14 35 33 0 24-17 40-28 46 4 6 8 11 8 11s-9-4-15-4-15 4-15 4 4-5 8-11c-11-6-28-22-28-46 0-19 11-33 35-33z"
      fill="#151517" stroke="#C1440E" stroke-width="4.5"/>
  </svg>
  <h1>${title}</h1><span class="flag">open by default</span>
</header>
${body}
</main></body></html>`
}

/**
 * Render the measured usage timeline.
 * @returns the page HTML.
 */
export function usagePageHtml(): string {
  const points = readUsage()
  const days = byDay(points, 14)
  const hours = byHour(points, 48)
  const sessions = bySession(points)
  const totals = points.reduce((acc, p) => ({
    input: acc.input + p.input, output: acc.output + p.output,
    cacheRead: acc.cacheRead + p.cacheRead, requests: acc.requests + 1,
    cost: acc.cost + costOf(p),
  }), { input: 0, output: 0, cacheRead: 0, requests: 0, cost: 0 })
  const maxDay = Math.max(1, ...days.map(d => d.input + d.output))
  const maxHour = Math.max(1, ...hours.map(h => h.tokens))
  const dayBars = days.map((d, i) => {
    const total = d.input + d.output
    const inputH = Math.round((d.input / maxDay) * 90)
    const outputH = Math.round((d.output / maxDay) * 90)
    return `<g>
      <rect x="${i * 34 + 4}" y="${100 - inputH - outputH}" width="22" height="${outputH}" fill="#4D6BFE" rx="2"/>
      <rect x="${i * 34 + 4}" y="${100 - inputH}" width="22" height="${inputH}" fill="#C1440E" rx="2"/>
      <title>${d.day}: ${compact(total)} tokens · $${d.cost.toFixed(3)}</title>
    </g>`
  }).join('')
  const hourBars = hours.map((h, i) => {
    const height = Math.round((h.tokens / maxHour) * 40)
    return `<rect x="${i * 10 + 1}" y="${42 - height}" width="7" height="${Math.max(height, 1)}" fill="${h.tokens === 0 ? '#26262d' : '#7ee2a8'}" rx="1"><title>${h.tokens} tokens</title></rect>`
  }).join('')
  const models = byModel(points)
  const heaviest = Math.max(1, ...models.map(m => m.promptPerCall))
  const totalCalls = Math.max(1, models.reduce((sum, m) => sum + m.calls, 0))
  const modelRows = models.length === 0
    ? '<tr><td colspan="7" class="muted">No model activity recorded yet.</td></tr>'
    : models.map((m) => {
      const verdict = efficiencyVerdict(m, heaviest)
      const share = Math.round((m.calls / totalCalls) * 100)
      return `<tr>
        <td class="mono">${m.model}</td>
        <td>${m.calls}</td>
        <td>${share}%</td>
        <td>${compact(m.promptPerCall)}</td>
        <td>${compact(m.input + m.cacheRead + m.output)}</td>
        <td>$${m.cost.toFixed(3)}</td>
        <td class="${verdict.tone === 'warn' ? 'warn' : verdict.tone === 'ok' ? 'good' : 'muted'}">${verdict.label}</td>
      </tr>`
    }).join('')
  const rows = sessions.slice(0, 12).map(s => `<tr>
    <td class="mono">${s.session.slice(0, 18)}…</td>
    <td>${s.requests}</td>
    <td>${compact(s.input)}</td>
    <td>${compact(s.cacheRead)}</td>
    <td>${compact(s.output)}</td>
    <td>${new Date(s.last).toISOString().replace('T', ' ').slice(0, 16)}</td>
  </tr>`).join('')
  return chrome('Usage', `
<section><h2>Measured totals</h2><div class="kpis">
  <div class="kpi"><b>${totals.requests}</b><span>model calls</span></div>
  <div class="kpi"><b>${compact(totals.input + totals.cacheRead)}</b><span>prompt tokens</span></div>
  <div class="kpi"><b>${compact(totals.output)}</b><span>completion tokens</span></div>
  <div class="kpi"><b>${compact(totals.cacheRead)}</b><span>from cache</span></div>
  <div class="kpi"><b>${compact(totals.requests === 0 ? 0 : (totals.input + totals.cacheRead) / totals.requests)}</b><span>avg context / call</span></div>
  <div class="kpi"><b>$${totals.cost.toFixed(2)}</b><span>est. spend</span></div>
  <div class="kpi"><b>${sessions.length}</b><span>sessions</span></div>
</div></section>
<section><h2>Last 14 days <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:500">— ochre = prompt, blue = completion</span></h2>
  <svg viewBox="0 0 480 120" style="width:100%;height:auto" role="img" aria-label="daily token usage">
    <line x1="0" y1="100" x2="480" y2="100" stroke="#2a2a31" stroke-width="1"/>
    ${dayBars}
  </svg>
  <p class="note">${days[0]?.day ?? ''} → ${days[days.length - 1]?.day ?? ''} · peak day ${compact(maxDay)} tokens</p>
</section>
<section><h2>Last 48 hours</h2>
  <svg viewBox="0 0 480 44" style="width:100%;height:auto" role="img" aria-label="hourly token usage">
    <line x1="0" y1="42" x2="480" y2="42" stroke="#2a2a31" stroke-width="1"/>
    ${hourBars}
  </svg>
  <p class="note">Green = activity. Right edge is now. Off-peak (half price) runs
  ${String(OFF_PEAK_UTC[0]).padStart(2, '0')}:30–${String(OFF_PEAK_UTC[1]).padStart(2, '0')}:30 UTC.</p>
</section>
<section><h2>By model <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:500">— what each model actually did</span></h2>
  <table><thead><tr><th>model</th><th>calls</th><th>share</th><th>prompt/call</th><th>tokens</th><th>est. spend</th><th>read</th></tr></thead>
  <tbody>${modelRows}</tbody></table>
  <p class="note">"Possibly overkill" means the model was handed small prompts a lighter model already
  handles here — a hint to switch down, not a verdict. "Carrying the big jobs" is the opposite:
  the heavy model is earning its price.</p>
</section>
<section><h2>Per session</h2>
  <table><thead><tr><th>session</th><th>calls</th><th>prompt</th><th>cache</th><th>completion</th><th>last activity</th></tr></thead>
  <tbody>${rows === '' ? '<tr><td colspan="6" class="muted">No usage recorded yet.</td></tr>' : rows}</tbody></table>
  <p class="note">Token counts are read from the session logs. Money is an estimate from published
  DeepSeek rates — <a href="/rates">see the rate card</a>.</p>
</section>
<section><h2>More</h2><div class="links">
  <a href="/rates">Rates &amp; happy hour</a><a href="/admin">Owner console</a><a href="/">Door</a>
</div></section>`)
}

/**
 * Render the rate card, including the off-peak window and a live price signal.
 * @returns the page HTML.
 */
export function ratesPageHtml(): string {
  const now = Date.now()
  const offPeak = isOffPeak(now)
  const rows = RATES.map(rate => `<tr>
    <td class="mono">${rate.label}<br><span class="muted" style="font-size:.68rem">${rate.models.join(' · ')}</span></td>
    <td>$${rate.inputMiss.toFixed(2)}</td>
    <td>$${rate.inputHit.toFixed(2)}</td>
    <td>$${rate.output.toFixed(2)}</td>
    <td class="${rate.offPeakMultiplier <= 0.5 ? 'good' : 'warn'}">${Math.round((1 - rate.offPeakMultiplier) * 100)}% off</td>
  </tr>`).join('')
  return chrome('Rates', `
<section><h2>Right now <span class="${offPeak ? 'good' : 'warn'}" style="letter-spacing:0;text-transform:none">${offPeak ? 'off-peak — discounted' : 'peak — full price'}</span></h2>
  <div class="kpis">
    <div class="kpi"><b class="${offPeak ? 'good' : 'warn'}">${offPeak ? 'HAPPY HOUR' : 'PRIME TIME'}</b><span>${new Date(now).toISOString().slice(11, 16)} UTC</span></div>
    <div class="kpi"><b>${String(OFF_PEAK_UTC[0]).padStart(2, '0')}:30–${String(OFF_PEAK_UTC[1]).padStart(2, '0')}:30</b><span>discount window (UTC)</span></div>
    <div class="kpi"><b id="local-window">—</b><span>in your local time</span></div>
  </div>
  <script>
  (() => {
    // The discount window is fixed in UTC; show it in the reader's clock so the
    // answer to "when should I build?" is a time they recognise.
    const start = ${JSON.stringify(OFF_PEAK_UTC[0])}, end = ${JSON.stringify(OFF_PEAK_UTC[1])}
    const pad = (n) => String(n).padStart(2, '0')
    const fmt = (hours) => {
      const base = new Date(Date.UTC(2000, 0, 1))
      base.setUTCHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0)
      return new Date(base.getTime()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    const target = document.getElementById('local-window')
    if (target) target.textContent = fmt(start) + '–' + fmt(end)
  })()
  </script>
  <p class="note">DeepSeek discounts off-peak usage — half price on the chat model, and deeper on
  the reasoner. Build big things overnight and pay less; the timeline shows when the work happened.</p>
</section>
<section><h2>Published rates <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:500">USD per million tokens</span></h2>
  <table><thead><tr><th>model</th><th>prompt (miss)</th><th>prompt (cache hit)</th><th>completion</th><th>off-peak</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="note">Figures mirror DeepSeek's published table and are kept in one constant
  (<code>RATES</code> in the server) so a change is a one-line edit. Always confirm at
  <a href="https://platform.deepseek.com/api_docs/pricing" target="_blank" rel="noopener">platform.deepseek.com</a>
  before making decisions on them.</p>
</section>
<section><h2>What it costs in practice</h2>
  <p class="note" style="font-size:.82rem;color:#b9b9c2">A typical build session here runs
  tens of thousands of prompt tokens (most served from cache) and a few thousand completion
  tokens — cents, not dollars. A $5 top-up covers weeks of evening building, and the
  off-peak window halves it again.</p>
</section>
<section><h2>More</h2><div class="links">
  <a href="/usage">Usage timeline</a><a href="/admin">Owner console</a>
  <a href="https://platform.deepseek.com/top_up" target="_blank" rel="noopener">Top up</a>
</div></section>`)
}

/** One model's framing on the guidance page. */
const MODEL_GUIDE = [
  {
    id: 'deepseek-flash',
    title: 'deepseek-flash',
    subtitle: 'the closer',
    tone: 'good',
    good: ['Single-file edits', 'Copy and layout changes', 'Quick questions', 'Iterating on something that already works', 'Shipping — it finishes what it starts'],
    avoid: ['Architecture across many files', 'Hard debugging with long logs', 'Specs that need planning before any code'],
  },
  {
    id: 'deepseek-v4-pro',
    title: 'deepseek-v4-pro',
    subtitle: 'the strategist',
    tone: 'warn',
    good: ['Multi-file refactors', 'Design decisions and trade-offs', 'Gnarly bugs and long stack traces', 'Anything you would otherwise re-explain three times'],
    avoid: ['One-line tweaks', 'Repeating a step that already worked', 'Exploration where flash is enough'],
  },
] as const

/**
 * Render the model guidance page: what each model is for, and what this
 * deployment's own measurements say about how they are actually being used.
 * @returns the page HTML.
 */
export function modelsPageHtml(): string {
  const points = readUsage()
  const models = byModel(points)
  const heaviest = Math.max(1, ...models.map(m => m.promptPerCall))
  const measured = models.length === 0
    ? '<p class="note">No calls measured yet — once you build, this page reports which model is doing what.</p>'
    : `<table><thead><tr><th>model</th><th>calls</th><th>prompt/call</th><th>est. spend</th><th>what it means</th></tr></thead><tbody>${
      models.map((m) => {
        const verdict = efficiencyVerdict(m, heaviest)
        return `<tr><td class="mono">${m.model}</td><td>${m.calls}</td><td>${compact(m.promptPerCall)}</td>
          <td>$${m.cost.toFixed(3)}</td>
          <td class="${verdict.tone === 'warn' ? 'warn' : verdict.tone === 'ok' ? 'good' : 'muted'}">${verdict.label}</td></tr>`
      }).join('')
    }</tbody></table>`
  const cards = MODEL_GUIDE.map(card => `<div class="modelcard">
    <h3 class="${card.tone === 'good' ? 'good' : 'warn'}">${card.title} <span class="muted" style="font-weight:500;letter-spacing:0;text-transform:none">— ${card.subtitle}</span></h3>
    <p class="muted" style="margin:.3rem 0 .5rem;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;font-weight:600">Good at</p>
    <ul>${card.good.map(item => `<li>${item}</li>`).join('')}</ul>
    <p class="muted" style="margin:.7rem 0 .5rem;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;font-weight:600">Skip it for</p>
    <ul class="avoid">${card.avoid.map(item => `<li>${item}</li>`).join('')}</ul>
  </div>`).join('')
  return chrome('Models', `
<section><h2>The short version</h2>
  <p class="note" style="font-size:.9rem;color:#c9c9d2;margin:0">
  <b>Start on flash.</b> Not because it is the lesser model — because it is the one that closes.
  Most building is one clear change at a time, and flash does that at a fraction of the price, so you
  notice the bill far less than you notice the work getting done. Reach for <b>v4-pro</b> when the task
  spans many files, when a bug keeps winning, or when the plan matters more than the typing — then drop
  back down. The expensive model is for the hard sentence, not the whole conversation.</p>
</section>
<section><h2>What each one is for</h2><div style="display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))">
  ${cards}
</div></section>
<section><h2>What your own usage says</h2>${measured}
  <p class="note">This is measured from your session logs, priced at published rates.
  <a href="/usage">See the full timeline →</a></p>
</section>
<section><h2>More</h2><div class="links">
  <a href="/usage">Usage timeline</a><a href="/rates">Rates &amp; happy hour</a><a href="/admin">Owner console</a>
</div></section>
<style>
  .modelcard{border:1px solid #26262d;border-radius:.7rem;padding:.85rem .95rem;background:#1b1b22}
  .modelcard h3{margin:0;font-size:.95rem}
  .modelcard ul{margin:0;padding-left:1.1rem;color:#c2c2cb;font-size:.82rem;line-height:1.55}
  .modelcard ul.avoid{color:#8f8f97}
</style>`)
}
