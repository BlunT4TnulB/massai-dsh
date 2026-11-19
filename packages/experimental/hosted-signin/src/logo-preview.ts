/**
 * Anonymous concept sheet for the Massai mark: four directions rendered on the
 * dark canvas so the owner can compare them live instead of imagining them.
 *
 * @module @deepseek-ai/dsh-hosted-signin/logo-preview
 */

/** The warrior: shield over crossed spears. */
const WARRIOR = `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <path d="M16 104L104 16M104 104L16 16" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".55"/>
  <path d="M104 16l-12 2 10 10z" fill="currentColor" opacity=".55"/>
  <path d="M16 16l12 2-10 10z" fill="currentColor" opacity=".55"/>
  <path d="M60 26c24 0 34 14 34 32 0 24-16 40-34 48-18-8-34-24-34-48 0-18 10-32 34-32z"
    fill="#151517" stroke="currentColor" stroke-width="6"/>
  <path d="M60 40v34M48 52h24" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".8"/>
</svg>`

/** The shield-window: a warrior's shield whose beading is code. */
const SHIELD_WINDOW = `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <path d="M60 16c26 0 36 15 36 34 0 26-18 44-36 54-18-10-36-28-36-54 0-19 10-34 36-34z"
    stroke="currentColor" stroke-width="6"/>
  <rect x="38" y="46" width="46" height="6" rx="3" fill="currentColor" opacity=".9"/>
  <rect x="34" y="59" width="54" height="6" rx="3" fill="currentColor" opacity=".65"/>
  <rect x="40" y="72" width="42" height="6" rx="3" fill="currentColor" opacity=".45"/>
  <rect x="46" y="85" width="30" height="6" rx="3" fill="currentColor" opacity=".3"/>
</svg>`

/** The compiler: a resonance wave that resolves into code braces. */
const WAVE_COMPILER = `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <path d="M14 82c14-38 26 22 40-12 10-24 20 10 30-4" stroke="currentColor" stroke-width="6"
    stroke-linecap="round" opacity=".9"/>
  <path d="M96 44c-8 0-6 10-11 16 5 6 3 16 11 16" stroke="currentColor" stroke-width="5"
    stroke-linecap="round" opacity=".6"/>
  <circle cx="30" cy="96" r="4" fill="currentColor" opacity=".35"/>
  <circle cx="52" cy="96" r="4" fill="currentColor" opacity=".5"/>
  <circle cx="74" cy="96" r="4" fill="currentColor" opacity=".65"/>
</svg>`

/** The spear-cursor: a vertical spear whose tip is your pointer. */
const SPEAR_CURSOR = `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <path d="M60 108V58" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <path d="M0 0L-12 32L-4 26L4 44L12 40L4 22L14 22Z" transform="translate(60 20)"
    fill="currentColor"/>
</svg>`

/** The current music mark, kept for comparison. */
const CURRENT = `<img class="mark" src="/massai-mark.jpg" alt="current mark">`

/** The crest: a warrior's shield charged with the DeepSeek whale, haloed. */
const CREST = `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <ellipse cx="60" cy="9" rx="27" ry="9" fill="#D9822B" opacity=".13"/>
  <ellipse cx="60" cy="9" rx="21" ry="5.6" fill="none" stroke="#D9822B" stroke-width="7" opacity=".16"/>
  <ellipse cx="60" cy="9" rx="21" ry="5.6" fill="none" stroke="#D9822B" stroke-width="3.2"/>
  <path d="M14 100L106 18M106 100L14 18" stroke="#C1440E" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <path d="M106 18l-11 2 9 9zM14 18l11 2-9 9z" fill="#C1440E" opacity=".7"/>
  <path d="M60 14c25 0 36 15 36 34 0 27-19 45-36 54-17-9-36-27-36-54 0-19 11-34 36-34z"
    fill="#151517" stroke="#C1440E" stroke-width="6"/>
  <g fill="#4D6BFE" transform="translate(36.4 50) scale(2.8)">
    <rect x="2" y="3" width="4" height="1"/><rect x="2" y="4" width="9" height="1"/>
    <rect x="2" y="5" width="10" height="1"/><rect x="3" y="6" width="7" height="1"/>
    <rect x="11" y="3" width="1" height="1"/><rect x="12" y="2" width="1" height="2"/>
    <rect x="13" y="1" width="1" height="2"/><rect x="12" y="4" width="2" height="2"/>
    <rect x="13" y="5" width="1" height="2"/><rect x="6" y="1" width="1" height="2"/>
    <rect x="6" y="0" width="1" height="1"/>
  </g>
</svg>`

