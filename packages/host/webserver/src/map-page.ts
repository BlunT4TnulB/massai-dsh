/**
 * The map: the app's destinations arranged as the flower of life.
 *
 * The mark is not decoration here, it is the navigation. Seven of its points are
 * the seven places worth going, and the geometry gives them an order that is
 * learned in one glance: the centre is where you talk, the ring is where things
 * live, the outers are the doors.
 *
 * Two rules keep the metaphor honest:
 *
 *  - every point is a real `<a>` with a real label, so the map works with a
 *    keyboard, a screen reader, and no JavaScript at all
 *  - a plain list of the same links sits underneath, because a map that traps
 *    you when it fails to draw is worse than no map
 *
 * @module @deepseek-ai/dsh-host-webserver/map-page
 */

/** One destination on the map. */
interface Destination {
  /** Where it goes. */
  readonly href: string
  /** Its name. */
  readonly label: string
  /** One line of what it is for. */
  readonly what: string
  /** Coordinates on the 48-unit flower: the centre of one of the seven circles. */
  readonly x: number
  readonly y: number
  /** Radius class: the centre is the largest node. */
  readonly size: 'hub' | 'ring' | 'outer'
}

/**
 * The seven points of the flower, in the order they are learned:
 * talk (centre), then projects and library, then the four doors.
 */
function destinations(): readonly Destination[] {
  return [
    { href: '/', label: 'The door', what: 'start a build', x: 24, y: 24, size: 'hub' },
    { href: '/projects', label: 'Projects', what: 'everything you have made', x: 33, y: 24, size: 'ring' },
    { href: '/library', label: 'Library', what: 'what the workshop has built', x: 28.5, y: 31.79, size: 'ring' },
    { href: '/me', label: 'You', what: 'your id, spend and credit', x: 19.5, y: 31.79, size: 'ring' },
    { href: '/settings', label: 'Help level', what: 'how much is explained', x: 15, y: 24, size: 'outer' },
    { href: '/limits', label: 'Limits', what: 'every rule, printed', x: 19.5, y: 16.21, size: 'outer' },
    { href: '/support', label: 'Tip jar', what: 'keep the free tier alive', x: 28.5, y: 16.21, size: 'outer' },
  ]
}

/** Radius per node class, in the 48-unit viewBox. */
const NODE_RADIUS = { hub: 4.6, ring: 3.2, outer: 2.6 } as const

/**
 * Render the map page.
 * @param hideHelp - true for a person who asked for no explanatory text.
 * @returns the page HTML.
 */
export function mapPageHtml(hideHelp = false): string {
  const nodes = destinations()
  const circles = [
    [24, 24], [33, 24], [28.5, 31.79], [19.5, 31.79], [15, 24], [19.5, 16.21], [28.5, 16.21],
  ]
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The map — Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="description" content="Massai's seven destinations, drawn as the flower of life.">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 4rem;background:#0e0e10;color:#E9E9EF;
    font-family:system-ui,-apple-system,sans-serif;line-height:1.6;
    background-image:radial-gradient(60rem 40rem at 50% 0%,rgba(193,68,14,.12),transparent 70%)}
  main{max-width:34rem;margin:0 auto}
  h1{font-size:1.2rem;margin:0 0 .2rem;text-align:center;font-weight:600}
  .sub{color:#8a8a93;font-size:.85rem;text-align:center;margin:0 0 1.4rem}
  .map{display:block;width:100%;max-width:26rem;margin:0 auto;overflow:visible}
  .ring{fill:none;stroke:#3a3a44;stroke-width:.6}
  .node{fill:#141419;stroke:#C1440E;stroke-width:.9;transition:fill .18s ease}
  .node.ring-node{stroke:#8a5a2a}
  .node.outer-node{stroke:#4a4a56}
  a:hover .node,a:focus-visible .node{fill:#2a1a12}
  .label{fill:#E9E9EF;font-size:2.1px;font-weight:600;text-anchor:middle;paint-order:stroke;
    stroke:#0e0e10;stroke-width:.7px}
  .label.outer-label{font-size:1.7px;fill:#b9b9c2}
  a:focus-visible .label{fill:#7ee2a8}
  .list{margin:1.6rem auto 0;padding:0;list-style:none;max-width:24rem}
  .list li{display:flex;justify-content:space-between;gap:1rem;padding:.5rem .1rem;
    border-bottom:1px solid #1f1f26;font-size:.9rem}
  .list a{color:#F2F2F4;text-decoration:none;font-weight:600}
  .list a:hover,.list a:focus-visible{color:#7ee2a8}
  .list span{color:#7d7d86;font-size:.8rem;text-align:right}
  .foot{margin-top:2rem;text-align:center;color:#6f6f78;font-size:.8rem}
  .foot a{color:#8a8a93}
</style></head><body><main>
<h1>The map</h1>
<p class="sub">Seven places, one flower.${hideHelp ? '' : ' Every point is a door: the centre is where you talk, the ring is what you keep.'}</p>

<svg class="map" viewBox="0 0 48 48" role="img" aria-label="Massai's destinations arranged as a flower of life">
  ${circles.map(([x, y]) => `<circle class="ring" cx="${x}" cy="${y}" r="9"/>`).join('\n  ')}
  <circle class="ring" cx="24" cy="24" r="22" stroke-width=".8"/>
  ${nodes.map(node => `<a href="${node.href}" aria-label="${node.label}: ${node.what}">
    <circle class="node ${node.size === 'hub' ? '' : node.size === 'ring' ? 'ring-node' : 'outer-node'}"
      cx="${node.x}" cy="${node.y}" r="${NODE_RADIUS[node.size]}"/>
    <text class="label ${node.size === 'outer' ? 'outer-label' : ''}" x="${node.x}" y="${node.y + 0.9}">${labelOf(node)}</text>
  </a>`).join('\n  ')}
</svg>

<ul class="list">
  ${nodes.map(node => `<li><a href="${node.href}">${node.label}</a><span>${node.what}</span></li>`).join('\n  ')}
</ul>

<p class="foot"><a href="/flower">the immersive flower →</a> · <a href="/">back to the door</a> · <a href="/settings">how much help</a></p>
</main></body></html>`
}

/** Short enough to fit inside a node. */
function labelOf(node: Destination): string {
  return node.size === 'hub' ? 'Talk' : node.size === 'outer' ? node.label.split(' ')[0] ?? node.label : node.label
}
