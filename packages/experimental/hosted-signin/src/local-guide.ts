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


/** One platform's setup path: download, install, pull, verify. */
interface Platform {
  /** Tab label. */
  label: string
  /** What to click first. */
  download: { text: string; url: string }
  /** Shell commands in order, each copyable. */
  commands: readonly string[]
  /** Extra prose for this platform. */
  note: string
}

/** The clickable paths, one per kind of machine a person might own. */
const PLATFORMS: readonly Platform[] = [
  {
    label: 'macOS',
    download: { text: 'Download Ollama for macOS', url: 'https://ollama.com/download/mac' },
    commands: [
      'ollama pull qwen2.5-coder:7b',
      'curl -sS -X POST http://127.0.0.1:11434/api/generate -H "content-type: application/json" -d \'{"model":"qwen2.5-coder:7b","prompt":"Say ready","stream":false}\'',
    ],
    note: 'Apple silicon (M1 or newer) runs the 7B well. On an Intel Mac use the 3B instead.',
  },
  {
    label: 'Windows',
    download: { text: 'Download Ollama for Windows', url: 'https://ollama.com/download/windows' },
    commands: [
      'ollama pull qwen2.5-coder:7b',
      'curl.exe -sS -X POST http://127.0.0.1:11434/api/generate -H "content-type: application/json" -d "{\\"model\\":\\"qwen2.5-coder:7b\\",\\"prompt\\":\\"Say ready\\",\\"stream\\":false}"',
    ],
    note: 'Install it, then open PowerShell. The model runs in the tray; close it to free memory.',
  },
  {
    label: 'Linux',
    download: { text: 'Install Ollama on Linux', url: 'https://ollama.com/download/linux' },
    commands: [
      'curl -fsSL https://ollama.com/install.sh | sh',
      'ollama pull qwen2.5-coder:7b',
      'curl -sS -X POST http://127.0.0.1:11434/api/generate -H "content-type: application/json" -d \'{"model":"qwen2.5-coder:7b","prompt":"Say ready","stream":false}\'',
    ],
    note: 'Needs about 5 GB of disk for the 7B. Services start automatically on most distributions.',
  },
  {
    label: 'Android phone',
    download: { text: 'Get Termux (F-Droid)', url: 'https://f-droid.org/en/packages/com.termux/' },
    commands: [
      'pkg install ollama',
      'ollama pull qwen2.5-coder:1.5b',
      'ollama run qwen2.5-coder:1.5b "Say ready"',
    ],
    note: 'Phones run the 1.5B or 3B model, slowly and hot. Use a 12 GB phone with the 3B if you can; keep it plugged in.',
  },
]


