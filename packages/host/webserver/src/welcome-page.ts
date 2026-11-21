/**
 * The door, and the room behind it.
 *
 * `welcomePage` is the front door: one promise, one button, no decisions. A
 * deployment that carries its own key lets a visitor start building immediately;
 * everything about keys, accounts and billing lives on `accessPageHtml` behind a
 * quiet link, so the first screen stays clean.
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

/** The crest, small enough to sit beside the wordmark. */
const CREST = `<svg class="crest-sm" viewBox="0 0 512 512" aria-hidden="true">
        <circle cx="256" cy="196" r="150" fill="none" stroke="#C9A227" stroke-width="14" opacity=".9"/>
        <path d="M256 96 L412 146 C412 300 356 386 256 436 C156 386 100 300 100 146 Z"
          fill="#1b1b22" stroke="#C1440E" stroke-width="16" stroke-linejoin="round"/>
        <path d="M186 168 L256 300 L326 168 L306 168 L256 262 L206 168 Z" fill="#B9B9C2"/>
        <path d="M256 392 C 236 344 210 314 158 286 C 190 344 222 372 252 382 Z" fill="#4D6BFE"/>
        <path d="M256 392 C 276 344 302 314 354 286 C 322 344 290 372 260 382 Z" fill="#4D6BFE"/>
      </svg>`

/** Shared page styling: one window, two rooms. */
const SHELL_CSS = `
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.75rem 1rem;
    background:#0e0e10;color:#F2F2F4;font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 18% 8%,rgba(193,68,14,.16),transparent 70%),
      radial-gradient(50rem 30rem at 88% 92%,rgba(77,107,254,.10),transparent 70%)}
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
  .brandline{display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem}
  .crest-sm{width:2.05rem;height:auto;flex:none}
  .word{font-size:1.1rem;font-weight:700;letter-spacing:.22em}
  h1{margin:.2rem 0 .5rem;font-size:1.85rem;line-height:1.1;font-weight:700;letter-spacing:-.015em}
  .sub{color:#9a9aa3;font-size:.94rem;line-height:1.6;font-weight:500;margin:0 0 1.3rem}
  .sub b{color:#E7E7EC;font-weight:600}
  /* the one button */
  .hero{display:block;text-align:center;padding:.85rem 1rem;border-radius:.6rem;background:#C1440E;
    color:#fff;font-weight:700;font-size:1.02rem;text-decoration:none;letter-spacing:.01em}
  .hero:hover{background:#d4531a}
  .heronote{margin:.5rem 0 0;text-align:center;color:#7d7d86;font-size:.75rem;line-height:1.5}
  .quiet{margin:1.15rem 0 0;text-align:center;font-size:.82rem;color:#82828b}
  .quiet a{color:#c9c9d2;text-decoration:none;border-bottom:1px solid #3a3a44}
  .quiet a:hover{color:#F2F2F4;border-bottom-color:#C1440E}
  .notice{border:1px solid #2f2f37;border-radius:.7rem;background:#1c1c23;padding:.95rem 1rem;margin:0 0 1.1rem}
  .notice h2{margin:0 0 .55rem;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#D9822B;font-weight:700}
  .notice ol{margin:0;padding-left:1.15rem;color:#b9b9c2;font-size:.87rem;line-height:1.6;font-weight:500}
  .notice ol li{margin:.2rem 0}
  .notice b{color:#F2F2F4;font-weight:600}
  .notice a{color:#7ee2a8;text-decoration:none;border-bottom:1px solid #2f6b4c}
  .routes{display:grid;gap:.5rem;margin-bottom:.9rem}
  a.route{display:flex;align-items:center;gap:.7rem;padding:.68rem .85rem;border-radius:.55rem;
    border:1px solid #31313a;background:#1f1f27;text-decoration:none;color:#EDEDF1;font-weight:600;font-size:.92rem}
  a.route:hover{border-color:#C1440E;background:#23232c}
  a.route .glyph{width:1.25rem;height:1.25rem;display:grid;place-items:center;font-size:.95rem}
  a.route small{margin-left:auto;color:#82828b;font-weight:600;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}
  a.route.primary{background:#0f5d3a;border-color:#17724a}
  a.route.primary:hover{background:#127148}
  a.route.primary small{color:#a9e7c4}
  .social{margin:.2rem 0 .9rem}
  .socialhead{text-align:center;font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;
    color:#82828b;font-weight:600;margin-bottom:.55rem}
  .socialrow{display:flex;gap:.5rem;flex-wrap:wrap}
  .socialbtn{flex:1;min-width:6rem;padding:.58rem .5rem;border-radius:.5rem;border:1px solid #31313a;
    background:#1f1f27;color:#EDEDF1;font-weight:600;font-size:.86rem;cursor:pointer}
  .socialbtn:hover{border-color:#C1440E;background:#23232c}
  .socialnote{margin-top:.5rem;text-align:center;color:#6f6f78;font-size:.72rem}
  .manual{border-top:1px solid #26262d;padding-top:.9rem;margin-top:.2rem}
  .manual label{display:block;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#82828b;font-weight:600;margin-bottom:.45rem}
  form{display:flex;gap:.5rem;flex-wrap:wrap}
  input[type=text]{flex:1;min-width:13rem;padding:.62rem .8rem;border-radius:.5rem;border:1px solid #3a3a44;
    background:#101014;color:#F2F2F4;font-size:.92rem}
  input[type=text]:focus{outline:2px solid #2f6fed;outline-offset:1px;border-color:#2f6fed}
  button{padding:.62rem 1.1rem;border-radius:.5rem;border:none;background:#2f6fed;color:#fff;
    font-weight:600;font-size:.92rem;cursor:pointer}
  .foot{margin-top:1.15rem;padding-top:.9rem;border-top:1px solid #26262d}
  .ask{margin:0 0 .5rem;font-size:.86rem;color:#c9c9d2;font-weight:500}
  .ask a{color:#7ee2a8;text-decoration:none;border-bottom:1px solid #2f6b4c}
  .fine{margin:0;color:#6f6f78;font-size:.72rem;line-height:1.6;font-weight:500}
  .fine a{color:#8a8a93}
  .back{display:inline-block;margin-bottom:.8rem;color:#8a8a93;font-size:.78rem;text-decoration:none}
  .back:hover{color:#F2F2F4}
`

