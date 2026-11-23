/**
 * The honest page.
 *
 * Every limit, every requirement, and every "what happens when you hit it" —
 * written down before anyone has to discover it by bumping into it. The owner's
 * rule is simple: nothing hidden, ever. That makes this page a promise list
 * rather than marketing.
 *
 * @module @deepseek-ai/dsh-hosted-signin/limits-page
 */

/** Escape one string for HTML text. */
function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Numbers that appear in the copy, so the page and the code cannot drift. */
export interface LimitFacts {
  /** Free prompts per guest session. */
  guestPrompts: number
  /** Guest sessions per network per day. */
  guestSessions: number
  /** Per-person allowance in dollars. */
  userCap: number
  /** Whole-deployment ceiling in dollars. */
  monthlyCap: number
}

/** Read the live numbers from the environment, with the shipped defaults. */
export function limitFacts(): LimitFacts {
  const num = (raw: string | undefined, fallback: number): number => {
    const value = Number(raw ?? '')
    return Number.isFinite(value) && value > 0 ? value : fallback
  }
  return {
    guestPrompts: num(process.env.DSH_GUEST_PROMPTS, 12),
    guestSessions: num(process.env.DSH_GUEST_SESSIONS_PER_DAY, 3),
    userCap: num(process.env.DSH_USER_BUDGET_USD, 0.25),
    monthlyCap: num(process.env.DSH_MONTHLY_BUDGET_USD, 5),
  }
}

/**
 * Render the disclosure page.
 * @returns the page HTML.
 */
