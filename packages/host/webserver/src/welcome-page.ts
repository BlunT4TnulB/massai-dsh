/**
 * The concierge door, cut as a floating "before you start" card: the notice
 * explains what DeepSeek is and why a key is needed, the buttons route straight
 * to DeepSeek's own sign-up, the paste field stays for people who already have a
 * key, and the footer invites a note about what they're building.
 *
 * @module @deepseek-ai/dsh-host-webserver/welcome-page
 */

/** Headline candidates, one is drawn at random per visit. */
const HEADLINES = [
  'Into the unknown.',
  'Point at it. It gets built.',
  'Describe it. It exists.',
  'Say it. Ship it.',
  'From sentence to software.',
  'Ideas in. Software out.',
  'Build the thing that doesn\'t exist.',
  'You think it. It runs.',
  'Bring a wish. Leave with it running.',
] as const

/** Which line indexes exist. */
export const LINE_COUNT = HEADLINES.length

/** DeepSeek's own pages — the only place an account or key can be created. */
const DEEPSEEK_SIGNUP = 'https://platform.deepseek.com/sign_up'
const DEEPSEEK_KEYS = 'https://platform.deepseek.com/api_keys'
const DEEPSEEK_TOPUP = 'https://platform.deepseek.com/top_up'

/**
 * Render the door for one line index.
 * @param line - test override (wraps into range); omitted picks a fresh line per load.
 * @returns the complete HTML document.
 */
