/**
 * The public "easy mode" guide: plain-language steps for a first-time visitor,
 * reachable without an account, a repo, or a key.
 *
 * @module @deepseek-ai/dsh-hosted-signin/guide
 */

/** One numbered step. */
interface Step {
  title: string
  body: string
}

/** The exact URLs the guide points at; one place to change if they move. */
const LINKS = {
  signUp: 'https://platform.deepseek.com/sign_up',
  keys: 'https://platform.deepseek.com/api_keys',
  topUp: 'https://platform.deepseek.com/top_up',
} as const

const STEPS: readonly Step[] = [
  {
    title: 'Get a DeepSeek key',
    body: `Make an account at <a href="${LINKS.signUp}" target="_blank" rel="noopener">platform.deepseek.com</a>
      (Google sign-in works), then open
      <a href="${LINKS.keys}" target="_blank" rel="noopener">API keys</a> and press
      <b>Create new key</b>. Copy it — it looks like <code>sk-…</code> and is shown once.
      Treat it like a password.`,
  },
  {
    title: 'Add a few dollars of credit',
    body: `Open <a href="${LINKS.topUp}" target="_blank" rel="noopener">Top up</a>.
      A few dollars builds for weeks: a normal session costs cents. Two habits stretch it —
      build during DeepSeek's <b>off-peak</b> window (the Rates page shows it in your time zone),
      and let Massai use the cheap model for ordinary work.`,
  },
  {
    title: 'Open Massai and paste the key',
    body: `Come back to this page, paste the key into the box, press <b>Sign in</b>. That is the
      whole login. If you sign in with Google instead, Massai can remember you — the pasted key
      is the path that always works.`,
  },
  {
    title: 'Say what you want',
    body: `Describe it in your own words, vibe included — "calm", "looks expensive", "like Apple".
      You do not need to know anything about code. If you are stuck, start with one of the
      guided examples.`,
  },
]

const EXAMPLES: readonly string[] = [
  'A one-page site for my repair shop. Dark, simple, hours and a phone number.',
  'A tool that turns a folder of photos into a contact sheet PDF.',
  'Fix the error in this file: (paste the error)',
  'Open my GitHub repo and add a README that explains it.',
]

const TROUBLE: ReadonlyArray<readonly [string, string]> = [
  ['Invalid API key', 'The key was mistyped or deleted. Make a new one on DeepSeek and paste it again.'],
  ['Blank page for a while', 'The free host is waking up. Wait 30–60 seconds and reload.'],
  ['Insufficient balance', 'DeepSeek credit ran out. Top up a few dollars.'],
  ['A model-switch note in chat', 'Normal: the agent moved to a cheaper model, or to one that can see your image.'],
  ['Image rejected', 'That model cannot see pictures. Massai switches automatically; if it still refuses, pick the cheap model.'],
]

/**
 * Render the guide.
 * @returns the page HTML.
 */
export function guidePageHtml(): string {
  const steps = STEPS.map((step, index) => `<div class="step">
    <div class="num">${String(index + 1)}</div>
    <div><h3>${step.title}</h3><p>${step.body}</p></div>
  </div>`).join('')
  const examples = EXAMPLES.map(example => `<li>${example}</li>`).join('')
  const trouble = TROUBLE.map(([what, means]) => `<tr><td>${what}</td><td>${means}</td></tr>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — get started</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<style>
  .brandmark{width:1.6rem;height:1.6rem;flex:none;vertical-align:-.3rem;margin-right:.5rem}

  *{box-sizing:border-box}
  body{margin:0;padding:2.2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.14),transparent 70%)}
  main{max-width:46rem;margin:0 auto}
  header{display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem}
  header svg{width:2rem;height:auto}
  h1{margin:0;font-size:1.35rem;font-weight:700;letter-spacing:-.01em}
  .lede{margin:.5rem 0 1.6rem;color:#a9a9b3;font-size:.95rem;line-height:1.65}
  .step{display:flex;gap:.9rem;border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;
    padding:1rem 1.1rem;margin-bottom:.7rem}
  .num{flex:none;width:1.9rem;height:1.9rem;border-radius:50%;background:#C1440E;color:#fff;
    display:grid;place-items:center;font-weight:700;font-size:.9rem}
  .step h3{margin:.15rem 0 .35rem;font-size:1rem}
  .step p{margin:0;color:#b9b9c2;font-size:.9rem;line-height:1.65}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin:1.1rem 0}
  h2{margin:0 0 .7rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  code{background:#1f1f27;padding:.12rem .35rem;border-radius:.3rem;font-size:.82rem}
  a{color:#7ee2a8;text-decoration:none}
  ul{margin:.2rem 0 0;padding-left:1.1rem;color:#c2c2cb;font-size:.88rem;line-height:1.7}
  table{width:100%;border-collapse:collapse;font-size:.86rem}
  td{padding:.45rem .3rem;border-bottom:1px solid #1f1f26;color:#c2c2cb;vertical-align:top}
  td:first-child{color:#F2F2F4;font-weight:600;width:12rem}
  .short{margin:1.2rem 0 0;padding:1rem 1.1rem;border-radius:.8rem;border:1px solid #3a2a1f;
    background:linear-gradient(180deg,#1d1712,#17171c)}
  .short b{color:#D9822B}
  .foot{margin-top:1.6rem;font-size:.8rem;color:#6f6f78;line-height:1.7}
</style></head><body><main>
<header>
  <svg viewBox="0 0 120 132" aria-hidden="true">
    <ellipse cx="60" cy="10" rx="21" ry="5.6" fill="none" stroke="#C9A227" stroke-width="3"/>
    <path d="M16 100L104 22M104 100L16 22" stroke="#C1440E" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>
    <path d="M60 16c24 0 35 14 35 33 0 24-17 40-28 46 4 6 8 11 8 11s-9-4-15-4-15 4-15 4 4-5 8-11c-11-6-28-22-28-46 0-19 11-33 35-33z"
      fill="#151517" stroke="#C1440E" stroke-width="4.5"/>
  </svg>
  <h1><img class="brandmark" src="/massai-crest.svg" alt="" width="26" height="26">Get started</h1>
</header>
<p class="lede">No jargon, no install. About five minutes, and a few dollars of credit goes a long way.
Massai is where you describe what you want built and an AI agent builds it with you. The intelligence
is DeepSeek's; you bring your own key, so usage is billed to you at their published rates.</p>

${steps}

<section><h2>Good first things to ask for</h2><ul>${examples}</ul></section>

<section><h2>If something goes wrong</h2><table>${trouble}</table></section>

<div class="short"><b>The shortest possible version:</b> make a DeepSeek key → add $5 →
paste it on this site → type what you want. Everything else is optional.</div>

<p class="foot">Want an agent that runs on your own computer (free per message, works offline)?
That is the optional advanced path — <a href="/local">see the local models guide</a>.
<br><br><a href="/">← Back to the door</a></p>
</main></body></html>`
}
