/**
 * Public guide for running models locally: hardware table, realistic scenarios,
 * and a calculator that shows what a person's own usage actually costs in the
 * cloud versus running it themselves.
 *
 * @module @deepseek-ai/dsh-hosted-signin/local-guide
 */

/** Hardware rows: size, disk, RAM, and what it is honestly good for. */
const HARDWARE: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['3B', '~2 GB', '6 GB', 'any laptop from the last 8 years', 'chat, small edits, explanations'],
  ['7B', '~4.7 GB', '10 GB', '16 GB laptop, mini PC, Apple silicon', 'the sweet spot: real coding, multi-file edits'],
  ['14B', '~9 GB', '18 GB', '32 GB machine or 12 GB+ GPU', 'harder tasks, longer context'],
  ['32B', '~20 GB', '36 GB', '64 GB or 24 GB GPU', 'near-frontier on routine code'],
]

/** Scenarios with honest ranges. */
const SCENARIOS: ReadonlyArray<{ title: string; body: string; verdict: string }> = [
  {
    title: 'Questions all day',
    body: '200 short turns/day. Cloud on the cheap tier: roughly $6–18/month. Local: $0, at 5–20 seconds per reply.',
    verdict: 'Worth it for privacy and offline, not for the money.',
  },
  {
    title: 'A weekend build',
    body: '400–800 agent steps. Careless flagship use: $10–40/weekend. Cheap tier: $1–4. Local: $0 but 2–4× slower wall-clock.',
    verdict: 'Big win is turning a flagship habit local, not replacing cheap cloud.',
  },
  {
    title: 'Several machines, one project',
    body: '3,000+ steps/day across machines.Cloud equivalent: $60–150+/month. Local marginal cost: $0.',
    verdict: 'This is where local genuinely wins on cost — and where a hub that sees every machine matters.',
  },
  {
    title: 'Offline',
    body: 'No cloud option exists.',
    verdict: 'Local is the only answer.',
  },
]

/** Hardware ladder from a spare phone to a server room. */
const LADDER: ReadonlyArray<readonly [string, string, string, string]> = [
  ['Old phone (8 GB)', '1B–3B at 4-bit', 'runs, slowly', 'short questions, drafting, offline notes'],
  ['Laptop, 16 GB RAM', '7B–8B at 4-bit', 'usable', 'real coding help, single files, explanations'],
  ['24 GB GPU or 32 GB Mac', '14B–30B at 4-bit', 'good', 'the practical ceiling for personal use: multi-file work'],
  ['Workstation, 64–128 GB', 'up to 70B at 4-bit', 'capable', 'near-cloud quality on routine code, needs a fan you can hear'],
  ['Server (multi-GPU)', '100B+ or a rented flagship', 'frontier-class', 'what the cloud is doing when you press send'],
]

/** The usage-advice habits that matter more than the model. */
const HABITS: readonly string[] = [
  'Small steps: "add a contact form to index.html" beats "build me a site".',
  'Point at files: "fix the error in app.js line 40" beats "it is broken".',
  'Paste errors verbatim — small models fix text far better than symptoms.',
  'One job per message; multi-part asks get half-done.',
  'Let it escalate: keep the cloud model behind the gateway for the hard step.',
  'Keep context short; small models degrade with huge histories.',
]

/** Troubleshooting rows. */
const TROUBLE: ReadonlyArray<readonly [string, string]> = [
  ['"not enough memory — nothing was changed"', 'The guard refused: the model would not fit. Use --small, free RAM, or another machine.'],
  ['Very slow replies', 'CPU-only inference. A 3B model, or a machine with a GPU / Apple silicon, fixes it.'],
  ['Gateway up, no answer', 'The model may still be loading on first use. Wait ~30 s and retry.'],
  ['Agent crashed while installing', 'Model and agent in the same RAM. Run the model on a different machine.'],
  ['Forgets earlier context', 'Small context window (4k–32k). Keep sessions short and let Massai compact.'],
]

/**
 * Render the local-models guide.
 * @returns the page HTML.
 */
