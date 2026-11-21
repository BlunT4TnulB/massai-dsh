/**
 * The providers page: what each AI backend costs, where its free tier actually
 * stops, and when paying is the honest choice.
 *
 * The numbers are indicative and dated, because every provider changes them.
 * Each row links to the source of truth instead of pretending to be one.
 *
 * @module @deepseek-ai/dsh-hosted-signin/providers-page
 */

/** How a backend is reached and what it costs to start. */
interface Backend {
  /** Display name. */
  name: string
  /** Environment variable that switches it on. */
  env: string
  /** What the free tier gives you, in plain words. */
  free: string
  /** Where the free tier runs out. */
  wall: string
  /** Where to get the key. */
  keyUrl: string
  /** Where the provider publishes its prices. */
  priceUrl: string
  /** What it is genuinely good for. */
  use: string
}

/** The backends this deployment can talk to. */
const BACKENDS: readonly Backend[] = [
  {
    name: 'DeepSeek (this deployment’s default)',
    env: 'DEEPSEEK_API_KEY',
    free: 'No free tier — pay as you go, from a few dollars.',
    wall: 'No hard cap; you spend what you put in. Cents per session, halved off-peak.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    priceUrl: 'https://platform.deepseek.com/api_docs/pricing',
    use: 'Real work: long sessions, tool loops, code that has to compile.',
  },
  {
    name: 'Google Gemini',
    env: 'GEMINI_API_KEY',
    free: 'Free tier, no card required. 1M-token context.',
    wall: 'Per-minute and per-day request caps, and free-tier prompts may be used to improve Google’s products. Terms also require the paid tier when you give an API client to users in the EEA, UK or Switzerland.',
    keyUrl: 'https://aistudio.google.com/apikey',
    priceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    use: 'Huge-context reading, quick answers, image and audio input.',
  },
  {
    name: 'Groq',
    env: 'GROQ_API_KEY',
    free: 'Free tier, no card. Very fast inference on open models.',
    wall: 'About 1,000 requests and 200k tokens per day per model. Verified working with openai/gpt-oss-120b — a good afternoon of building reaches the cap.',
    keyUrl: 'https://console.groq.com/keys',
    priceUrl: 'https://groq.com/pricing',
    use: 'Speed: drafting, reformatting, quick edits where latency matters.',
  },
  {
    name: 'OpenRouter',
    env: 'OPENROUTER_API_KEY',
    free: '17 models marked `:free`, one key for all of them.',
    wall: 'Around 20 requests/minute and 50/day per free model. Two hundred small calls and the day is done.',
    keyUrl: 'https://openrouter.ai/keys',
    priceUrl: 'https://openrouter.ai/models',
    use: 'Sampling many models through one key; a cheap way to compare opinions.',
  },
  {
    name: 'Anthropic Claude',
    env: 'ANTHROPIC_API_KEY',
    free: 'No real free tier — a small trial credit at best.',
    wall: 'Paid from the first serious request.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    priceUrl: 'https://www.anthropic.com/pricing',
    use: 'Long, careful reasoning and prose quality.',
  },
  {
    name: 'OpenAI',
    env: 'OPENAI_API_KEY',
    free: 'No free tier for the API — billing required.',
    wall: 'Paid from the first request.',
    keyUrl: 'https://platform.openai.com/api-keys',
    priceUrl: 'https://openai.com/api/pricing',
    use: 'Ecosystem breadth and tool-calling behaviour that most code assumes.',
  },
]


