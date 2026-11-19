/**
 * The concierge door: one page, many headlines. `?line=` cycles the library so
 * the owner can shop for the line that lands, without a rebuild between tries.
 *
 * @module @deepseek-ai/dsh-host-webserver/welcome-page
 */

/** Headline candidates, in the order `?line=` walks them. */
const HEADLINES = [
  'Into the unknown.',
  'Point at it. It gets built.',
  'Describe it. It exists.',
  'Say it. Ship it.',
  'From sentence to software.',
  'Ideas in. Software out.',
  'Build the thing that doesn\'t exist.',
  'Unknown in. Running out.',
  'You think it. It runs.',
  'Bring a wish. Leave with it running.',
  'No plan required.',
  'Start with nothing. End with something running.',
] as const

/** Proof-line candidates, cycled alongside the headline. */
const PROOFS = [
  ['Not a mockup. Not a draft.', 'It runs.'],
  ['Not a picture of software.', 'Software.'],
  ['Not a demo. Not a promise.', 'A working thing.'],
  ['Not a mockup. Not a draft.', 'It actually runs.'],
] as const

/** The standing support line under whichever headline is showing. */
const SUPPORT = `Point at what you want — a tool, a site, an app, a workflow, a thing that
  doesn't exist yet. A child could be walked through this. <b>You don't need to know a thing.</b>`

/** Which line indexes exist, for the shuffle link. */
export const LINE_COUNT = HEADLINES.length

/**
 * Render the door for one line index.
 * @param line - requested index (wraps into range); undefined picks the flagship line.
 * @returns the complete HTML document.
 */