export function localGuidePageHtml(): string {
  const hardware = HARDWARE.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
  const ladder = LADDER.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
  const scenarios = SCENARIOS.map(s => `<div class="scenario">
    <h3>${s.title}</h3><p>${s.body}</p><p class="verdict">${s.verdict}</p>
  </div>`).join('')
  const habits = HABITS.map(h => `<li>${h}</li>`).join('')
  const trouble = TROUBLE.map(([what, fix]) => `<tr><td>${what}</td><td>${fix}</td></tr>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — local models</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2.2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(77,107,254,.12),transparent 70%)}
  main{max-width:52rem;margin:0 auto}
  h1{margin:0 0 .4rem;font-size:1.35rem;font-weight:700}
  .lede{margin:0 0 1.6rem;color:#a9a9b3;font-size:.95rem;line-height:1.65}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin:1rem 0}
  h2{margin:0 0 .8rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:.84rem}
  th{text-align:left;color:#82828b;font-weight:600;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;padding:.35rem .4rem;border-bottom:1px solid #26262d}
  td{padding:.42rem .4rem;border-bottom:1px solid #1f1f26;color:#c2c2cb;vertical-align:top}
  td:first-child{color:#F2F2F4;font-weight:700}
  .scenario{border:1px solid #26262d;border-radius:.6rem;padding:.8rem .9rem;margin-bottom:.55rem;background:#1b1b22}
  .scenario h3{margin:0 0 .3rem;font-size:.95rem}
  .scenario p{margin:0;color:#b9b9c2;font-size:.86rem;line-height:1.6}
  .scenario .verdict{margin-top:.4rem;color:#D9822B;font-weight:600}
  ul{margin:.2rem 0 0;padding-left:1.1rem;color:#c2c2cb;font-size:.88rem;line-height:1.7}
  code{background:#1f1f27;padding:.12rem .35rem;border-radius:.3rem;font-size:.82rem}
  a{color:#7ee2a8;text-decoration:none}
  .calc{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.6rem}
  .calc label{display:block;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#82828b;font-weight:600;margin-bottom:.25rem}
  .calc input,.calc select{width:100%;padding:.5rem .6rem;border-radius:.45rem;border:1px solid #3a3a44;background:#101014;color:#F2F2F4;font:inherit;font-size:.9rem}
  .out{margin-top:.9rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.6rem}
  .kpi{border:1px solid #26262d;border-radius:.6rem;padding:.7rem .8rem;background:#1b1b22}
  .kpi b{display:block;font-size:1.2rem}
  .kpi span{display:block;margin-top:.15rem;font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;color:#82828b;font-weight:600}
  .good{color:#7ee2a8}.warn{color:#f0b46a}
  .note{margin:.7rem 0 0;font-size:.78rem;color:#6f6f78;line-height:1.65}
  .foot{margin-top:1.6rem;font-size:.8rem;color:#6f6f78}
</style></head><body><main>
<h1>Running an agent on your own machine</h1>
<p class="lede">A local model is free per message, works offline, and keeps your prompts private.
It is also slower and less capable than a frontier model. This page is about getting real
effect out of one — and knowing when it actually saves money.</p>

<section><h2>Hardware, honestly</h2>
  <table><thead><tr><th>size</th><th>disk</th><th>RAM needed</th><th>machine</th><th>good for</th></tr></thead>
  <tbody>${hardware}</tbody></table>
  <p class="note"><b>Rule of thumb:</b> model size in RAM, plus ~2 GB for the system, plus room
  for the agent. Apple silicon is the best value per watt; a CPU-only 7B works but feels slow in
  long agent loops. Do not stack a model on the machine already running the agent.</p>
</section>

<section><h2>The ladder: a spare phone to a server room</h2>
  <table><thead><tr><th>you have</th><th>you can run</th><th>how it feels</th><th>honest use</th></tr></thead>
  <tbody>${ladder}</tbody></table>
  <p class="note"><b>The 30B ceiling is real.</b> A 30B model at 4-bit needs about 18 GB, which fits a
  single 24 GB GPU or a 32 GB Mac — and that is where personal hardware tops out before the cost and
  noise stop making sense. Above that you are comparing a workstation to a datacentre, and renting
  wins for almost everyone.</p>
</section>

<section><h2>What it saves, by scenario</h2>${scenarios}</section>

<section><h2>Your own numbers</h2>
  <div class="calc">
    <div><label for="msgs">Messages / day</label><input id="msgs" type="number" value="200" min="1" step="10"></div>
    <div><label for="inp">New tokens / msg</label><input id="inp" type="number" value="1500" min="100" step="100"></div>
    <div><label for="cache">Cached tokens / msg</label><input id="cache" type="number" value="10000" min="0" step="1000"></div>
    <div><label for="out">Output tokens / msg</label><input id="out" type="number" value="500" min="50" step="50"></div>
    <div><label for="tier">Cloud tier</label><select id="tier">
      <option value="cheap">cheap (flash)</option>
      <option value="flagship">flagship (pro)</option>
    </select></div>
    <div><label for="hw">Local hardware cost</label><input id="hw" type="number" value="400" min="0" step="50"></div>
  </div>
  <div class="out">
    <div class="kpi"><b id="oCloud">—</b><span>cloud / month</span></div>
    <div class="kpi"><b class="good" id="oLocal">$0</b><span>local / month (power ≈ $1–2)</span></div>
    <div class="kpi"><b id="oBreak">—</b><span>hardware pays back in</span></div>
    <div class="kpi"><b id="oYear">—</b><span>first-year difference</span></div>
  </div>
  <p class="note">Estimates use DeepSeek's published rates and the off-peak discount half the time.
  Cache hits are priced lower than new input. Real usage varies — treat these as the shape of the
  answer, not a quote.</p>
</section>

<section><h2>Getting effect out of a small model</h2><ul>${habits}</ul></section>

<section><h2>When to use which</h2>
  <table><thead><tr><th>task</th><th>local 7B</th><th>cloud cheap</th><th>cloud flagship</th></tr></thead><tbody>
    <tr><td>Explain a file, rename things</td><td class="good">yes</td><td class="good">yes</td><td>overkill</td></tr>
    <tr><td>Small single-file edits</td><td class="good">yes</td><td class="good">yes</td><td>overkill</td></tr>
    <tr><td>Multi-file refactor</td><td class="warn">may drift</td><td class="good">yes</td><td class="good">yes</td></tr>
    <tr><td>Hard debugging, long logs</td><td>no</td><td class="warn">maybe</td><td class="good">yes</td></tr>
    <tr><td>Design decisions</td><td class="warn">maybe</td><td class="good">yes</td><td class="good">yes</td></tr>
    <tr><td>Offline / private data</td><td class="good">only option</td><td>no</td><td>no</td></tr>
  </tbody></table>
</section>

<section><h2>Troubleshooting</h2><table><tbody>${trouble}</tbody></table>
  <p class="note">Install with <code>./tools/massai-local.sh</code>. It checks memory first,
  explains what it will do, and only reports success after a real test prompt.</p>
</section>

<p class="foot"><a href="/guide">← The getting-started guide</a> &nbsp;·&nbsp; <a href="/">The door</a></p>
<script>
(() => {
  const ids = ['msgs','inp','cache','out','tier','hw']
  const el = (id) => document.getElementById(id)
  const rates = {
    cheap:    { miss: 0.27, hit: 0.07, out: 1.10 },
    flagship: { miss: 0.55, hit: 0.14, out: 2.19 },
  }
  const money = (v) => '$' + (v >= 100 ? v.toFixed(0) : v.toFixed(2))
  const render = () => {
    const msgs = Math.max(1, Number(el('msgs').value) || 1)
    const inp = Math.max(0, Number(el('inp').value) || 0)
    const cache = Math.max(0, Number(el('cache').value) || 0)
    const out = Math.max(0, Number(el('out').value) || 0)
    const tier = el('tier').value === 'flagship' ? 'flagship' : 'cheap'
    const hw = Math.max(0, Number(el('hw').value) || 0)
    const r = rates[tier]
    // Half the work is assumed to run in the off-peak window.
    const perMsg = ((inp * r.miss) + (cache * r.hit) + (out * r.out)) / 1e6
    const monthly = perMsg * msgs * 30 * 0.75
    const localPower = 1.5
    const savings = monthly - localPower
    el('oCloud').textContent = money(monthly)
    el('oBreak').textContent = savings > 0 ? (hw / savings).toFixed(0) + ' mo' : 'never'
    el('oYear').textContent = savings > 0 ? money(savings * 12 - hw) : money(-hw)
  }
  for (const id of ids) { el(id).addEventListener('input', render); el(id).addEventListener('change', render) }
  render()
})()
</script>
</main></body></html>`
}