/** Which model to grab, with measured coverage and an honest recommendation. */
const PICKS: ReadonlyArray<{ model: string; file: string; ram: string; fits: string; line: string; tag: string }> = [
  { model: 'qwen2.5-coder:1.5b', file: '~1.1 GB', ram: '6 GB', fits: '~76% of calls by size',
    line: 'phones and very old laptops; questions and tiny edits', tag: '' },
  { model: 'qwen2.5-coder:3b', file: '~2.0 GB', ram: '8 GB', fits: '~90% of calls by size',
    line: 'the smallest that fits nine in ten calls — but misses more often on real edits', tag: '' },
  { model: 'qwen2.5-coder:7b', file: '~4.7 GB', ram: '16 GB', fits: '~97% of calls by size',
    line: 'the best success per dollar for coding; this is the one to start with', tag: 'recommended' },
  { model: 'qwen2.5-coder:14b', file: '~9 GB', ram: '32 GB', fits: '~99% of calls by size',
    line: 'when 7B keeps drifting on multi-file work and you have the RAM', tag: '' },
  { model: 'qwen2.5-coder:32b', file: '~20 GB', ram: '64 GB', fits: '~99% of calls by size',
    line: 'the personal-hardware ceiling; near-cloud on routine code', tag: 'ceiling' },
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
  const picks = PICKS.map(pick => `<tr>
    <td class="mono">${pick.model}${pick.tag === '' ? '' : ` <span class="tag ${pick.tag === 'recommended' ? 'rec' : ''}">${pick.tag}</span>`}</td>
    <td>${pick.file}</td><td>${pick.ram}</td><td>${pick.fits}</td><td>${pick.line}</td>
  </tr>`).join('')
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
  .tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem}
  .tab{padding:.45rem .8rem;border-radius:.45rem;border:1px solid #31313a;background:#1f1f27;color:#c2c2cb;
    font-size:.82rem;font-weight:600;cursor:pointer}
  .tab.on{border-color:#C1440E;color:#F2F2F4;background:#241a15}
  .pane{display:none}.pane.on{display:block}
  .dl{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:.2rem 0 .8rem}
  .btn{display:inline-block;padding:.55rem .9rem;border-radius:.5rem;background:#C1440E;color:#fff;
    font-weight:700;font-size:.88rem;text-decoration:none}
  .btn:hover{background:#d4531a}
  .muted{color:#7d7d86;font-size:.76rem}
  .cmds{margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:.45rem}
  .cmds li{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .cmds code{background:#0b0b0e;border:1px solid #26262d;padding:.4rem .55rem;border-radius:.4rem;
    font-size:.78rem;color:#d8d8e0;overflow-wrap:anywhere}
  .copy{padding:.3rem .55rem;border-radius:.35rem;border:1px solid #31313a;background:#1f1f27;color:#9a9aa3;
    font-size:.7rem;font-weight:600;cursor:pointer}
  .copy:hover{border-color:#C1440E;color:#F2F2F4}
  .tag{display:inline-block;margin-left:.3rem;padding:.1rem .4rem;border-radius:.3rem;font-size:.62rem;
    letter-spacing:.1em;text-transform:uppercase;font-weight:700;border:1px solid #31313a;color:#9a9aa3}
  .tag.rec{border-color:#C1440E;color:#D9822B;background:#241a15}
  td.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem}
  .suggest{margin-top:1rem;border:1px solid #2f2a22;border-radius:.7rem;background:#1b1710;padding:.9rem 1rem}
  .suggesthead{margin:0;color:#a9a9b3;font-size:.84rem}
  .suggestpick{margin:.25rem 0 0;font-size:1.15rem;font-weight:700;color:#D9822B}
  .suggestmeta{margin:.2rem 0 0;color:#9a9aa3;font-size:.82rem}
  .suggestcmd{margin:.6rem 0 0}
  .suggestcmd code{background:#0b0b0e;border:1px solid #31313a;padding:.4rem .6rem;border-radius:.4rem;font-size:.82rem;color:#d8d8e0}
  .suggestwarn{margin:.5rem 0 0;color:#f0b46a;font-size:.8rem}
  .suggestalt{margin:.45rem 0 0;color:#8a8a93;font-size:.8rem}
  .help{margin:.35rem 0 0;font-size:.72rem;color:#6f6f78;line-height:1.55}
  .suggeststeps{margin:.7rem 0 0;padding-left:1.1rem;font-size:.82rem;color:#c2c2cb;line-height:1.7}
  .suggeststeps code{background:#0b0b0e;border:1px solid #31313a;padding:.18rem .4rem;border-radius:.35rem;font-size:.78rem}
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



<section><h2>Build your own suggestion</h2>
  <p class="note" style="margin-top:0">There is no single right answer. Answer four questions about <em>your</em>
  computer and this box picks the model for you. Every choice is explained in plain words — you should not
  need to know anything before you click.</p>

  <div class="calc">
    <div>
      <label for="bDevice">1. What kind of computer is it?</label>
      <select id="bDevice">
        <option value="phone">A phone or tablet</option>
        <option value="laptop" selected>A laptop</option>
        <option value="desktop">A desktop computer</option>
        <option value="server">A server or always-on machine</option>
      </select>
      <p class="help q" data-for="bDevice">Not sure? Laptops have a battery and fold; desktops do not.
        A server is a machine left running all day that other devices use.</p>
    </div>
    <div>
      <label for="bRam">2. How much memory (RAM) does it have?</label>
      <select id="bRam">
        <option value="4">4 GB — a very old or cheap machine</option>
        <option value="6">6 GB — an older laptop</option>
        <option value="8">8 GB — a basic modern laptop or good phone</option>
        <option value="12">12 GB — a recent mid-range laptop</option>
        <option value="16" selected>16 GB — most modern laptops and Macs</option>
        <option value="24">24 GB — a strong laptop or small desktop</option>
        <option value="32">32 GB — a workstation</option>
        <option value="64">64 GB — a serious workstation</option>
        <option value="128">128 GB or more — a server</option>
      </select>
      <p class="help q" data-for="bRam">Memory (RAM) is not storage. It is the working space a program needs
        while running. On Windows: Settings → System → About. On a Mac: Apple menu → About This Mac.
        On Linux: <code>free -h</code>.</p>
    </div>
    <div>
      <label for="bGpu">3. Does it have a graphics card (GPU)?</label>
      <select id="bGpu">
        <option value="0" selected>I don't know — or it has none</option>
        <option value="8">Yes, about 8 GB (e.g. RTX 3060)</option>
        <option value="12">Yes, about 12 GB (e.g. RTX 4070)</option>
        <option value="16">Yes, about 16 GB (e.g. RTX 4080, 5070 Ti)</option>
        <option value="24">Yes, about 24 GB (e.g. RTX 3090, 4090)</option>
        <option value="48">Yes, 48 GB or more (workstation card)</option>
      </select>
      <p class="help q" data-for="bGpu">A GPU makes a model much faster; it does not change what the model can do.
        If you are unsure, choose "I don't know" — the suggestion will still work, just slower.
        Apple silicon Macs count as having a GPU, but please pick "none" here; the memory question already covers them.</p>
    </div>
    <div>
      <label for="bUse">4. What will you mostly use it for?</label>
      <select id="bUse">
        <option value="coding" selected>Writing and fixing code</option>
        <option value="chat">Answering questions and drafting text</option>
        <option value="images">Reading screenshots, photos and diagrams</option>
        <option value="offline">Anything, without internet</option>
        <option value="batch">Running the same task over many files</option>
      </select>
      <p class="help q" data-for="bUse">"Reading screenshots" needs a special model that can see pictures.
        "Running the same task over many files" favours a smaller, faster model over a smarter, slower one.</p>
    </div>
    <div>
      <label for="bDisk">5. How much disk space can you spare?</label>
      <select id="bDisk">
        <option value="3">Up to 3 GB</option>
        <option value="6">Up to 6 GB</option>
        <option value="12" selected>Up to 12 GB</option>
        <option value="30">Up to 30 GB</option>
        <option value="100">Plenty (100 GB or more)</option>
      </select>
      <p class="help q" data-for="bDisk">Models are saved as files. A 7B model is about 4.7 GB — roughly one
        high-resolution movie. Unused models can be deleted at any time to get the space back.</p>
    </div>
  </div>

  <div class="suggest" id="bOut"></div>
</section>

<section><h2>Which model? (the short answer)</h2>
  <table><thead><tr><th>model</th><th>file</th><th>RAM</th><th>fits</th><th>use it for</th></tr></thead>
  <tbody>${picks}</tbody></table>
  <p class="note"><b>Start with 7B.</b> Here is the honest split: by size, the <b>3B</b> already covers about
  90% of everyday calls — its context fits. But fitting is not the same as succeeding: on real edits a 7B
  finishes noticeably more often, so per dollar of your time it wins. Take the 3B when memory is tight
  (older laptop, phone), the 7B when it fits, and the 14B/32B only when the 7B visibly struggles.</p>
</section>

<section><h2>Get a working unit — pick your machine</h2>
  <div class="tabs" id="tabs">${PLATFORMS.map((p, i) => `<button class="tab${i === 0 ? ' on' : ''}" data-tab="${String(i)}">${p.label}</button>`).join('')}</div>
  ${PLATFORMS.map((p, i) => `<div class="pane${i === 0 ? ' on' : ''}" data-pane="${String(i)}">
    <p class="dl"><a class="btn" href="${p.download.url}" target="_blank" rel="noopener">${p.download.text} →</a>
      <span class="muted">free, from the people who make the model runner</span></p>
    <ol class="cmds">${p.commands.map(c => `<li><code>${c.replaceAll('<', '&lt;')}</code><button class="copy" data-copy>copy</button></li>`).join('')}</ol>
    <p class="note">${p.note}</p>
  </div>`).join('')}
  <p class="note"><b>How you know it worked:</b> the last command prints a short JSON reply containing "ready".
  That means the model is on your machine and answering — no account, no internet needed after this.</p>
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

<p class="foot"><a href="/providers">Other providers and what they cost</a> &nbsp;·&nbsp; <a href="/guide">← The getting-started guide</a> &nbsp;·&nbsp; <a href="/">The door</a></p>

<script>
(() => {
  // The builder's catalogue. ram = memory the model needs to run comfortably;
  // disk = the download in GB; the numbers are what each one is genuinely good at.
  const MODELS = [
    { id: 'qwen2.5-coder:1.5b', ram: 4,  disk: 1.1, coding: 2, chat: 3, vision: 0, ctx: '4k',  note: 'runs almost anywhere, struggles with real edits' },
    { id: 'qwen2.5-coder:3b',   ram: 6,  disk: 2.0, coding: 3, chat: 3, vision: 0, ctx: '8k',  note: 'the smallest that handles simple coding well' },
    { id: 'qwen2.5-coder:7b',   ram: 10, disk: 4.7, coding: 4, chat: 3, vision: 0, ctx: '16k', note: 'the all-round coding pick' },
    { id: 'qwen2.5-coder:14b',  ram: 18, disk: 9,   coding: 5, chat: 3, vision: 0, ctx: '32k', note: 'near-cloud on routine code, needs real memory' },
    { id: 'qwen2.5-coder:32b',  ram: 32, disk: 20,  coding: 5, chat: 4, vision: 0, ctx: '32k', note: 'the personal-hardware ceiling' },
    { id: 'llama3.2:3b',        ram: 6,  disk: 2.0, coding: 2, chat: 5, vision: 0, ctx: '8k',  note: 'friendlier for conversation than code' },
    { id: 'moondream',          ram: 4,  disk: 1.7, coding: 1, chat: 2, vision: 5, ctx: '4k',  note: 'reads pictures: screenshots, photos, diagrams' },
  ]
  const el = (id) => document.getElementById(id)
  const dev = el('bDevice'), ram = el('bRam'), gpu = el('bGpu'), use = el('bUse'), disk = el('bDisk'), out = el('bOut')

  const speed = (machine, vram) => {
    if (machine === 'phone') return 'slow — a few words per second, and the phone gets warm'
    if (vram > 0) return 'fast — comfortable for real work'
    if (machine === 'laptop') return 'okay — usable, a little slow on long replies'
    return 'okay — usable, faster with a graphics card'
  }

  const recommend = () => {
    const machine = dev.value
    const totalRam = Number(ram.value)
    const vram = Number(gpu.value)
    const want = use.value
    const diskLimit = Number(disk.value)

    // Memory the model may use: leave the system room, and count a GPU at 1.2x
    // because its memory must also hold the context cache.
    const systemReserve = machine === 'server' ? 4 : Math.min(4, Math.max(2, totalRam * 0.25))
    const budget = Math.max(totalRam - systemReserve, vram > 0 ? vram * 1.2 : 0)

    const weight = (m) => {
      if (want === 'images') return m.vision
      if (want === 'chat') return m.chat
      if (want === 'offline') return Math.max(m.coding, m.chat)
      if (want === 'batch') return m.ram <= 10 ? 4 : 2   // small model, repeated many times
      return m.coding
    }

    const fitsAll = MODELS.filter(m => m.ram <= budget && m.disk <= diskLimit && (want !== 'images' || m.vision > 0))
    const fitsMemory = MODELS.filter(m => m.ram <= budget && (want !== 'images' || m.vision > 0))
    const pool = fitsAll.length > 0 ? fitsAll : (fitsMemory.length > 0 ? [fitsMemory[0]] : [MODELS[0]])
    pool.sort((a, b) => (weight(b) - weight(a)) || (b.ram - a.ram))
    const best = pool[0]
    const smaller = pool.find(m => m !== best && m.ram < best.ram)
    const diskShort = fitsMemory.length > 0 && fitsAll.length === 0

    const steps = [
      'Install the model runner: <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a>',
      'Open a terminal and run <code>ollama pull ' + best.id + '</code>',
      'Check it answers: <code>ollama run ' + best.id + ' "Say ready"</code>',
    ].map(step => '<li>' + step + '</li>').join('')

    out.innerHTML =
      '<p class="suggesthead">For ' + dev.options[dev.selectedIndex].text.toLowerCase() +
      ', with ' + ram.options[ram.selectedIndex].text.split(' —')[0] + ' of memory' +
      (vram > 0 ? ' and ' + gpu.options[gpu.selectedIndex].text.toLowerCase() : ' and no graphics card') +
      ', used for ' + use.options[use.selectedIndex].text.toLowerCase() + ':</p>' +
      '<p class="suggestpick">' + best.id + '</p>' +
      '<p class="suggestmeta">' + best.disk.toFixed(1) + ' GB download · needs about ' + best.ram +
        ' GB of memory · ' + best.ctx + ' of context — ' + best.note + '</p>' +
      '<p class="suggestmeta">Expected speed: ' + speed(machine, vram) + '.</p>' +
      (diskShort ? '<p class="suggestwarn">It needs more disk space than you selected. Free some space, or take the smaller option below.</p>' : '') +
      '<p class="suggesthead" style="margin-top:.8rem">How to get it running (three steps):</p>' +
      '<ol class="suggeststeps">' + steps + '</ol>' +
      (smaller ? '<p class="suggestalt">If it feels heavy or slow, try <b>' + smaller.id + '</b> (' +
        smaller.disk.toFixed(1) + ' GB, ' + smaller.note + ') — you can delete a model any time with <code>ollama rm</code>.</p>' : '') +
      '<p class="suggestalt">This is a suggestion from your answers, not a test result. If the first reply takes ' +
        'longer than a minute, take the smaller model — or connect this machine to Massai so the hard steps ' +
        'go to DeepSeek instead.</p>'
  }
  for (const control of [dev, ram, gpu, use, disk]) control.addEventListener('change', recommend)
  recommend()
})()
</script>
<script>
(() => {
  // platform tabs + copy buttons
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const other of document.querySelectorAll('.tab')) other.classList.remove('on')
      for (const pane of document.querySelectorAll('.pane')) pane.classList.remove('on')
      tab.classList.add('on')
      document.querySelector('.pane[data-pane="' + tab.dataset.tab + '"]').classList.add('on')
    })
  }
  for (const button of document.querySelectorAll('.copy')) {
    button.addEventListener('click', async () => {
      const code = button.parentElement.querySelector('code')
      try { await navigator.clipboard.writeText(code.textContent) ; button.textContent = 'copied'; setTimeout(() => { button.textContent = 'copy' }, 1500) }
      catch { button.textContent = 'select it' }
    })
  }
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
