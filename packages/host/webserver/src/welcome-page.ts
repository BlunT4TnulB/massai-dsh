import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

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
        <defs><filter id="doorGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter></defs>
        <g filter="url(#doorGlow)" opacity=".75" stroke="#FFF0A8"><circle cx="256" cy="256" r="238" fill="none" stroke-width="16"/><circle cx="256" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="308" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="282" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="230" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="204" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="230" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="282" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="334" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="256" cy="346" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="178" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="178" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="256" cy="166" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="334" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="360" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="308" cy="346" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="204" cy="346" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="152" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="204" cy="166" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="308" cy="166" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/></g>
        <circle cx="256" cy="256" r="238" fill="none" stroke="#FFD466" stroke-width="14"/>
        <circle cx="256" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="308" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="282" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="230" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="204" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="230" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="282" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="334" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="256" cy="346" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="178" cy="301" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="178" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="256" cy="166" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="334" cy="211" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="360" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="308" cy="346" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="204" cy="346" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="152" cy="256" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="204" cy="166" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/><circle cx="308" cy="166" r="52" fill="none" stroke="#FFD466" stroke-width="2.6"/>
      </svg>`

/** Shared page styling: one window, two rooms. */
const SHELL_CSS = `
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.75rem 1rem;
    background:#0e0e10;color:#F2F2F4;font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 18% 8%,rgba(193,68,14,.16),transparent 70%),
      radial-gradient(50rem 30rem at 88% 92%,rgba(77,107,254,.10),transparent 70%)}
  .galaxy{position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:0;pointer-events:none;background:#08080a}
  .scrim{position:fixed;inset:0;z-index:1;pointer-events:none;
    background:radial-gradient(ellipse at 50% 40%,rgba(14,14,16,0) 26%,rgba(14,14,16,.78) 100%)}
  .win{position:relative;z-index:2;width:100%;max-width:33rem;border-radius:1rem;overflow:hidden;
    background:rgba(23,23,28,.82);backdrop-filter:blur(7px);
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
  .crest-sm{width:2.5rem;height:auto;flex:none}
  .word{font-family:Georgia,'Times New Roman',serif;font-size:1.16rem;font-weight:400;letter-spacing:.28em;color:#EFDCA4}
  .tagline{margin:-.1rem 0 .7rem;font-size:.68rem;letter-spacing:.34em;text-transform:uppercase;
    color:#D9822B;font-weight:700}
  h1{margin:.2rem 0 .5rem;font-size:1.85rem;line-height:1.1;font-weight:700;letter-spacing:-.015em}
  .sub{color:#9a9aa3;font-size:.94rem;line-height:1.6;font-weight:500;margin:0 0 1.3rem}
  .sub b{color:#E7E7EC;font-weight:600}
  /* the one button */
  .paused{border:1px solid #5a3a12;background:#1d1710;color:#E8D3A8;border-radius:.6rem;padding:.85rem 1rem;font-size:.92rem;line-height:1.6;margin:0 0 1rem}
  .into{display:block;text-align:center;padding:1.15rem 1rem 1rem;margin:0 0 1rem;border-radius:.9rem;
    background:radial-gradient(120% 180% at 50% 0%,#3a1c06,#14100c 62%);border:1px solid #7a3d12;
    text-decoration:none;box-shadow:0 0 60px rgba(217,130,43,.18), inset 0 0 40px rgba(217,130,43,.06)}
  .into:hover{border-color:#C1440E;box-shadow:0 0 90px rgba(217,130,43,.28), inset 0 0 50px rgba(217,130,43,.10)}
  .into-title{display:block;font-size:1.22rem;font-weight:700;letter-spacing:.06em;color:#FFF3E2}
  .into-note{display:block;margin-top:.4rem;font-size:.74rem;letter-spacing:.16em;
    text-transform:uppercase;color:#b98f5f}
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

/**
 * The deployment's public origin, for absolute URLs in social cards.
 *
 * The card image has to be absolute, and the deployment now answers on more than
 * one hostname (the platform URL and the real domain). `PUBLIC_ORIGIN` names the
 * one worth advertising; without it, the platform URL is assumed.
 */
function publicOrigin(): string {
  const configured = (process.env.PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '')
  return configured === '' ? 'https://massai-dsh.onrender.com' : configured
}

/**
 * Read the fuel gauge the hosted layer publishes for the door.
 *
 * The door renders synchronously and lives in this package, which cannot import
 * the hosting layer — so the number arrives as a small file. A missing or stale
 * file is not an error: it means "unknown", and unknown shows the normal door.
 */
function fuelGauge(): { available: boolean; usd: number } | undefined {
  try {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    const path = join(home, 'health', 'deepseek-balance.json')
    if (!existsSync(path)) return undefined
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { available?: boolean; usd?: number; at?: number }
    // Older than 30 minutes is a guess, not a reading.
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > 30 * 60 * 1000) return undefined
    return { available: parsed.available === true, usd: Number(parsed.usd ?? 0) }
  } catch {
    return undefined
  }
}

/**
 * Read the comfort choice from a raw cookie header.
 *
 * Duplicated from the hosting layer on purpose: the door renders synchronously in
 * this package, and importing the hosting layer would drag its whole module graph
 * in for the sake of six booleans.
 * @param cookieHeader - the request's Cookie header.
 * @returns which extras to render.
 */
function comfortOf(cookieHeader: string): {
  disclaimers: boolean; tips: boolean; legal: boolean; examples: boolean; hints: boolean; badges: boolean
} {
  const all = { disclaimers: true, tips: true, legal: true, examples: true, hints: true, badges: true }
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key !== 'dsh_comfort') continue
    const raw = decodeURIComponent(rest.join('='))
    if (raw === 'master') return { disclaimers: false, tips: false, legal: false, examples: false, hints: false, badges: false }
    if (raw === 'practised') return { ...all, tips: false, examples: false, badges: false }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return {
        disclaimers: parsed['disclaimers'] !== false,
        tips: parsed['tips'] !== false,
        legal: parsed['legal'] !== false,
        examples: parsed['examples'] !== false,
        hints: parsed['hints'] !== false,
        badges: parsed['badges'] !== false,
      }
    } catch {
      return all
    }
  }
  return all
}

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
<meta property="og:image" content="${publicOrigin()}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${publicOrigin()}/og-image.png">
<meta name="description" content="${description}">
<style>${SHELL_CSS}</style></head><body>
<iframe class="galaxy" src="/flower?embed=1" title="The Massai galaxy" loading="eager" tabindex="-1" aria-hidden="true"></iframe>
<span class="scrim" aria-hidden="true"></span>
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

/**
 * The black page: one orb, one label, one decision.
 *
 * This is what a person meets at the root before they belong anywhere: nothing
 * but the mind, in a circle, with its name under it. The orb is a live frame of
 * the galaxy, so the button and the thing it opens are the same object. The whole
 * circle is the link; a hidden skip keeps the page usable without a pointer.
 * @returns the full HTML document.
 */
export function intoTheUnknownPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Into the Unknown — Massai</title>
<meta name="theme-color" content="#000000">
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<style>
  html,body{margin:0;height:100%;background:#000;color:#F2F2F4;overflow:hidden;
    font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent}
  .stage{height:100%;display:grid;place-items:center;padding:1.5rem}
  .orb-link{display:flex;flex-direction:column;align-items:center;gap:1.05rem;text-decoration:none}
  .orb{position:relative;width:min(68vw,320px);aspect-ratio:1;border-radius:50%;overflow:hidden;
    background:#000;box-shadow:0 0 90px rgba(217,130,43,.20),inset 0 0 50px rgba(0,0,0,.5);
    border:1px solid rgba(247,205,140,.16);transition:box-shadow .4s ease,border-color .4s ease}
  .orb iframe{width:100%;height:100%;border:0;pointer-events:none;background:#000}
  .spin{position:absolute;inset:0;border-radius:50%;cursor:grab;touch-action:none}
  .slogan{margin:.1rem 0 .2rem;font-size:.72rem;letter-spacing:.1em;color:#b98f5f;
    text-align:center;max-width:20rem;opacity:.9;transition:opacity .9s ease;min-height:1.2em}
  .poem{margin:.2rem 0 0;font-size:.72rem;line-height:1.75;color:#8a7a63;
    letter-spacing:.06em;text-align:center;font-style:italic;max-width:19rem;
    opacity:1;transition:opacity 1.1s ease;min-height:9.8em}
  .enter{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#5f5850;
    text-decoration:none;border-bottom:1px solid #2b2620}
  .enter:hover{color:#b98f5f;border-color:#5a4a2e}
  .orb-link:hover .orb{
    box-shadow:0 0 140px rgba(217,130,43,.30),inset 0 0 60px rgba(0,0,0,.4);border-color:rgba(247,205,140,.42)}
  .label{font-size:.92rem;letter-spacing:.34em;text-transform:uppercase;color:#F3E6CE;
    animation:breathe 5.5s ease-in-out infinite}
  .sub{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#6b6257;margin-top:-.6rem}
  .what{margin-top:.1rem;font-size:.72rem;color:#8a7c62;letter-spacing:.04em}
  @keyframes breathe{0%,100%{opacity:.86}50%{opacity:1}}
  @media (prefers-reduced-motion:reduce){.label{animation:none}}
  .skip{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  /* One button in the corner; every avenue behind it. */
  .menu-btn{position:fixed;top:14px;left:14px;z-index:5;width:40px;height:40px;border-radius:50%;
    border:1px solid rgba(247,205,140,.22);background:rgba(10,10,12,.7);color:#E9C98E;
    display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(6px);font-size:16px}
  .menu-btn:hover{border-color:rgba(247,205,140,.6)}
  .drawer{position:fixed;inset:0 auto 0 0;width:min(18rem,82vw);z-index:6;
    background:rgba(8,8,10,.97);border-right:1px solid rgba(247,205,140,.16);
    padding:1.5rem 1rem;display:none;flex-direction:column;gap:2px}
  .drawer[data-open='true']{display:flex}
  .drawer h2{margin:0 0 1rem .6rem;font-size:.62rem;letter-spacing:.3em;text-transform:uppercase;color:#8a7c62}
  .drawer a{display:block;padding:.62rem .6rem;border-radius:.5rem;color:#E7E2D6;
    text-decoration:none;font-size:.94rem}
  .drawer a:hover{background:rgba(247,205,140,.09);color:#FFF3E2}
  .drawer .group{margin:.7rem 0 .2rem .6rem;font-size:.56rem;letter-spacing:.26em;
    text-transform:uppercase;color:#6f6555}
  .drawer .group:first-of-type{margin-top:.2rem}
  .drawer-close{position:absolute;top:12px;right:12px;background:none;border:0;color:#8a7c62;
    font-size:18px;cursor:pointer}
</style></head><body>
<button class="menu-btn" id="menuBtn" aria-label="Open the menu" aria-expanded="false">☰</button>
<nav class="drawer" id="drawer" aria-label="Everything">
  <button class="drawer-close" id="drawerClose" aria-label="Close the menu">×</button>
  <h2>Massai</h2>
  <p class="group">Wander</p>
  <a href="/flower">The mind</a>
  <a href="/map">Map</a>
  <a href="/library">Library</a>
  <p class="group">Make</p>
  <a href="/access">The workshop</a>
  <a href="/projects">Projects</a>
  <p class="group">Understand</p>
  <a href="/guide">Guide</a>
  <a href="/limits">Limits</a>
  <a href="/support">Support</a>
</nav>
<script>
  (function () {
    var btn = document.getElementById('menuBtn');
    var drawer = document.getElementById('drawer');
    var close = document.getElementById('drawerClose');
    function set(open) {
      drawer.setAttribute('data-open', open ? 'true' : 'false');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { set(drawer.getAttribute('data-open') !== 'true'); });
    close.addEventListener('click', function () { set(false); });
    addEventListener('keydown', function (event) { if (event.key === 'Escape') set(false); });
  })();
</script>
<div class="stage">
  <div class="orb-link">
    <span class="orb">
      <iframe id="orbFrame" src="/flower?embed=1&spin=1&fit=orb&quiet=1" title="The Massai galaxy" loading="eager" tabindex="-1" scrolling="no"></iframe>
      <span class="spin" id="spinPad" role="button" tabindex="0"
            aria-label="The mind. Turn it freely. Knock twice, or open your hand, to enter."></span>
    </span>
    <span class="label">Into the Unknown</span>
    <p class="poem" id="poem">Two quick taps upon the light,<br>
      or spread your fingers wide in flight.<br>
      Knock upon the swirling glass<br>
      to wake the stars and let you pass.<br>
      Stretch the tunnel, deep and grand —<br>
      an endless, living, thinking land.<br>
      Follow where the bright threads wind,<br>
      and step inside the Massai mind.</p>
    <p class="slogan" id="slogan">Speak the future you want to live in, then build it together.</p>
    <a class="enter" href="/flower">or go straight in →</a>
  </div>
</div>
<script>
  (function () {
    var pad = document.getElementById('spinPad');
    var frame = document.getElementById('orbFrame');
    var pointers = new Map();
    var lx = 0;
    var ly = 0;
    var knocks = 0;
    var knockTimer = 0;
    var pinchStart = 0;
    var pinched = false;

    /** Hand a movement to the mind inside the frame. */
    function spin(dx, dy) {
      try { frame.contentWindow.postMessage({ type: 'massai:spin', dx: dx, dy: dy }, '*'); } catch (e) { /* nothing */ }
    }

    /** Let them in. */
    function open() {
      location.href = '/flower';
    }

    /** Distance between the two fingers currently down. */
    function spread() {
      var two = [...pointers.values()];
      if (two.length < 2) return 0;
      return Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
    }

    pad.addEventListener('pointerdown', function (event) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pad.setPointerCapture(event.pointerId);
      if (pointers.size === 1) {
        lx = event.clientX;
        ly = event.clientY;
        pad.style.cursor = 'grabbing';
      } else if (pointers.size === 2) {
        pinchStart = spread();
        pinched = false;
      }
    });

    pad.addEventListener('pointermove', function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        // An opening hand: starting closed and widening is how you look further in.
        var now = spread();
        if (pinchStart > 0 && now > pinchStart * 1.55 && now - pinchStart > 36) {
          pinched = true;
          open();
        }
        return;
      }
      spin(event.clientX - lx, event.clientY - ly);
      lx = event.clientX;
      ly = event.clientY;
    });

    pad.addEventListener('pointerup', function (event) {
      pointers.delete(event.pointerId);
      pad.style.cursor = 'grab';
      if (pointers.size > 0) return;
      if (pinched) { pinched = false; return; }
      if (pinchStart > 0) { pinchStart = 0; return; }
      // Two knocks, and only two: turning it can never open it by accident.
      knocks += 1;
      clearTimeout(knockTimer);
      if (knocks >= 2) {
        knocks = 0;
        open();
        return;
      }
      knockTimer = setTimeout(function () { knocks = 0; }, 340);
    });

    pad.addEventListener('pointercancel', function (event) {
      pointers.delete(event.pointerId);
      pinchStart = 0;
    });

    pad.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') open();
    });

    // The doorway says a different true thing each visit, and changes its mind every
    // few seconds, so the page never settles into a slogan.
    var SLOGANS = ['Speak the future you want to live in, then build it together.', 'Name what must stand, and let the community raise it.', 'A true word lays the foundation; shared hands raise the wall.', 'Say it plainly, as though it already stands.', 'What is spoken here is made here.', 'Name the thing, and the workshop begins.', 'Say what should exist — it gets built.', 'The door is the word; the walls follow.', 'An empty yard becomes a home the moment it is named.', 'Words are the first material. Everything else arrives after.'];
    var sloganEl = document.getElementById('slogan');
    if (sloganEl !== null) {
      var order = [];
      var index = Math.floor(Math.random() * SLOGANS.length);
      function nextSlogan() {
        index = (index + 1 + Math.floor(Math.random() * (SLOGANS.length - 1))) % SLOGANS.length;
        sloganEl.style.opacity = '0';
        setTimeout(function () {
          sloganEl.textContent = SLOGANS[index];
          sloganEl.style.opacity = '.9';
        }, 900);
      }
      sloganEl.textContent = SLOGANS[index];
      setInterval(nextSlogan, 8000);
      void order;
    }

    // Five riddles, changing places. The splash is the first thing anyone reads, so it
    // should not be the same eight lines every time.
    var POEMS = [['Two quick taps upon the light,', 'or spread your fingers wide in flight.', 'Knock upon the swirling glass', 'to wake the stars and let you pass.', 'Stretch the tunnel, deep and grand —', 'an endless, living, thinking land.', 'Follow where the bright threads wind,', 'and step inside the Massai mind.'], ['The dark is deep, the lattice wide,', 'with no clear wall and no far side.', 'Put two soft knocks upon the glow —', 'the stars will lean and let you go.', 'Or close your hand and open it:', 'the tunnel takes the shape of it.', 'Then follow down the brightening line,', 'and what was yours is also mine.'], ['A sphere of threads, a hush of light,', 'a door that keeps itself from sight.', 'Tap twice — the quiet answers back.', 'Spread your fingers — part the black.', 'No key, no word, no counted stair:', 'only the will to look in there.', 'The pattern turns; you turn it too,', 'and step into the waking view.'], ['Count the stars that cross the seam,', 'then knock twice on the turning gleam.', 'Stretch the weave with patient hands —', 'a door is only where it stands.', 'Beyond the glass the workshop hums,', 'and every thread to something comes.', 'Enter slow, and enter whole:', 'the mind is not a place, but a goal.'], ['What holds the centre holds the whole;', 'the light is bright, the dark is shoal.', 'Knock, and knock again, and wait —', 'the mind forgets to be a gate.', 'Push your palms through woven air,', 'and find the work already there.', 'One turn more and you are through:', 'the sphere was never closed to you.'], ['Tap the ember twice to wake,', 'or spread your hands like wings at break.', 'Knock upon the woven shield', 'until the hidden stars are peeled.', 'Stretch the horizon, wide and deep —', 'a living land that does not sleep.', 'Follow where the red threads wind,', 'and step inside the Massai mind.'], ['Tap twice to spark the glowing space,', 'or spread your fingers wide in grace.', 'Knock on the glass to wake the night,', 'and pull the tunnel into sight.', 'Follow where the bright threads wind —', 'welcome to the Massai mind.'], ['Two soft beats upon the gleam,', 'or open hands to part the seam.', 'Knock against the spinning sky', 'to bid the quiet gates reply.', 'Draw the pathway, vast and grand,', 'into a breathing, thinking land.', 'Trace the lines where stories wind,', 'and enter now the Massai mind.']];
    var poemEl = document.getElementById('poem');
    if (poemEl !== null) {
      var poemIndex = Math.floor(Math.random() * POEMS.length);
      function nextPoem() {
        poemIndex = (poemIndex + 1) % POEMS.length;
        poemEl.style.opacity = '0';
        setTimeout(function () {
          poemEl.innerHTML = POEMS[poemIndex].join('<br>');
          poemEl.style.opacity = '1';
        }, 1100);
      }
      poemEl.innerHTML = POEMS[poemIndex].join('<br>');
      setInterval(nextPoem, 14000);
    }
  })();
</script>
<a class="skip" href="/access">skip to the workshop</a>
</body></html>`
}

export function welcomePage(line?: number, cookieHeader = ''): string {
  const comfort = comfortOf(cookieHeader)
  // A deployment that carries its own key can let visitors start immediately;
  // without one, the honest first button is "get a key".
  const fuel = fuelGauge()
  const tankEmpty = fuel !== undefined && (!fuel.available || fuel.usd <= 0)
  const previewEnabled = (process.env.DEEPSEEK_API_KEY ?? '') !== ''
  const headline = headlineOf(line)
  return shell('Massai — into the unknown', 'Point at what you want and it gets built. Start free.', `
    <div class="brandline">${CREST}<span class="word">Massai</span></div>
    <p class="tagline">Into the Unknown</p>
    <h1 id="door-title">${headline}</h1>
    <p class="sub">Point at what you want — <b>a tool, a site, an app, a workflow</b> — and it gets
    built in front of you. You do not need to know anything to start.</p>

    <!-- The immersion comes before the explanation: the mind is the first thing
         you meet, and the one button that opens it says what the tagline says. -->
    <a class="into" href="/unknown">
      <span class="into-title">Into the Unknown</span>
      <span class="into-note">enter the mind — drag, roll, dive · find the one door</span>
    </a>
    <p class="quiet" style="margin:.2rem 0 1rem"><a href="/access">or skip the mind and open the workshop</a></p>

    ${tankEmpty ? `
    <p class="paused"><b>The free preview is paused.</b> The workshop's model credit has run out, so
    nothing would happen if you started now. You can still <a href="/access">bring your own key</a> and
    work right away — or <a href="/support">leave a tip</a> and come back.</p>` : previewEnabled ? `
    <a class="hero" href="/api/preview">Start free — no account needed →</a>
    <p class="heronote">A dozen messages on us. No card, no sign-up, no tutorial.
    Bring your own key when you want to keep going.</p>` : `
    <a class="hero" href="/access">Get started →</a>
    <p class="heronote">Takes about a minute. Details on the next screen.</p>`}

    ${comfort.hints ? `<p class="quiet">Already have a key, or prefer Google sign-in?
      <a href="/access">Open the workshop</a></p>` : '<p class="quiet"><a href="/access">Open the workshop</a></p>'}

    ${comfort.tips || comfort.disclaimers || comfort.legal ? `<div class="foot">
      ${comfort.tips ? '<p class="ask" style="margin-bottom:.45rem">First time? <a href="/guide">Two-minute guide</a> · <a href="/limits">Every limit, before you start</a></p>' : ''}
      ${comfort.disclaimers ? `<p class="fine">Everything here is written by an AI and can be wrong — read it before you ship it.
      Massai is an independent project, not affiliated with any model provider.</p>` : ''}
      ${comfort.legal ? `<p class="fine" style="margin-top:.35rem"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Tip jar</a> · <a href="/flower">The flower</a> · <a href="/map">The map</a> · <a href="/settings">Help level</a></p>` : ''}
    </div>` : ''}`)
}

/**
 * Render the access room: keys, accounts and billing, kept off the front door.
 * @param line - test override for the headline.
 * @returns the complete HTML document.
 */
export function accessPageHtml(line?: number, cookieHeader = ''): string {
  const comfort = comfortOf(cookieHeader)
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? ''
  const clerkReady = publishableKey !== '' && (process.env.CLERK_SECRET_KEY ?? '') !== ''
  const fuel = fuelGauge()
  const tankEmpty = fuel !== undefined && (!fuel.available || fuel.usd <= 0)
  const previewEnabled = (process.env.DEEPSEEK_API_KEY ?? '') !== ''
  const headline = headlineOf(line)
  return shell('Massai — get in', 'How to get into Massai: try it free, sign in, or bring a key.', `
    <a class="back" href="/">← back</a>
    <div class="brandline">${CREST}<span class="word">Massai</span></div>
    <h1 id="door-title">${headline}</h1>
    <p class="sub">Three ways in. Start free, sign in with an account, or bring your own
    DeepSeek key — whatever suits you.</p>

    ${tankEmpty ? '<p class="paused" style="text-align:left"><b>The free preview is paused</b> — the model credit has run out. Bring your own key below and keep working.</p>' : previewEnabled ? `<a class="hero" href="/api/preview" style="margin-bottom:1.1rem">Start free — no account needed →</a>` : ''}

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
      ${comfort.tips ? `<p class="ask">Prefer an AI that runs on your own machine? <a href="/local">That is free forever →</a></p>
      <p class="fine">Costs and capabilities of every backend:
      <a href="/providers">the providers page</a>. Nothing here is required if you started free.</p>` : ''}
      <p class="ask" style="margin-bottom:.5rem"><a href="/limits" style="color:#8a8a93;font-size:.82rem">Every limit and requirement, before you start →</a></p>
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