/** The document shell both pages share. */
function shell(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Massai">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="https://massai-dsh.onrender.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="https://massai-dsh.onrender.com/og-image.png">
<meta name="description" content="${description}">
<style>${SHELL_CSS}</style></head><body>
<div class="win" role="dialog" aria-labelledby="door-title">
  <div class="bar">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    <span class="spacer"></span>
    <span class="flag">open by default</span>
  </div>
  <div class="card">
${body}
  </div>
</div>
</body></html>`
}

/** Pick the headline for this render. */
function headlineOf(line?: number): string {
  const index = line === undefined
    ? Math.floor(Math.random() * LINE_COUNT)
    : ((line % LINE_COUNT) + LINE_COUNT) % LINE_COUNT
  return HEADLINES[index] ?? HEADLINES[0]
}

/**
 * Render the front door: one promise, one button.
 * @param line - test override (wraps into range); omitted picks a fresh line per load.
 * @returns the complete HTML document.
 */
export function welcomePage(line?: number): string {
  // A deployment that carries its own key can let visitors start immediately;
  // without one, the honest first button is "get a key".
  const previewEnabled = (process.env.DEEPSEEK_API_KEY ?? '') !== ''
  const headline = headlineOf(line)
  return shell('Massai — into the unknown', 'Point at what you want and it gets built. Start free.', `
    <div class="brandline">${CREST}<span class="word">Massai</span></div>
    <h1 id="door-title">${headline}</h1>
    <p class="sub">Point at what you want — <b>a tool, a site, an app, a workflow</b> — and it gets
    built in front of you. You do not need to know anything to start.</p>

    ${previewEnabled ? `
    <a class="hero" href="/api/preview">Start free — no account needed →</a>
    <p class="heronote">A dozen messages on us. No card, no sign-up, no tutorial.
    Bring your own key when you want to keep going.</p>` : `
    <a class="hero" href="/access">Get started →</a>
    <p class="heronote">Takes about a minute. Details on the next screen.</p>`}

    <p class="quiet">Already have a key, or prefer Google sign-in?
      <a href="/access">Open the workshop</a></p>

    <div class="foot">
      <p class="ask">Tell us what you're building — <a href="/feedback">we read every note</a>.</p>
      <p class="ask" style="margin-bottom:.5rem">
        <a href="/guide" style="color:#7ee2a8">First time? Read the two-minute guide →</a><br>
        <a href="/local" style="color:#8a8a93;font-size:.78rem">Run the brain on your own machine (free) →</a><br>
        <a href="/providers" style="color:#8a8a93;font-size:.78rem">Which AI answers, and what each one costs →</a></p>
      <p class="fine"><b>Massai is the workshop. DeepSeek is the engine inside it</b> — you bring
      the key, they bill the usage at their published rates, and we never see your card.
      Fork it, branch it, build on it: that is the point.</p>
    </div>`)
}

/**
 * Render the access room: keys, accounts and billing, kept off the front door.
 * @param line - test override for the headline.
 * @returns the complete HTML document.
 */
export function accessPageHtml(line?: number): string {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? ''
  const clerkReady = publishableKey !== '' && (process.env.CLERK_SECRET_KEY ?? '') !== ''
  const previewEnabled = (process.env.DEEPSEEK_API_KEY ?? '') !== ''
  const headline = headlineOf(line)
  return shell('Massai — get in', 'How to get into Massai: try it free, sign in, or bring a key.', `
    <a class="back" href="/">← back</a>
    <div class="brandline">${CREST}<span class="word">Massai</span></div>
    <h1 id="door-title">${headline}</h1>
    <p class="sub">Three ways in. Start free, sign in with an account, or bring your own
    DeepSeek key — whatever suits you.</p>

    ${previewEnabled ? `<a class="hero" href="/api/preview" style="margin-bottom:1.1rem">Start free — no account needed →</a>` : ''}

    <div class="notice">
      <h2>If you bring your own key</h2>
      <ol>
        <li>Massai builds using <b>DeepSeek</b>. The key is yours, and only you can create it.</li>
        <li>DeepSeek is <b>pay-as-you-go</b>: a few dollars of credit and most people build for
          weeks on what one coffee costs.</li>
        <li>Make it on DeepSeek's own site in about a minute — we never see your card.</li>
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

    ${clerkReady ? `<div class="social">
      <div class="socialhead">or continue with</div>
      <div class="socialrow">
        <button class="socialbtn" type="button" data-clerk>Google</button>
        <button class="socialbtn" type="button" data-clerk>GitHub</button>
        <button class="socialbtn" type="button" data-clerk>Apple</button>
      </div>
      <div class="socialnote" id="clerk-debug" style="display:none;margin-top:.45rem;font-family:ui-monospace,monospace;font-size:.68rem;color:#7ee2a8;white-space:pre-wrap;text-align:left"></div>
      <div class="socialnote" id="clerk-note">Sign-in is handled by Clerk; your DeepSeek key stays yours.</div>
    </div>` : ''}

    <div class="foot">
      <p class="ask">Prefer an AI that runs on your own machine? <a href="/local">That is free forever →</a></p>
      <p class="fine">Costs and capabilities of every backend:
      <a href="/providers">the providers page</a>. Nothing here is required if you started free.</p>
    </div>
    ${clerkReady ? clerkScript(publishableKey) : ''}`)
}

/** The Clerk bootstrap: key from the encoded publishable key, modal sign-in. */
function clerkScript(publishableKey: string): string {
  return `<script>
(() => {
  const pk = ${JSON.stringify(publishableKey)}
  const note = document.getElementById('clerk-note')
  const debug = document.getElementById('clerk-debug')
  const step = (message) => {
    if (debug && new URLSearchParams(location.search).has('clerkdebug')) {
      debug.style.display = 'block'
      debug.textContent += message + '\n'
    }
  }
  step('key: ' + pk.slice(0, 12) + '…')
  const fail = (message) => { if (note) { note.textContent = message; note.style.color = '#f0b46a' } }
  // The publishable key encodes the instance's Frontend API host. Split on the
  // trailing "$" rather than a regex: an escape eaten by the template literal
  // once left an invalid host and the script never loaded.
  let host = ''
  try {
    const body = pk.replace(/^pk_(test|live)_/, '').replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(body + '='.repeat((4 - body.length % 4) % 4))
    host = decoded.split('$')[0].trim()
  } catch { /* fall through to the failure path */ }
  step('host: ' + host)
  if (!/^[a-z0-9.-]+[.][a-z]{2,}$/i.test(host)) { fail('Sign-in is unavailable right now — paste a key below.'); return }
  const script = document.createElement('script')
  script.src = 'https://' + host + '/npm/@clerk/clerk-js@5/dist/clerk.browser.js'
  script.async = true
  script.setAttribute('data-clerk-publishable-key', pk)
  step('loading clerk-js…')
  script.onerror = () => { step('clerk-js FAILED to load from ' + host); fail('Sign-in could not load (' + host + ') — paste a key below.') }
  script.onload = async () => {
    try {
      const clerk = window.Clerk
      step('clerk-js loaded: ' + (typeof clerk))
      await clerk.load()
      step('load ok · session: ' + (clerk.session ? 'yes' : 'no'))
      let exchanged = false
      const exchange = async () => {
        if (exchanged) return
        const token = await clerk.session?.getToken()
        if (!token) return
        const response = await fetch('/api/clerk/signin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (response.ok) { exchanged = true; location.href = '/start'; return }
        fail('Sign-in could not be completed — paste a key below.')
      }
      if (clerk.session) { step('exchanging existing session…'); await exchange(); return }
      clerk.addListener((resources) => { if (resources.session) { step('session appeared — exchanging…'); void exchange() } })
      for (const button of document.querySelectorAll('[data-clerk]')) {
        button.addEventListener('click', () => {
          try { step('openSignIn()'); clerk.openSignIn(); step('modal requested') } catch (error) { step('openSignIn threw: ' + String(error)); fail('Sign-in could not open — paste a key below.') }
        })
      }
    } catch (error) { step('load threw: ' + String(error)); fail('Sign-in could not start — paste a key below.') }
  }
  document.body.append(script)
})()
</script>`
}
