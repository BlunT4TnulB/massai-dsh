/**
 * The personal page: "who am I here, what have I spent, what credit do I have".
 *
 * It exists because a supporter needs to know **their own id** to put in a Ko-fi
 * note, and because a person should always be able to see what the workshop has
 * cost them without asking anyone. The id is read from the readable `dsh_uid`
 * cookie the preview sets; the numbers come from `/api/me`.
 *
 * @module @deepseek-ai/dsh-hosted-signin/me-page
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

/**
 * Render the personal page.
 * @returns the page HTML.
 */
export function mePageHtml(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>You — Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="robots" content="noindex">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 4rem;background:#0e0e10;color:#E9E9EF;
    font-family:system-ui,-apple-system,sans-serif;line-height:1.65;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.10),transparent 70%)}
  main{max-width:38rem;margin:0 auto}
  .brand{display:flex;align-items:center;gap:.6rem}
  .brand img{width:2rem;height:2rem}
  .brand span{font-family:Georgia,serif;letter-spacing:.26em;color:#EFDCA4}
  .tag{margin:.1rem 0 1.6rem;font-size:.66rem;letter-spacing:.34em;text-transform:uppercase;color:#D9822B;font-weight:700}
  h1{font-size:1.25rem;margin:0 0 .3rem}
  h2{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:#82828b;margin:1.6rem 0 .5rem}
  p{color:#b9b9c2;font-size:.92rem;margin:.35rem 0}
  .card{border:1px solid #2a2a31;background:#17171c;border-radius:.7rem;padding:1rem 1.1rem;margin:.6rem 0}
  .id{font-family:ui-monospace,monospace;font-size:.95rem;color:#EFDCA4;word-break:break-all}
  .big{font-size:1.3rem;color:#F2F2F4;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:.9rem}
  td{padding:.4rem 0;border-bottom:1px solid #1f1f26}
  td:last-child{text-align:right;color:#F2F2F4;font-weight:600}
  button{padding:.5rem .9rem;border-radius:.45rem;border:none;background:#C1440E;color:#fff;font-weight:700;cursor:pointer;font-size:.86rem}
  .hint{color:#6f6f78;font-size:.78rem;line-height:1.6}
  a{color:#7ee2a8}
  .muted{color:#7d7d86}
  .foot{margin-top:2.4rem;padding-top:1rem;border-top:1px solid #26262d;color:#6f6f78;font-size:.8rem}
</style></head><body><main>
<div class="brand"><img src="/massai-crest.svg" alt=""><span>MASSAI</span></div>
<p class="tag">Into the Unknown</p>

<h1>You, in this workshop</h1>
<p class="hint">Nothing here is secret to anyone else, and nothing else about you is kept: the id, what you
spent, and any credit you were given.</p>

<h2>Your id</h2>
<div class="card">
  <div class="id" id="uid">finding it…</div>
  <p class="hint" style="margin-top:.6rem">Put this in your message when you leave a tip — it is how a
  thank-you reaches you. <button type="button" id="copy" style="margin-left:.4rem">Copy</button></p>
</div>

<h2>This month</h2>
<div class="card">
  <table>
    <tr><td>Spent by you</td><td id="spent">—</td></tr>
    <tr><td>Calls</td><td id="calls">—</td></tr>
    <tr><td>Free allowance</td><td id="allowance">—</td></tr>
    <tr><td>Credit from tips</td><td id="credit">—</td></tr>
    <tr><td>Month</td><td id="month">—</td></tr>
  </table>
</div>

<h2>If you run out</h2>
<p>Three ways on, all equally fine: <a href="/access">add your own key</a> (free of our budget),
<a href="/support">leave a tip</a> and ask for a top-up, or <a href="/limits">read exactly what the
limits are</a>. Nothing you built is lost by hitting a cap.</p>

<p class="foot"><a href="/">The door</a> · <a href="/limits">Limits</a> · <a href="/support">Support</a>
· <a href="/privacy">Privacy</a></p>

<script>
(() => {
  const read = (name) => {
    const hit = document.cookie.split('; ').find((row) => row.startsWith(name + '='))
    return hit === undefined ? '' : decodeURIComponent(hit.slice(name.length + 1))
  }
  const uid = read('dsh_uid')
  const show = (id, text) => { const el = document.getElementById(id); if (el !== null) el.textContent = text }
  if (uid === '') {
    show('uid', 'No preview session on this browser yet')
    document.getElementById('copy').style.display = 'none'
    return
  }
  show('uid', uid)
  document.getElementById('copy').addEventListener('click', () => {
    void navigator.clipboard.writeText(uid)
    const button = document.getElementById('copy')
    const was = button.textContent
    button.textContent = 'Copied'
    setTimeout(() => { button.textContent = was }, 1400)
  })
  fetch('/api/me?userId=' + encodeURIComponent(uid))
    .then((r) => r.json())
    .then((data) => {
      show('spent', '$' + Number(data.spentUsd ?? 0).toFixed(3))
      show('calls', String(data.calls ?? 0))
      show('allowance', '$' + Number(data.allowanceUsd ?? 0).toFixed(2))
      show('credit', '$' + Number(data.creditUsd ?? 0).toFixed(2))
      show('month', String(data.month ?? '—'))
    })
    .catch(() => { show('spent', 'unavailable right now') })
})()
</script>
</main></body></html>`
}

/** Keep the escaper referenced for future edits. */
void esc