/** The collection checklist, in the order worth doing. */
const CHECKLIST: ReadonlyArray<{
  env: string
  name: string
  url: string
  steps: string
  unlocks: string
}> = [
  {
    env: 'DEEPSEEK_API_KEY',
    name: 'DeepSeek',
    url: 'https://platform.deepseek.com/api_keys',
    steps: 'Sign in → Create new key → copy the sk-… value. Add credit at platform.deepseek.com/top_up.',
    unlocks: 'Real work. The default backend and the one the whole workshop is tuned for.',
  },
  {
    env: 'GEMINI_API_KEY',
    name: 'Google Gemini',
    url: 'https://aistudio.google.com/apikey',
    steps: 'Sign in with Google → Create API key → copy the AQ.… value.',
    unlocks: '1M-token context reading, images and audio, free tier.',
  },
  {
    env: 'GROQ_API_KEY',
    name: 'Groq',
    url: 'https://console.groq.com/keys',
    steps: 'Sign in → API Keys → Create API Key → copy the gsk_… value.',
    unlocks: 'The fastest replies of any provider here, free tier.',
  },
  {
    env: 'OPENROUTER_API_KEY',
    name: 'OpenRouter',
    url: 'https://openrouter.ai/keys',
    steps: 'Sign in → Keys → Create Key → copy the sk-or-… value.',
    unlocks: 'Seventeen free models through one key.',
  },
  {
    env: 'ANTHROPIC_API_KEY',
    name: 'Anthropic Claude',
    url: 'https://console.anthropic.com/settings/keys',
    steps: 'Sign in → API keys → Create key → copy the sk-ant-… value. Needs a card.',
    unlocks: 'Careful long-form reasoning; paid only.',
  },
  {
    env: 'OPENAI_API_KEY',
    name: 'OpenAI',
    url: 'https://platform.openai.com/api-keys',
    steps: 'Sign in → API keys → Create new secret key → copy the sk-… value. Needs billing.',
    unlocks: 'The widest ecosystem; paid only.',
  },
]

/** What the free tiers actually teach you, in three beats. */
const LESSONS: ReadonlyArray<readonly [string, string]> = [
  [
    'Free tiers are measured per day, and a build is measured in hundreds',
    'A single agent session can make 200–500 model calls. Groq frees ~1,000/day, OpenRouter ~50/day per model, Gemini a per-minute cap. The wall is not “someday” — it is 20 minutes into a good session, usually mid-task, usually with an error you then have to work around.',
  ],
  [
    'Free usually costs data, not money',
    'Gemini’s free tier may use your prompts to improve their products. That is a fair trade for a hobby question and a bad one for a customer’s code. Paid tiers exist partly to buy back that privacy.',
  ],
  [
    'Paid is cheap at agent scale — the fear is bigger than the bill',
    'DeepSeek charges cents for a normal session, and half that off-peak. The reason to pay is not volume, it is not being interrupted: no daily caps, no queue, no “try again tomorrow” halfway through the thing you were building.',
  ],
]

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
 * Render the providers page.
 * @returns the page HTML.
 */