export function welcomePage(line?: number): string {
  const index = ((line ?? 0) % LINE_COUNT + LINE_COUNT) % LINE_COUNT
  const headline = HEADLINES[index] ?? HEADLINES[0]
  const [proof, payoff] = PROOFS[index % PROOFS.length] ?? PROOFS[0]
  const next = (index + 1) % LINE_COUNT
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — into the unknown</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Massai">
<meta property="og:title" content="Massai — into the unknown">
<meta property="og:description" content="Point at what you want, and it gets built. A child could be walked through this. Not a mockup. Not a draft. Running software.">
<meta property="og:image" content="https://massai-dsh.onrender.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Massai — into the unknown">
<meta name="twitter:description" content="Not a mockup. Not a draft. Running software.">
<meta name="twitter:image" content="https://massai-dsh.onrender.com/og-image.png">
<meta name="description" content="Massai — into the unknown. Point at what you want and it gets built.">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#151517;color:#f2f2f4;font-family:system-ui,-apple-system,sans-serif}
  .card{max-width:38rem;padding:2.5rem;text-align:center}
  .hero-word{font-size:3.05rem;font-weight:700;letter-spacing:.2em;text-transform:lowercase;line-height:1;color:#F2F2F4}
  .hero-sub{margin:.55rem 0 1.5rem;color:#D9822B;font-size:.72rem;font-weight:600;letter-spacing:.32em;text-transform:uppercase}
  .hero-line{margin:1.5rem 0 .6rem;font-size:2.5rem;line-height:1.05;font-weight:700;letter-spacing:-.015em}
  .sub{margin:.2rem 0 1.2rem;color:#b9b9c0;font-weight:500;font-size:1.05rem;line-height:1.6}
  .sub b{color:#7ee2a8;font-weight:600}
  .punch{margin:.9rem 0 .2rem;font-size:1.12rem;font-weight:600;color:#F2F2F4;letter-spacing:.01em}
  .punch span{color:#D9822B}
  .pitch{margin:.4rem 0;color:#b9b9c0;line-height:1.55;font-weight:500}
  .pitch b{color:#7ee2a8;font-weight:600}
  a.get{margin:1.2rem 0;display:inline-block;padding:.7rem 1.2rem;border-radius:.5rem;
    background:#0f5d3a;color:#eafff2;text-decoration:none;font-weight:600;font-size:1rem}
  form{margin-top:1.4rem;display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
  input[type=text]{flex:1;min-width:16rem;padding:.7rem .9rem;border-radius:.5rem;border:1px solid #3a3a40;
    background:#222226;color:#f2f2f4;font-size:1rem}
  button{padding:.7rem 1.4rem;border-radius:.5rem;border:none;background:#2f6fed;color:#fff;
    font-weight:600;font-size:1rem;cursor:pointer}
  .promises{list-style:none;display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;
    margin:1.2rem 0 .2rem;padding:0}
  .promises li{padding:.32rem .7rem;border:1px solid #2f2f36;border-radius:2rem;
    color:#c9c9d1;font-size:.8rem;font-weight:600;letter-spacing:.02em;background:#191920}
  .invite{margin:1.3rem 0 .2rem;color:#F2F2F4;font-size:1rem;font-weight:600;letter-spacing:.01em}
  .credits{margin:1.6rem 0 .2rem;padding-top:1.1rem;border-top:1px solid #242429;color:#7d7d86;
    font-size:.8rem;line-height:1.6;font-weight:500}
  .small{margin-top:1rem;color:#8a8a92;font-size:.85rem;font-weight:500;line-height:1.5}
  a.shuffle{display:inline-block;margin-top:1.6rem;color:#5e5e67;font-size:.75rem;
    text-decoration:none;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
  a.shuffle:hover{color:#D9822B}
  .whale{position:fixed;right:1.4rem;bottom:1.2rem;width:4.5rem;height:auto;color:#7ee2a8;
    opacity:.16;pointer-events:none}
  @media(max-width:32rem){.whale{right:.8rem;bottom:.6rem;width:3rem;opacity:.12}
    .hero-line{font-size:2rem}.hero-word{font-size:2.4rem}}
</style></head><body><div class="card">
  <div class="hero-word">massai</div>
  <div class="hero-sub">open by default</div>
  <h1 class="hero-line">${headline}</h1>
  <p class="sub">${SUPPORT}</p>
  <p class="punch">${proof} <span>${payoff}</span></p>
  <p class="pitch">And it barely costs anything: a few dollars goes a long way — most people
  build for weeks on what a single coffee costs.</p>
  <ul class="promises"><li>No code</li><li>No setup</li><li>No experience needed</li></ul>
  <p class="invite">Bring the idea. We'll learn the rest together.</p>
  <a class="get" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">Get my DeepSeek key → (takes one minute)</a>
  <form method="POST" action="/api/signin">
    <input type="text" name="apiKey" placeholder="Paste your DeepSeek key (sk-…)" autocomplete="off" required>
    <button type="submit">Sign in</button>
  </form>
  <p class="credits">Massai stands on open-source shoulders — DeepSeek's engine first among them,
  with thanks. Fork it, branch it, build on it: that is the point.</p>
  <p class="small">By continuing you're signing in to DeepSeek; your usage is billed to your
  DeepSeek account at their published rates. Massai never sees or stores your payment details.</p>
  <a class="shuffle" href="/?line=${next}">another one →</a>
</div>
<svg class="whale" viewBox="0 0 16 10" aria-hidden="true" role="presentation">
  <g fill="currentColor">
    <rect x="2" y="3" width="4" height="1"/><rect x="2" y="4" width="9" height="1"/>
    <rect x="2" y="5" width="10" height="1"/><rect x="3" y="6" width="7" height="1"/>
    <rect x="11" y="3" width="1" height="1"/><rect x="12" y="2" width="1" height="2"/>
    <rect x="13" y="1" width="1" height="2"/><rect x="12" y="4" width="2" height="2"/>
    <rect x="13" y="5" width="1" height="2"/><rect x="6" y="1" width="1" height="2"/>
    <rect x="6" y="0" width="1" height="1"/>
  </g>
  <rect x="3" y="4" width="1" height="1" fill="#151517"/>
</svg>
</body></html>`
}