export function welcomePage(line?: number): string {
  const index = line === undefined
    ? Math.floor(Math.random() * LINE_COUNT)
    : ((line % LINE_COUNT) + LINE_COUNT) % LINE_COUNT
  const headline = HEADLINES[index] ?? HEADLINES[0]
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
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.75rem 1rem;
    background:#0e0e10;color:#F2F2F4;font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 18% 8%,rgba(193,68,14,.16),transparent 70%),
      radial-gradient(50rem 30rem at 88% 92%,rgba(77,107,254,.10),transparent 70%)}
  /* the floating "window" */
  .win{width:100%;max-width:33rem;border-radius:1rem;overflow:hidden;background:#17171c;
    border:1px solid #2c2c33;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.02) inset}
  .bar{display:flex;align-items:center;gap:.55rem;padding:.6rem .9rem;background:#1d1d24;
    border-bottom:1px solid #2a2a31;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
    color:#8a8a93;font-weight:600}
  .bar .dot{width:.55rem;height:.55rem;border-radius:50%;background:#33333c}
  .bar .dot:first-child{background:#C1440E}
  .bar .spacer{flex:1}
  .bar .flag{color:#D9822B;letter-spacing:.14em;font-size:.66rem}
  .card{padding:1.6rem 1.7rem 1.5rem}
  h1{margin:.2rem 0 .35rem;font-size:1.85rem;line-height:1.1;font-weight:700;letter-spacing:-.015em}
  .brandline{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.35rem}
  .word{font-size:1.1rem;font-weight:700;letter-spacing:.26em;text-transform:lowercase}
  .sub{color:#9a9aa3;font-size:.92rem;line-height:1.55;font-weight:500;margin:0 0 1.1rem}
  /* the notice block — reads like a disclaimer, says what is actually needed */
  .notice{border:1px solid #2f2f37;border-radius:.7rem;background:#1c1c23;padding:.95rem 1rem;margin:0 0 1.1rem}
  .notice h2{margin:0 0 .55rem;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#D9822B;font-weight:700}
  .notice ol{margin:0;padding-left:1.15rem;color:#b9b9c2;font-size:.87rem;line-height:1.6;font-weight:500}
  .notice ol li{margin:.2rem 0}
  .notice b{color:#F2F2F4;font-weight:600}
  .notice a{color:#7ee2a8;text-decoration:none;border-bottom:1px solid #2f6b4c}
  /* sign-up routes */
  .routes{display:grid;gap:.5rem;margin-bottom:.9rem}
  a.route{display:flex;align-items:center;gap:.7rem;padding:.68rem .85rem;border-radius:.55rem;
    border:1px solid #31313a;background:#1f1f27;text-decoration:none;color:#EDEDF1;font-weight:600;font-size:.92rem}
  a.route:hover{border-color:#C1440E;background:#23232c}
  a.route .glyph{width:1.25rem;height:1.25rem;display:grid;place-items:center;font-size:.95rem}
  a.route small{margin-left:auto;color:#82828b;font-weight:600;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}
  a.route.primary{background:#0f5d3a;border-color:#17724a}
  a.route.primary:hover{background:#127148}
  a.route.primary small{color:#a9e7c4}
  /* manual paste */
  .manual{border-top:1px solid #26262d;padding-top:.9rem;margin-top:.2rem}
  .manual label{display:block;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#82828b;font-weight:600;margin-bottom:.45rem}
  form{display:flex;gap:.5rem;flex-wrap:wrap}
  input[type=text]{flex:1;min-width:13rem;padding:.62rem .8rem;border-radius:.5rem;border:1px solid #3a3a44;
    background:#101014;color:#F2F2F4;font-size:.92rem}
  input[type=text]:focus{outline:2px solid #2f6fed;outline-offset:1px;border-color:#2f6fed}
  button{padding:.62rem 1.1rem;border-radius:.5rem;border:none;background:#2f6fed;color:#fff;
    font-weight:600;font-size:.92rem;cursor:pointer}
  /* footer */
  .foot{margin-top:1.1rem;padding-top:.9rem;border-top:1px solid #26262d}
  .ask{margin:0 0 .5rem;font-size:.86rem;color:#c9c9d2;font-weight:500}
  .ask a{color:#7ee2a8;text-decoration:none;border-bottom:1px solid #2f6b4c}
  .fine{margin:0;color:#6f6f78;font-size:.72rem;line-height:1.6;font-weight:500}
  .fine a{color:#8a8a93}
</style></head><body>
<div class="win" role="dialog" aria-labelledby="door-title">
  <div class="bar">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    <span class="spacer"></span>
    <span class="flag">open by default</span>
  </div>
  <div class="card">
    <div class="brandline"><span class="word">massai</span></div>
    <h1 id="door-title">${headline}</h1>
    <p class="sub">Point at what you want — a tool, a site, an app, a workflow, a thing that
    doesn't exist yet. A child could be walked through this.</p>

    <div class="notice">
      <h2>Before you start — the one thing you need</h2>
      <ol>
        <li>Massai builds using <b>DeepSeek</b>, so it needs a DeepSeek key. That key is
          yours, and only you can create it.</li>
        <li>DeepSeek is <b>pay-as-you-go</b>: put in a few dollars of credit and most people
          build for weeks on what a single coffee costs.</li>
        <li>Make it on DeepSeek's own site in about a minute — we never see your card,
          and we never store your payment details.</li>
      </ol>
    </div>

    <div class="routes">
      <a class="route primary" href="${DEEPSEEK_SIGNUP}" target="_blank" rel="noopener">
        <span class="glyph">✳</span> Create a DeepSeek account <small>google · github · email</small></a>
      <a class="route" href="${DEEPSEEK_KEYS}" target="_blank" rel="noopener">
        <span class="glyph">🔑</span> Get my key <small>already signed up</small></a>
      <a class="route" href="${DEEPSEEK_TOPUP}" target="_blank" rel="noopener">
        <span class="glyph">💳</span> Add a few dollars of credit <small>a little goes a long way</small></a>
    </div>

    <div class="manual">
      <label for="apiKey">Already have a key? Paste it here</label>
      <form method="POST" action="/api/signin">
        <input id="apiKey" type="text" name="apiKey" placeholder="sk-…" autocomplete="off" required>
        <button type="submit">Sign in</button>
      </form>
    </div>

    <div class="foot">
      <p class="ask">Tell us what you're building — <a href="/feedback">we read every note</a>.</p>
      <p class="fine">By continuing you're signing in to DeepSeek; usage is billed to your
      DeepSeek account at their published rates. Massai stands on open-source shoulders —
      DeepSeek's engine first among them, with thanks. Fork it, branch it, build on it:
      that is the point.</p>
    </div>
  </div>
</div>
</body></html>`
}
