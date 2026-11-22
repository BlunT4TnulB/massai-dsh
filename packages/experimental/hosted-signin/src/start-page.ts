/**
 * The guided first step after sign-in: four big cards that each drop the
 * visitor into a conversation already half-written. No vocabulary, no setup.
 *
 * @module @deepseek-ai/dsh-hosted-signin/start-page
 */

/** One card: a label, its promise, and the deep link it opens. */
const CARDS = [
  { icon: '🌐', title: 'Make a website', note: 'A page for your thing — menu, portfolio, shop, anything.', prompt: 'Build me a website for ' },
  { icon: '🧰', title: 'Make a tool', note: 'Something that does one job well, made for you.', prompt: 'Build me a small tool that ' },
  { icon: '🔗', title: 'Connect my GitHub', note: 'Point me at a repo and I will walk you through linking it.', prompt: 'Walk me through connecting my GitHub repository — step by step, one click at a time.' },
  { icon: '📂', title: 'Open my folder', note: 'Bring in work you already have. I will show you where.', prompt: 'Walk me through opening a folder of my existing work here — step by step.' },
  { icon: '✨', title: 'Make it mine', note: 'Start from your own words — I will help fill the blanks.', prompt: 'Build me ' },
  { icon: '🚀', title: 'Just open the app', note: 'Look around first. Nothing breaks, nothing is lost.', prompt: '' },
] as const

/** The guided start page HTML. */
export function startPageHtml(): string {
  const cards = CARDS.map((card) => {
    const href = card.prompt === ''
      ? '/'
      : `/?prompt=${encodeURIComponent(card.prompt)}`
    return `<a class="card" href="${href}">
      <span class="icon">${card.icon}</span>
      <b>${card.title}</b>
      <span class="note">${card.note}</span>
    </a>`
  }).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — what would you like to make?</title>
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem 1.25rem;
    background:#151517;color:#F2F2F4;font-family:system-ui,-apple-system,sans-serif}
  .wrap{max-width:46rem;width:100%}
  .brandbar{display:flex;align-items:center;gap:.6rem;margin-bottom:1.1rem}
  .mini{width:2rem;height:auto}
  .face{width:2rem;height:2rem;flex:none}
  .minibrand{font-size:.95rem;font-weight:700;letter-spacing:.2em;color:#F2F2F4}
  h1{margin:0 0 .4rem;font-size:1.9rem;font-weight:700;letter-spacing:.01em}
  h1 b{color:#7ee2a8}
  p.lead{margin:0 0 1.6rem;color:#9a9aa2;font-size:1rem;line-height:1.55;font-weight:500}
  .grid{display:grid;gap:.85rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
  a.card{display:flex;flex-direction:column;gap:.35rem;padding:1.15rem 1.2rem;border-radius:.9rem;
    border:1px solid #2a2a30;background:#191920;text-decoration:none;color:inherit;
    transition:border-color .15s ease,background .15s ease,transform .15s ease}
  a.card:hover{border-color:#C1440E;background:#1d1d24;transform:translateY(-2px)}
  .icon{font-size:1.6rem;line-height:1}
  a.card b{font-size:1.05rem;font-weight:700;letter-spacing:.01em}
  .note{color:#8f8f97;font-size:.86rem;line-height:1.45;font-weight:500}
  .quick{margin:1.3rem 0 0;text-align:center;color:#5f5f68;font-size:.78rem;letter-spacing:.04em}
  .quick a{color:#8f8f97;text-decoration:none;border-bottom:1px solid #33333b;padding-bottom:1px}
  .quick a:hover{color:#D9822B;border-color:#C1440E}
  .foot{margin-top:1.5rem;color:#6f6f77;font-size:.8rem;text-align:center;line-height:1.6}
  .foot b{color:#8f8f97}
</style></head><body><div class="wrap">
  <div class="brandbar">
    <img class="face" src="/massai-face.svg" alt="" width="32" height="32">
    <span class="minibrand">Massai</span>
  </div>
  <h1>What would you like to <b>make?</b></h1>
  <p class="lead">Pick one and I will write the first words for you — or walk you through it, one click at a time. You don't need to know a thing. <br><span style="color:#D9822B;font-weight:600">Massai is a workbench, not a vault right now (<a href="/limits" style="color:#7ee2a8">see every limit</a>) — copy out anything you need to keep.</span></p>
  <div class="grid">${cards}</div>
  <p class="quick">In a hurry?
    <a href="/?prompt=${encodeURIComponent('Build me a website for ')}">website</a> ·
    <a href="/?prompt=${encodeURIComponent('Build me a small tool that ')}">tool</a> ·
    <a href="/?prompt=${encodeURIComponent('Walk me through connecting my GitHub repository — step by step, one click at a time.')}">github</a> ·
    <a href="/?prompt=${encodeURIComponent('Walk me through opening a folder of my existing work here — step by step.')}">folder</a> ·
    <a href="/">open the app</a>
  </p>
  <p class="foot">Bring the idea. We'll learn the rest together.<br>
  <b>Tip:</b> you can always just start typing — nothing here is a commitment.<br>
  <a href="/feedback" style="color:#8f8f97;border-bottom:1px solid #33333b;text-decoration:none">Tell us what you're building — we read every note</a></p>
</div></body></html>`
}
