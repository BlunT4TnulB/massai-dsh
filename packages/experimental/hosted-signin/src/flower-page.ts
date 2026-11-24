/**
 * The immersive flower: the logo as a place you can turn, zoom and click.
 *
 * No framework, no WebGL, no dependencies — one canvas, a rotation matrix and a
 * perspective divide. That is enough for the effect, it ships in a single
 * response, and it cannot break the rest of the app if it fails.
 *
 * The geometry is real: nineteen circles on a hexagonal lattice (the flower of
 * life), with every pairwise intersection computed, so the inner lattice of
 * points is derived rather than drawn by hand.
 *
 * Rules it keeps:
 *  - `prefers-reduced-motion` stops the idle rotation and nothing else
 *  - seven of the points are doors; the rest are texture
 *  - a keyboard-and-screen-reader path exists as plain links (see the map page)
 *  - the loop pauses when the tab is hidden
 *
 * @module @deepseek-ai/dsh-hosted-signin/flower-page
 */

/** The page script, kept as data so the template stays readable. */
const FLOWER_SCRIPT = String.raw`
const canvas = document.getElementById('flower');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- geometry: nineteen circles on a hexagonal lattice ---------------------
const R = 1;
const A = [R, 0];
const B = [R / 2, R * Math.sqrt(3) / 2];
const centres = [];
for (let i = -2; i <= 2; i += 1) {
  for (let j = -2; j <= 2; j += 1) {
    const x = i * A[0] + j * B[0];
    const y = i * A[1] + j * B[1];
    if (Math.hypot(x, y) <= 2 * R + 1e-6) centres.push([x, y]);
  }
}

// every pairwise intersection, deduplicated: the star inside the flower
function intersections() {
  const out = [];
  for (let i = 0; i < centres.length; i += 1) {
    for (let j = i + 1; j < centres.length; j += 1) {
      const [x1, y1] = centres[i];
      const [x2, y2] = centres[j];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const d = Math.hypot(dx, dy);
      if (d === 0 || d > 2 * R) continue;
      const a = d / 2;
      const h = Math.sqrt(Math.max(0, R * R - a * a));
      const mx = x1 + dx * (a / d);
      const my = y1 + dy * (a / d);
      const ux = -dy / d;
      const uy = dx / d;
      for (const sign of [1, -1]) {
        const px = mx + ux * h * sign;
        const py = my + uy * h * sign;
        let dup = false;
        for (const p of out) {
          if (Math.hypot(p[0] - px, p[1] - py) < 1e-3) { dup = true; break; }
        }
        if (!dup) out.push([px, py]);
      }
    }
  }
  return out;
}
const lattice = intersections();

// --- the seven doors, hung on the seven inner centres -----------------------
const doors = [
  { x: 0, y: 0, label: 'Talk', href: '/' },
  { x: 1, y: 0, label: 'Projects', href: '/projects' },
  { x: 0.5, y: Math.sqrt(3) / 2, label: 'Library', href: '/library' },
  { x: -0.5, y: Math.sqrt(3) / 2, label: 'You', href: '/me' },
  { x: -1, y: 0, label: 'Limits', href: '/limits' },
  { x: -0.5, y: -Math.sqrt(3) / 2, label: 'Tip jar', href: '/support' },
  { x: 0.5, y: -Math.sqrt(3) / 2, label: 'Help', href: '/settings' },
];

// --- camera ---------------------------------------------------------------
let yaw = 0.35;
let pitch = -0.42;
let zoom = 1;
let dragging = false;
let hovered = -1;
let last = performance.now();
const DPR = Math.min(2, window.devicePixelRatio || 1);

function resize() {
  canvas.width = Math.floor(innerWidth * DPR);
  canvas.height = Math.floor(innerHeight * DPR);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
resize();
addEventListener('resize', resize);

// rotate + perspective project: world (x,y,0) -> screen
function project(x, y, z) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const y1 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  const distance = 6.2;
  const scale = zoom * Math.min(innerWidth, innerHeight) * 0.34;
  const k = distance / (distance + z2);
  return {
    x: innerWidth / 2 + x1 * scale * k,
    y: innerHeight / 2 + y1 * scale * k,
    k,
    depth: z2,
  };
}

function lines() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createRadialGradient(innerWidth / 2, innerHeight / 2, 0, innerWidth / 2, innerHeight / 2, Math.max(innerWidth, innerHeight) * 0.75);
  g.addColorStop(0, 'rgba(48,26,12,0.85)');
  g.addColorStop(0.45, 'rgba(14,14,16,0.95)');
  g.addColorStop(1, '#0b0b0d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // circles, back to front
  const order = centres.map((c, i) => ({ c, i, z: project(c[0], c[1], 0).depth })).sort((p, q) => p.z - q.z);
  ctx.lineWidth = DPR * 1.1;
  for (const { c } of order) {
    const pts = [];
    for (let t = 0; t <= 64; t += 1) {
      const angle = (t / 64) * Math.PI * 2;
      pts.push(project(c[0] + Math.cos(angle) * R, c[1] + Math.sin(angle) * R, 0));
    }
    const near = pts.reduce((sum, p) => sum + p.k, 0) / pts.length;
    ctx.beginPath();
    pts.forEach((p, index) => { if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(217,130,43,' + (0.20 + 0.55 * (near - 0.55)).toFixed(3) + ')';
    ctx.shadowColor = 'rgba(217,130,43,0.85)';
    ctx.shadowBlur = DPR * 7 * near;
    ctx.stroke();
  }

  // the lattice points: depth drives size and brightness
  ctx.shadowBlur = 0;
  for (const [x, y] of lattice) {
    const p = project(x, y, 0);
    const r = DPR * (0.9 + 2.1 * (p.k - 0.55));
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.6, r), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,196,120,' + (0.10 + 0.32 * (p.k - 0.5)).toFixed(3) + ')';
    ctx.fill();
  }

  // the seven doors: brighter, labelled, clickable
  doors.forEach((door, index) => {
    const p = project(door.x, door.y, 0);
    const active = index === hovered;
    const radius = DPR * (active ? 9 : 6) * (0.8 + 0.5 * (p.k - 0.6));
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, radius), 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(255,205,130,0.95)' : 'rgba(239,220,164,0.55)';
    ctx.shadowColor = 'rgba(217,130,43,0.9)';
    ctx.shadowBlur = DPR * (active ? 18 : 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (active || zoom > 1.25) {
      ctx.font = (DPR * 12).toFixed(0) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? 'rgba(255,235,205,0.98)' : 'rgba(220,210,190,0.7)';
      ctx.fillText(door.label, p.x, p.y - radius - DPR * 8);
    }
  });
}

function frame(now) {
  const dt = Math.min(64, now - last);
  last = now;
  if (!dragging && !reduce) yaw += dt * 0.00022;
  lines();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- interaction ----------------------------------------------------------
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  canvas.dataset.drag = event.clientX + ',' + event.clientY;
});
canvas.addEventListener('pointermove', (event) => {
  if (dragging) {
    const [lx, ly] = (canvas.dataset.drag || '0,0').split(',').map(Number);
    yaw += (event.clientX - lx) * 0.006;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (event.clientY - ly) * 0.005));
    canvas.dataset.drag = event.clientX + ',' + event.clientY;
    hint.style.opacity = '0';
    return;
  }
  // hover: nearest door within a thumb's reach
  let best = -1;
  let bestDistance = 26 * DPR;
  doors.forEach((door, index) => {
    const p = project(door.x, door.y, 0);
    const distance = Math.hypot(p.x - event.clientX * DPR, p.y - event.clientY * DPR);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  hovered = best;
  canvas.style.cursor = best >= 0 ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  if (hovered >= 0 && event.pointerType !== 'touch') location.href = doors[hovered].href;
});
canvas.addEventListener('click', (event) => {
  if (event.pointerType === 'touch') {
    // a tap on a phone: first tap focuses, second tap goes
    if (hovered >= 0) location.href = doors[hovered].href;
  }
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoom = Math.max(0.6, Math.min(2.4, zoom * (event.deltaY > 0 ? 0.94 : 1.06)));
}, { passive: false });
document.addEventListener('visibilitychange', () => { last = performance.now(); });
addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') yaw -= 0.12;
  if (event.key === 'ArrowRight') yaw += 0.12;
  if (event.key === 'ArrowUp') pitch = Math.max(-1.2, pitch - 0.08);
  if (event.key === 'ArrowDown') pitch = Math.min(1.2, pitch + 0.08);
  if (event.key === '0') { yaw = 0.35; pitch = -0.42; zoom = 1; }
});
setTimeout(() => { hint.style.opacity = '0'; }, 6000);
`