/** The concept sheet HTML. */
export function logoPreviewHtml(): string {
  const card = (title: string, note: string, art: string): string => `
    <figure>
      <div class="art">${art}</div>
      <figcaption><b>${title}</b><span>${note}</span></figcaption>
    </figure>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — mark concepts</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#151517;color:#f2f2f4;
    font-family:system-ui,-apple-system,sans-serif}
  h1{margin:0 0 .25rem;font-size:1.35rem;letter-spacing:.02em}
  p.lead{margin:0 0 1.75rem;color:#9a9aa2;font-size:.92rem;max-width:46rem;line-height:1.55}
  .grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));max-width:70rem}
  figure{margin:0;padding:1.25rem;border:1px solid #2a2a30;border-radius:.9rem;background:#191920}
  .art{height:9rem;display:flex;align-items:center;justify-content:center;color:#7ee2a8}
  .art svg{width:7.5rem;height:7.5rem}
  .art img.mark{width:7.5rem;filter:invert(1);mix-blend-mode:screen;opacity:.95}
  figcaption{display:flex;flex-direction:column;gap:.3rem;margin-top:.9rem;font-size:.85rem}
  figcaption b{font-size:.95rem;letter-spacing:.04em}
  figcaption span{color:#8f8f97;line-height:1.45}
  .alt{color:#8f8f97;font-size:.85rem;margin-top:2rem;max-width:46rem;line-height:1.6}
  .palette{display:flex;flex-wrap:wrap;gap:.9rem;align-items:center;margin-top:1.8rem;
    font-size:.82rem;color:#9a9aa2}
  .palette b{color:#f2f2f4;letter-spacing:.06em;text-transform:uppercase;font-size:.72rem}
  .palette span{display:inline-flex;align-items:center;gap:.4rem}
  .palette i{width:1rem;height:1rem;border-radius:.25rem;display:inline-block;border:1px solid #33333b}
  code{background:#22222a;padding:.15rem .35rem;border-radius:.3rem;color:#c9c9d1}
</style></head><body>
<h1>Massai — mark concepts</h1>
<p class="lead">Four directions for a builder mark. All are vectors, so they scale from
favicon to billboard. Accent shown in the current green; the same shapes work in
Maasai ochre <code>#C1440E</code> or DeepSeek blue <code>#4D6BFE</code>.</p>
<div class="grid">
  ${card('The Crest ★', 'Warrior shield charged with the whale — haloed, because Massai is one letter from Messiah.', CREST)}
  ${card('The Warrior', 'Shield over crossed spears — fearless builder, heritage of the name.', WARRIOR)}
  ${card('Shield-Window', 'The shield is your app: beading becomes code lines.', SHIELD_WINDOW)}
  ${card('The Compiler', 'The resonance wave resolving into braces — music that builds.', WAVE_COMPILER)}
  ${card('Spear-Cursor', 'A spear whose tip is your pointer — you aim, the AI throws.', SPEAR_CURSOR)}
  ${card('Current mark', 'The music-wunda mark you patched — wave + resonance.', CURRENT)}
</div>
<div class="palette"><b>Palette</b>
  <span><i style="background:#151517"></i>Canvas #151517</span>
  <span><i style="background:#C1440E"></i>Maasai ochre #C1440E</span>
  <span><i style="background:#D9822B"></i>Acacia gold #D9822B</span>
  <span><i style="background:#F2F2F4"></i>Bone #F2F2F4</span>
  <span><i style="background:#4D6BFE"></i>Whale blue #4D6BFE</span>
</div>
<p class="alt">My pick: <b>The Warrior</b> for the icon (reads at 16px, unmistakably a
shield) with <b>The Compiler</b> as an optional secondary motif for the wordmark.
Reply with a direction and I'll refine it properly — construction grid, favicon sizes, and
a transparent SVG checked into the brand assets.</p>
</body></html>`
}