export function limitsPageHtml(): string {
  const f = limitFacts()
  const money = (value: number): string => (value < 1 ? `${(value * 100).toFixed(0)}¢` : `$${value.toFixed(2)}`)
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>What this can and cannot do — Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="description" content="Every limit, requirement and next step in Massai, stated before you hit it.">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 4rem;background:#0e0e10;color:#E9E9EF;
    font-family:system-ui,-apple-system,sans-serif;line-height:1.65;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.10),transparent 70%)}
  main{max-width:46rem;margin:0 auto}
  .brand{display:flex;align-items:center;gap:.6rem;margin-bottom:.2rem}
  .brand img{width:2rem;height:2rem}
  .brand span{font-family:Georgia,serif;letter-spacing:.26em;color:#EFDCA4}
  .tag{margin:0 0 1.6rem;font-size:.66rem;letter-spacing:.34em;text-transform:uppercase;color:#D9822B;font-weight:700}
  h1{font-size:1.35rem;margin:0 0 .4rem}
  .lede{color:#a9a9b3;margin:0 0 1.6rem}
  h2{font-size:.98rem;margin:2rem 0 .6rem;color:#F2F2F4;padding-top:.4rem;border-top:1px solid #26262d}
  p,li{color:#b9b9c2;font-size:.92rem}
  b{color:#E9E9EF}
  table{width:100%;border-collapse:collapse;font-size:.88rem;margin:.4rem 0 .8rem}
  th{text-align:left;color:#82828b;font-weight:600;font-size:.7rem;letter-spacing:.1em;
    text-transform:uppercase;padding:.4rem .5rem;border-bottom:1px solid #26262d}
  td{padding:.45rem .5rem;border-bottom:1px solid #1f1f26;vertical-align:top}
  .box{border:1px solid #2f2f37;background:#17171c;border-radius:.6rem;padding:.9rem 1rem;margin:.8rem 0}
  .warn{border-color:#5a3a12;background:#1d1710}
  a{color:#7ee2a8}
  code{background:#1c1c23;padding:.1rem .3rem;border-radius:.25rem;font-size:.85em}
  .foot{margin-top:2.4rem;padding-top:1rem;border-top:1px solid #26262d;color:#6f6f78;font-size:.8rem}
</style></head><body><main>
<div class="brand"><img src="/massai-crest.svg" alt=""><span>MASSAI</span></div>
<p class="tag">Into the Unknown</p>
<h1>What this can and cannot do</h1>
<p class="lede">Everything here is a limit you would otherwise discover by bumping into it. Read it once
and nothing will surprise you later — not the caps, not the costs, not what happens to your work.</p>

<h2>The free preview, exactly</h2>
<table>
  <tr><th>thing</th><th>number</th><th>what happens at the limit</th></tr>
  <tr><td>messages per session</td><td><b>${f.guestPrompts}</b></td><td>the assistant says the preview has ended and where to continue</td></tr>
  <tr><td>preview sessions per network, per day</td><td><b>${f.guestSessions}</b></td><td>a page explains it and offers your own key — resets at midnight UTC</td></tr>
  <tr><td>free allowance per person, per month</td><td><b>${money(f.userCap)}</b></td><td>you can keep going with your own key, or with a credit top-up</td></tr>
  <tr><td>whole workshop, per month</td><td><b>${money(f.monthlyCap)}</b></td><td>the free tier pauses until the 1st; your own key is never affected</td></tr>
</table>
<p>Who pays: the operator, out of pocket. That is why the numbers are small and why they are printed here.</p>

<h2>What you need, and when</h2>
<table>
  <tr><th>stage</th><th>you need</th></tr>
  <tr><td>trying it</td><td>nothing — no account, no card, no key</td></tr>
  <tr><td>building past ${f.guestPrompts} messages</td><td>your own model key, or credit</td></tr>
  <tr><td>a model key</td><td>one minute at <a href="/providers">the providers page</a>: create the key, paste it at <a href="/access">/access</a></td></tr>
  <tr><td>keeping work outside Massai</td><td>copy or export it — see the storage notice below</td></tr>
</table>

<h2>Storage: what is kept, and what is not</h2>
<div class="box">
<p><b>Projects are kept.</b> When a build succeeds it is saved to real object storage, and it survives
restarts and redeploys. Your <a href="/projects">projects page</a> lists everything you have made.</p>
<p><b>Conversations are not kept yet.</b> The chat transcript itself lives in memory and is lost when the
service restarts. If a conversation matters, build from it — the artifact is what gets saved.</p>
<p><b>Nothing is deleted because you ran out of allowance.</b> Running out pauses; it never removes.
Deleting is always something you choose.</p>
</div>

<h2>Tips that save you money and time</h2>
<ul>
  <li><b>Be specific.</b> One clear paragraph beats five vague ones — fewer messages, better results.</li>
  <li><b>Ask for the smallest thing that works first</b>, then add. Big rewrites burn allowance fast.</li>
  <li><b>Model choice matters.</b> The cheap model handles most steps; the expensive one is for planning
      and for getting unstuck. <a href="/models">The model guide</a> says which is which.</li>
  <li><b>Off-peak is half price.</b> Some providers discount outside peak hours — <a href="/rates">rates page</a>.</li>
  <li><b>Your own key never competes for the free allowance.</b> If you are serious, bring one.</li>
  <li><b>Look at what was spent.</b> <a href="/usage">Usage</a> shows every call, per model, in dollars.</li>
</ul>

<h2>If you want to go further than easy mode</h2>
<table>
  <tr><th>path</th><th>what it gives you</th><th>where</th></tr>
  <tr><td>your own key</td><td>no caps, you pay the provider directly at their rates</td><td><a href="/access">/access</a></td></tr>
  <tr><td>several providers</td><td>Gemini, Groq and others as extra brains; prices shown side by side</td><td><a href="/providers">/providers</a></td></tr>
  <tr><td>local models</td><td>free forever, works offline, private — needs RAM, not money</td><td><a href="/local">/local</a></td></tr>
  <tr><td>your own machines as agents</td><td>the free tier can borrow your computer's model</td><td><a href="/workers">/workers</a></td></tr>
  <tr><td>run the whole thing yourself</td><td>fork the repository, own the deployment, no middleman</td><td><a href="/guide">/guide</a></td></tr>
</table>

<h2>What we will never do</h2>
<ul>
  <li>Sell your data, or train models on your conversations.</li>
  <li>Charge you without telling you the price first — there is no paid tier today at all.</li>
  <li>Claim a partnership with a model provider that does not exist.</li>
  <li>Hide a limit and let you discover it by failing.</li>
</ul>

<h2>When something goes wrong</h2>
<p>Use the <a href="/feedback">feedback form</a> — a human reads it. For data deletion, see
<a href="/privacy">privacy</a>; for conduct rules, <a href="/aup">acceptable use</a>.</p>

<p class="foot"><a href="/">The door</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
· <a href="/aup">Acceptable use</a> · <a href="/support">Support</a> · <a href="/access">Sign in</a></p>
</main></body></html>`
}

/** Keep the escape helper referenced for future edits without tripping strict lint. */
void esc
