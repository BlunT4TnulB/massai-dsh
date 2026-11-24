/**
 * The projects page: what you have made, kept, and — when you choose — offered.
 *
 * Deliberately one screen with no navigation: a list, an action row per project,
 * and the shelf underneath. Everything it shows comes from the same API the agent
 * uses, so the page can never claim something the storage does not hold.
 *
 * @module @deepseek-ai/dsh-one-turn/projects-page
 */

/**
 * Render the page.
 * @returns the page HTML, with the list filled in by the browser.
 */
export function projectsPageHtml(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your projects — Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="robots" content="noindex">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 4rem;background:#0e0e10;color:#E9E9EF;
    font-family:system-ui,-apple-system,sans-serif;line-height:1.6;
    background-image:radial-gradient(60rem 40rem at 12% 0%,rgba(193,68,14,.10),transparent 70%)}
  main{max-width:50rem;margin:0 auto}
  .brand{display:flex;align-items:center;gap:.6rem}
  .brand img{width:2rem;height:2rem}
  .brand span{font-family:Georgia,serif;letter-spacing:.26em;color:#EFDCA4}
  .tag{margin:.1rem 0 1.4rem;font-size:.66rem;letter-spacing:.34em;text-transform:uppercase;color:#D9822B;font-weight:700}
  h1{font-size:1.3rem;margin:0 0 .3rem}
  h2{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:#82828b;margin:1.8rem 0 .6rem}
  p{color:#b9b9c2;font-size:.92rem;margin:.35rem 0}
  .empty{border:1px dashed #2f2f37;border-radius:.6rem;padding:1rem;color:#8a8a93;font-size:.9rem}
  .card{display:flex;gap:.9rem;align-items:flex-start;border:1px solid #2a2a31;background:#17171c;
    border-radius:.7rem;padding:.85rem 1rem;margin:.5rem 0}
  .card .main{flex:1;min-width:0}
  .name{font-weight:700;color:#F2F2F4;font-size:.98rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .meta{color:#7d7d86;font-size:.78rem;margin-top:.15rem}
  .pill{display:inline-block;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;
    padding:.12rem .5rem;border-radius:999px;background:#1f1f27;color:#a9a9b3;border:1px solid #33333c}
  .pill.active{color:#7ee2a8;border-color:#1f4030;background:#0f1d14}
  .pill.paused{color:#F0B429;border-color:#4a3a10;background:#221a08}
  .pill.adoptable{color:#9ecbff;border-color:#1d2f45;background:#0e1720}
  .pill.deleted{color:#F06868;border-color:#4a1a1a;background:#1d0f0f}
  button{font:inherit;font-size:.78rem;padding:.32rem .6rem;border-radius:.4rem;cursor:pointer;
    border:1px solid #31313a;background:#1f1f27;color:#d6d6dd}
  button.primary{background:#C1440E;border-color:#C1440E;color:#fff;font-weight:700}
  button:disabled{opacity:.45;cursor:default}
  .row{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem}
  .usage{color:#7d7d86;font-size:.8rem;margin-top:.3rem}
  a{color:#7ee2a8}
  .foot{margin-top:2.6rem;padding-top:1rem;border-top:1px solid #26262d;color:#6f6f78;font-size:.8rem}
  .preview{border:1px solid #2a2a31;border-radius:.6rem;background:#101014;padding:.8rem;margin-top:.6rem;
    max-height:22rem;overflow:auto;font-family:ui-monospace,monospace;font-size:.76rem;white-space:pre-wrap;color:#c9c9d1}
</style></head><body><main>
<div class="brand"><img src="/massai-crest.svg" alt=""><span>MASSAI</span></div>
<p class="tag">Into the Unknown</p>
<h1>Your projects</h1>
<p>Anything you build can live here, in real storage, so a redeploy cannot take it away.
Offer one to the shelf and it stops being yours alone — it becomes something the next person can adopt.</p>
<p class="usage" id="usage"></p>

<h2>Yours</h2>
<div id="mine"><p class="empty">Loading…</p></div>

<h2>The shelf</h2>
<div id="shelf"><p class="empty">Loading…</p></div>

<div id="detail"></div>

<p class="foot"><a href="/">The door</a> · <a href="/limits">Limits</a> · <a href="/me">Your id</a>
· <a href="/support">Support</a> · <a href="/settings">How much help</a> · <a href="/privacy">Privacy</a></p>

<script>
(() => {
  const el = (id) => document.getElementById(id)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const kib = (bytes) => bytes < 1024 ? bytes + ' B' : Math.round(bytes / 1024) + ' KB'
  const when = (at) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const card = (p, actions) => {
    const div = document.createElement('div')
    div.className = 'card'
    div.innerHTML = '<div class="main"><div class="name">' + esc(p.name) + '</div>'
      + '<div class="meta"><span class="pill ' + esc(p.status) + '">' + esc(p.status) + '</span> '
      + esc(p.shape) + ' · ' + p.files + ' file' + (p.files === 1 ? '' : 's') + ' · ' + kib(p.bytes)
      + ' · ' + when(p.updatedAt) + '</div>'
      + '<div class="row">' + actions + '</div></div>'
    return div
  }

  const act = async (path, body) => {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return r.ok
  }

  const showDetail = async (id) => {
    const r = await fetch('/api/projects/detail?id=' + encodeURIComponent(id))
    const box = el('detail')
    if (!r.ok) { box.innerHTML = '<p class="empty">That project is not readable from here.</p>'; return }
    const data = await r.json()
    const files = data.project.contents.map((f) => '── ' + f.path + ' ──\\n' + f.content.slice(0, 2000)).join('\\n\\n')
    box.innerHTML = '<h2>Preview · ' + esc(data.project.name) + '</h2><div class="preview">' + esc(files) + '</div>'
  }

  const load = async () => {
    const mine = await (await fetch('/api/projects/list')).json()
    el('usage').textContent = mine.usage && mine.usage.projects > 0
      ? mine.usage.projects + ' project' + (mine.usage.projects === 1 ? '' : 's') + ' · ' + kib(mine.usage.bytes) + ' stored'
      : 'No projects yet — build something and it can live here.'

    const mineBox = el('mine')
    mineBox.innerHTML = ''
    if (!mine.projects || mine.projects.length === 0) {
      mineBox.innerHTML = '<p class="empty">Nothing saved yet. Ask for something in the workshop, then save it here.</p>'
    } else {
      mine.projects.forEach((p) => {
        const buttons = '<button data-open="' + esc(p.id) + '">Open</button>'
          + (p.status === 'active' ? '<button data-set="paused" data-id="' + esc(p.id) + '">Pause</button>' : '')
          + (p.status !== 'adoptable' ? '<button data-set="adoptable" data-id="' + esc(p.id) + '">Offer to shelf</button>' : '')
          + '<button data-set="deleted" data-id="' + esc(p.id) + '">Delete</button>'
        mineBox.append(card(p, buttons))
      })
    }

    const shelfData = await (await fetch('/api/projects/shelf')).json()
    const shelfBox = el('shelf')
    shelfBox.innerHTML = ''
    if (!shelfData.projects || shelfData.projects.length === 0) {
      shelfBox.innerHTML = '<p class="empty">The shelf is empty. When someone offers a project, it appears here for others to adopt.</p>'
    } else {
      shelfData.projects.forEach((p) => {
        shelfBox.append(card(p, '<button class="primary" data-adopt="' + esc(p.id) + '">Adopt this</button>'
          + '<button data-open="' + esc(p.id) + '">Look inside</button>'))
      })
    }

    document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => showDetail(b.dataset.open)))
    document.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true
      const ok = await act('/api/projects/status', { id: b.dataset.id, status: b.dataset.set })
      if (!ok) b.textContent = 'failed'
      await load()
    }))
    document.querySelectorAll('[data-adopt]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true
      const ok = await act('/api/projects/adopt', { id: b.dataset.adopt })
      b.textContent = ok ? 'adopted' : 'not available'
      await load()
    }))
  }

  load().catch(() => { el('mine').innerHTML = '<p class="empty">Could not load your projects.</p>' })
})()
</script>
</main></body></html>`
}