/**
 * Render the immersive flower page.
 * @param hideHelp - true for a person who asked for no explanatory text.
 * @returns the page HTML.
 */
export function flowerPageHtml(hideHelp = false): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>The flower — Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="description" content="The Massai mark as a place: turn it, zoom it, and use its points to move.">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:#0b0b0d;color:#E9E9EF;overflow:hidden;
    font-family:system-ui,-apple-system,sans-serif}
  canvas{display:block;cursor:grab;touch-action:none}
  .overlay{position:fixed;left:0;right:0;top:0;padding:1.1rem 1.25rem;display:flex;justify-content:space-between;
    align-items:center;pointer-events:none}
  .brand{display:flex;align-items:center;gap:.5rem;opacity:.9}
  .brand span{font-family:Georgia,serif;letter-spacing:.26em;font-size:.82rem;color:#EFDCA4}
  .back{pointer-events:auto;font-size:.78rem;color:#8a8a93;text-decoration:none}
  .back:hover{color:#7ee2a8}
  .hint{position:fixed;left:0;right:0;bottom:1.4rem;text-align:center;font-size:.78rem;color:#8a8a93;
    transition:opacity 1.2s ease}
  .hint b{color:#EFDCA4;font-weight:600}
  .plain{position:fixed;right:1.1rem;bottom:1.2rem;font-size:.72rem;color:#5f5f68;text-decoration:none;
    pointer-events:auto}
  .plain:hover{color:#7ee2a8}
  @media (prefers-reduced-motion: reduce) { .hint{transition:none} }
</style></head><body>
<canvas id="flower" aria-label="The Massai flower of life, rotatable" role="img"></canvas>
<div class="overlay">
  <div class="brand"><img src="/massai-crest.svg" alt="" width="22" height="22"><span>MASSAI</span></div>
  <a class="back" href="/">← the door</a>
</div>
<p class="hint" id="hint"><b>drag</b> to turn · <b>scroll</b> to zoom · <b>click</b> a point to move${hideHelp ? '' : ' · arrows work too'}</p>
<a class="plain" href="/map">plain map for screen readers</a>
<script>${FLOWER_SCRIPT}</script>
</body></html>`
}