export function providersPageHtml(): string {
  const rows = BACKENDS.map((backend) => {
    const on = (process.env[backend.env] ?? '') !== ''
    return `<tr>
      <td><span class="dot ${on ? 'on' : 'off'}"></span><b>${esc(backend.name)}</b></td>
      <td>${on ? '<span class="pill on">switched on</span>' : `<span class="pill">needs ${esc(backend.env)}</span>`}</td>
      <td>${esc(backend.use)}</td>
      <td>
        <a href="${esc(backend.keyUrl)}" target="_blank" rel="noopener">get a key</a> ·
        <a href="${esc(backend.priceUrl)}" target="_blank" rel="noopener">prices</a>
      </td>
    </tr>
    <tr class="detail"><td colspan="4">
      <p><b>Free:</b> ${esc(backend.free)}</p>
      <p><b>Where it runs out:</b> ${esc(backend.wall)}</p>
    </td></tr>`
  }).join('')
  const checklist = CHECKLIST.map((item, index) => {
    const ready = (process.env[item.env] ?? '') !== ''
    return `<tr>
      <td>${String(index + 1)}</td>
      <td><b>${esc(item.name)}</b><br><code>${esc(item.env)}</code></td>
      <td><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a>
        <p class="small">${esc(item.steps)}</p></td>
      <td>${esc(item.unlocks)}<br>${ready ? '<span class="pill on">already set</span>' : '<span class="pill">not set</span>'}</td>
    </tr>`
  }).join('')
  const lessons = LESSONS.map(([title, body]) => `<div class="lesson">
    <h3>${esc(title)}</h3><p>${esc(body)}</p>
  </div>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — providers and what they cost</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.13),transparent 70%)}
  main{max-width:56rem;margin:0 auto}
  h1{margin:0 0 .4rem;font-size:1.3rem;font-weight:700}
  .lede{margin:0 0 1.5rem;color:#a9a9b3;font-size:.92rem;line-height:1.65}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin-bottom:1rem}
  h2{margin:0 0 .8rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:.84rem}
  th{text-align:left;color:#82828b;font-weight:600;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;padding:.35rem .4rem;border-bottom:1px solid #26262d}
  td{padding:.45rem .4rem;border-bottom:1px solid #1f1f26;color:#c9c9d2;vertical-align:top}
  tr.detail td{background:#141419;border-bottom:1px solid #26262d;font-size:.8rem;color:#9a9aa3}
  tr.detail p{margin:.15rem 0}
  tr.detail b{color:#c2c2cb}
  .dot{display:inline-block;width:.5rem;height:.5rem;border-radius:50%;margin-right:.45rem}
  .dot.on{background:#7ee2a8}.dot.off{background:#4a4a54}
  .pill{display:inline-block;padding:.1rem .4rem;border-radius:.3rem;border:1px solid #31313a;color:#8a8a93;font-size:.64rem;letter-spacing:.06em}
  .pill.on{border-color:#1f4a33;color:#7ee2a8}
  .lesson{border:1px solid #26262d;border-radius:.6rem;padding:.8rem .9rem;margin-bottom:.55rem;background:#1b1b22}
  .lesson h3{margin:0 0 .3rem;font-size:.92rem}
  .lesson p{margin:0;color:#b9b9c2;font-size:.85rem;line-height:1.6}
  a{color:#7ee2a8;text-decoration:none}
  .note{margin:.8rem 0 0;font-size:.78rem;color:#6f6f78;line-height:1.6}
  .small{margin:.25rem 0 0;font-size:.74rem;color:#7d7d86;line-height:1.5}
  .foot{margin-top:1.2rem;font-size:.8rem;color:#6f6f78}
  code{background:#1f1f27;padding:.1rem .3rem;border-radius:.3rem;font-size:.78rem}
</style></head><body><main>
<h1>Every brain, and what it really costs</h1>
<p class="lede">One deployment can talk to several providers. This page shows which are switched on,
what each free tier actually gives you, and where it stops being free — so the choice is yours
rather than a surprise at 4pm on a Tuesday.</p>

<section><h2>Backends</h2>
  <table><thead><tr><th>provider</th><th>state</th><th>good at</th><th>links</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="note">A provider is switched on by putting its key in the deployment environment
  (<code>GEMINI_API_KEY</code>, <code>GROQ_API_KEY</code>, …) and restarting. Off means invisible:
  it is not offered in the model picker and cannot be chosen by mistake.</p>
</section>

<section><h2>Collect your keys — in this order</h2>
  <p class="note" style="margin-top:0">Each row gives the exact page, what to click, and the environment
  variable the key goes into. Do them top to bottom; the first one is the only one that costs money.</p>
  <table><thead><tr><th>#</th><th>provider</th><th>where</th><th>what you get</th></tr></thead><tbody>${checklist}</tbody></table>
  <p class="note">Adding a key: paste it into the deployment's environment as the variable named above, then
  restart. The provider appears in the model picker; without the key it stays invisible, never broken.</p>
</section>

<section><h2>Tower of Knowledge</h2>
  <p class="note" style="margin-top:0">Three floors, learned the expensive way. Each one is why the next key matters.</p>
  ${lessons}</section>

<section><h2>The practical answer</h2>
  <p class="note" style="margin-top:0;font-size:.86rem;color:#c2c2cb">Start free — a Gemini or Groq
  key costs nothing and is enough to learn what the workshop does. The moment you are mid-build and
  the daily cap stops you, put a few dollars on DeepSeek: it is the cheapest way to keep working,
  it halves off-peak, and it is the one provider this whole app was built around.</p>
</section>

<p class="foot"><a href="/">← The door</a> &nbsp;·&nbsp; <a href="/local">Local models (free forever)</a>
&nbsp;·&nbsp; <a href="/rates">DeepSeek rates</a></p>
</main></body></html>`
}
