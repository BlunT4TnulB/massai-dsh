/**
 * Look-and-feel harness for the sign-in card. It renders the exact Clerk
 * layout (social buttons, divider, email field, primary action, footer) using
 * our theme tokens, so the visual can be approved and iterated BEFORE Clerk is
 * wired — and so the Clerk `appearance` variables have a reference to match.
 *
 * @module @deepseek-ai/dsh-hosted-signin/login-preview
 */

/** Social providers the card offers, in display order. */
const PROVIDERS = [
  { id: 'google', label: 'Google', glyph: 'G' },
  { id: 'github', label: 'GitHub', glyph: '' },
  { id: 'apple', label: 'Apple', glyph: '' },
] as const

/**
 * Render the sign-in card preview.
 * @returns the HTML document.
 */
export function loginPreviewHtml(): string {
  const buttons = PROVIDERS.map(p => `<button class="provider" type="button">
      <span class="glyph">${p.glyph}</span><span>Continue with ${p.label}</span>
    </button>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — sign-in card preview</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:2rem 1rem;background:#0e0e10;color:#F2F2F4;font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 18% 8%,rgba(193,68,14,.16),transparent 70%),
      radial-gradient(50rem 30rem at 88% 92%,rgba(77,107,254,.10),transparent 70%)}
  /* the card = Clerk's <Card> with our appearance variables applied */
  .card{width:100%;max-width:25rem;background:#17171c;border:1px solid #2c2c33;border-radius:.9rem;
    padding:1.6rem 1.5rem 1.2rem;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .brand{display:flex;align-items:center;gap:.55rem;justify-content:center;margin-bottom:1.15rem}
  .brand svg{width:1.9rem;height:auto}
  .brand span{font-size:.95rem;font-weight:700;letter-spacing:.24em;text-transform:lowercase}
  h1{margin:0 0 .3rem;font-size:1.22rem;font-weight:700;text-align:center;color:#F2F2F4}
  .sub{margin:0 0 1.15rem;font-size:.86rem;color:#9a9aa3;text-align:center;font-weight:500;line-height:1.5}
  .providers{display:grid;gap:.5rem}
  .provider{display:flex;align-items:center;gap:.7rem;padding:.62rem .85rem;border-radius:.55rem;
    border:1px solid #31313a;background:#1f1f27;color:#EDEDF1;font-size:.9rem;font-weight:600;
    cursor:pointer;width:100%;text-align:left}
  .provider:hover{border-color:#C1440E;background:#23232c}
  .glyph{width:1.2rem;display:grid;place-items:center;font-weight:700}
  .divider{display:flex;align-items:center;gap:.7rem;margin:1.05rem 0;color:#6f6f78;font-size:.72rem;
    letter-spacing:.14em;text-transform:uppercase;font-weight:600}
  .divider::before,.divider::after{content:"";flex:1;height:1px;background:#2a2a31}
  label{display:block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#82828b;
    font-weight:600;margin:0 0 .4rem}
  input{width:100%;padding:.62rem .8rem;border-radius:.5rem;border:1px solid #3a3a44;background:#101014;
    color:#F2F2F4;font:inherit;font-size:.9rem}
  input:focus{outline:2px solid #2f6fed;outline-offset:1px;border-color:#2f6fed}
  .primary{margin-top:.85rem;width:100%;padding:.66rem;border-radius:.5rem;border:none;background:#2f6fed;
    color:#fff;font-weight:600;font-size:.92rem;cursor:pointer}
  .foot{margin-top:1.1rem;padding-top:.9rem;border-top:1px solid #26262d;text-align:center;
    font-size:.78rem;color:#6f6f78;line-height:1.6}
  .foot a{color:#7ee2a8;text-decoration:none}
  .note{margin-top:1.4rem;max-width:25rem;font-size:.72rem;color:#5f5f68;text-align:center;line-height:1.6}
  .note b{color:#8f8f97}
</style></head><body>
<div class="card">
  <div class="brand">
    <svg viewBox="0 0 120 132" aria-hidden="true">
      <ellipse cx="60" cy="10" rx="21" ry="5.6" fill="none" stroke="#C9A227" stroke-width="3"/>
      <path d="M16 100L104 22M104 100L16 22" stroke="#C1440E" stroke-width="3.2" stroke-linecap="round" opacity=".6"/>
      <path d="M60 16c24 0 35 14 35 33 0 24-17 40-28 46 4 6 8 11 8 11s-9-4-15-4-15 4-15 4 4-5 8-11c-11-6-28-22-28-46 0-19 11-33 35-33z"
        fill="#151517" stroke="#C1440E" stroke-width="4.5"/>
      <g fill="#4D6BFE" transform="translate(35 48) scale(2.6)">
        <rect x="2" y="3" width="4" height="1"/><rect x="2" y="4" width="9" height="1"/>
        <rect x="2" y="5" width="10" height="1"/><rect x="3" y="6" width="7" height="1"/>
        <rect x="11" y="3" width="1" height="1"/><rect x="12" y="2" width="1" height="2"/>
        <rect x="13" y="1" width="1" height="2"/>
      </g>
    </svg>
    <span>massai</span>
  </div>
  <h1>Welcome back</h1>
  <p class="sub">Sign in to build — your DeepSeek key stays yours.</p>
  <div class="providers">${buttons}</div>
  <div class="divider">or</div>
  <label for="email">Email address</label>
  <input id="email" type="email" placeholder="you@example.com">
  <button class="primary" type="button">Continue</button>
  <p class="foot">New here? <a href="/">Start with the guided tour →</a></p>
</div>
<p class="note">Preview only — this is the Clerk card rendered with our tokens
(<b>colorBackground #17171c · colorText #F2F2F4 · colorPrimary #C1440E</b>), before Clerk is wired.</p>
</body></html>`
}
