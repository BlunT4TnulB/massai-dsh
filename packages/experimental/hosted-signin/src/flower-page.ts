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

// --- geometry -------------------------------------------------------------
// Nineteen circles on a hexagonal lattice: the whole flower. Two layers of them
// become thirty-eight spheres, which is what makes it read as an object rather
// than a drawing.
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
const LAYER_Z = 0.34;

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
        for (const q of out) if (Math.hypot(q[0] - px, q[1] - py) < 1e-3) { dup = true; break; }
        if (!dup) out.push([px, py]);
      }
    }
  }
  return out;
}
const lattice = intersections();

// --- the seven doors ------------------------------------------------------
const doors = [
  { x: 0, y: 0, label: 'Talk', href: '/' },
  { x: 1, y: 0, label: 'Projects', href: '/projects' },
  { x: 0.5, y: Math.sqrt(3) / 2, label: 'Library', href: '/library' },
  { x: -0.5, y: Math.sqrt(3) / 2, label: 'You', href: '/me' },
  { x: -1, y: 0, label: 'Limits', href: '/limits' },
  { x: -0.5, y: -Math.sqrt(3) / 2, label: 'Tip jar', href: '/support' },
  { x: 0.5, y: -Math.sqrt(3) / 2, label: 'Help', href: '/settings' },
];

// Skill points: the outer centres. The twelve that are not doors.
const SKILL_ORDER = ['geometry', 'dashboard', 'web-app', 'scripting', 'scanner', 'docs', 'testing', 'service'];
const skillPoints = centres.filter(function (c) { return Math.hypot(c[0], c[1]) > 1.5; }).slice(0, 12);

// --- palette and restraint -------------------------------------------------
// One palette. One glow. One speed. Everything angelic comes from restraint.
const GOLD = '247,205,140';
const GREEN = '126,226,168';
const BLUE = '158,203,255';
const SKILL_COLOR = {
  geometry: GREEN, dashboard: BLUE, 'web-app': GOLD, scripting: '217,130,43',
  testing: '200,160,255', docs: '180,190,200', scanner: '150,220,220',
  service: '240,180,140', general: GOLD,
};
const IDLE_SPEED = 0.00006;

// --- sphere sprites -------------------------------------------------------
// One soft sphere is rendered once per tint and drawn many times: a radial
// gradient per sphere per frame would be the only expensive thing here.
const spriteCache = new Map();
function sphereSprite(tint) {
  if (spriteCache.has(tint)) return spriteCache.get(tint);
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size * 0.42, size * 0.38, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,250,240,0.95)');
  grad.addColorStop(0.18, 'rgba(' + tint + ',0.75)');
  grad.addColorStop(0.55, 'rgba(' + tint + ',0.22)');
  grad.addColorStop(1, 'rgba(' + tint + ',0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(tint, c);
  return c;
}

// --- camera ---------------------------------------------------------------
let yaw = 0.35;
let pitch = -0.42;
let zoom = 1;
let dragging = false;
let hovered = -1;
let last = performance.now();
let bloom = 0;
let trail = [];
let trailTotal = 0;
let agents = [];
let focus = null;
let focusUntil = 0;
let simulated = false;
let counter = document.getElementById('counter');
let caption = document.getElementById('caption');

const DPR = Math.min(innerWidth < 700 ? 1.5 : 2, window.devicePixelRatio || 1);

function resize() {
  canvas.width = Math.floor(innerWidth * DPR);
  canvas.height = Math.floor(innerHeight * DPR);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
resize();
addEventListener('resize', resize);

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
  const scale = zoom * Math.min(innerWidth, innerHeight) * 0.30;
  const k = distance / (distance + z2);
  return { x: innerWidth / 2 + x1 * scale * k, y: innerHeight / 2 + y1 * scale * k, k: k, depth: z2 };
}

function drawSprite(tint, x, y, radius, alpha) {
  const sprite = sphereSprite(tint);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function drawHalo(now) {
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const reach = Math.max(innerWidth, innerHeight) * 0.8;
  const breathe = reduce ? 1 : 1 + 0.05 * Math.sin(now * 0.0006 + bloom);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  g.addColorStop(0, 'rgba(58,34,16,' + (0.65 + 0.25 * bloom).toFixed(3) + ')');
  g.addColorStop(0.35 + 0.05 * breathe * 0.0, 'rgba(20,15,12,0.92)');
  g.addColorStop(0.75, 'rgba(11,11,13,0.98)');
  g.addColorStop(1, '#08080a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // One thin world-space ring, so the object reads as suspended in something.
  ctx.beginPath();
  const ringRadius = 2.35;
  for (let t = 0; t <= 96; t += 1) {
    const angle = (t / 96) * Math.PI * 2;
    const p = project(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);
    if (t === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(217,130,43,0.10)';
  ctx.lineWidth = DPR * 0.8;
  ctx.stroke();
}

/** Bloom for one sphere: stronger near the active skill point. */
function bloomAt(x, y) {
  if (focus === null) return 0;
  const d = Math.hypot(x - focus.x, y - focus.y);
  return Math.max(0, 1 - d / 2.4) * bloom;
}

function drawSpheres(now) {
  // two layers: the back one dimmer and slightly larger, for parallax
  const layers = [
    { z: -LAYER_Z, alpha: 0.34, size: 1.06 },
    { z: LAYER_Z, alpha: 0.72, size: 1 },
  ];
  for (const layer of layers) {
    const ordered = centres
      .map(function (c) { return { c: c, depth: project(c[0], c[1], layer.z).depth }; })
      .sort(function (p, q) { return p.depth - q.depth; });
    for (const entry of ordered) {
      const c = entry.c;
      const p = project(c[0], c[1], layer.z);
      const isDoor = doors.some(function (d) { return Math.abs(d.x - c[0]) < 1e-6 && Math.abs(d.y - c[1]) < 1e-6; });
      const heat = bloomAt(c[0], c[1]);
      const tint = heat > 0.05 ? GREEN : GOLD;
      const base = Math.min(innerWidth, innerHeight) * 0.30 * 0.92 * layer.size;
      const radius = base * p.k * (isDoor ? 1.10 : 1);
      const brightness = layer.alpha * (0.55 + 0.45 * (p.k - 0.55)) + heat * 0.5;
      drawSprite(tint, p.x, p.y, radius, brightness);
    }
  }
}

function drawLattice() {
  for (const point of lattice) {
    const p = project(point[0], point[1], 0);
    const heat = bloomAt(point[0], point[1]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, DPR * (0.7 + 1.6 * (p.k - 0.55)) * (1 + heat), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,236,205,' + (0.10 + 0.22 * (p.k - 0.5) + heat * 0.5).toFixed(3) + ')';
    ctx.fill();
  }
}

function drawTrail(now) {
  if (trail.length === 0) return;
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const base = Math.min(innerWidth, innerHeight) * 0.44;
  trail.forEach(function (event, index) {
    const age = Math.max(0, now - event.at);
    const freshness = Math.max(0.06, 1 - age / 600000);
    const turn = index / 40;
    const angle = -Math.PI / 2 + (turn % 1) * Math.PI * 2;
    const radius = base * (0.72 + 0.055 * Math.min(4, Math.floor(turn)) + 0.10 * (turn % 1));
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const colour = SKILL_COLOR[event.skill] || GOLD;
    drawSprite(colour, x, y, DPR * (2.2 + 3.4 * freshness), 0.10 + 0.55 * freshness);
  });
}

function drawAgents() {
  agents.forEach(function (agent, index) {
    const angle = -Math.PI / 2 + (index / Math.max(1, agents.length)) * Math.PI * 2 + yaw * 0.45;
    const p = project(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62, Math.sin(yaw + index) * 0.36);
    const heat = bloomAt(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62);
    drawSprite(GOLD, p.x, p.y, DPR * (7 + Math.min(7, agent.steps * 0.7)), 0.35 + 0.3 * heat);
    const mine = trail.filter(function (step) {
      return step.agent === undefined || step.agent === agent.id;
    }).slice(-8);
    mine.forEach(function (step, i) {
      const hop = (i + 1) * 0.17;
      const q = project(Math.cos(angle) * (1.62 + hop), Math.sin(angle) * (1.62 + hop), 0);
      const colour = SKILL_COLOR[step.skill] || GOLD;
      drawSprite(colour, q.x, q.y, DPR * 2.0, 0.5);
    });
  });
}

function drawDoors(now) {
  const front = project(0, 0, LAYER_Z);
  doors.forEach(function (door, index) {
    const p = project(door.x, door.y, LAYER_Z + 0.02);
    const active = index === hovered;
    const heat = bloomAt(door.x, door.y);
    const radius = DPR * (active ? 12 : 8) * (0.85 + 0.5 * (p.k - 0.6)) * (1 + heat * 0.3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(255,238,205,0.95)' : 'rgba(239,220,164,0.5)';
    ctx.shadowColor = 'rgba(217,130,43,0.9)';
    ctx.shadowBlur = DPR * (active ? 22 : 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (active || zoom > 1.2) {
      ctx.font = (DPR * 12).toFixed(0) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? 'rgba(255,240,215,0.98)' : 'rgba(220,210,190,0.72)';
      ctx.fillText(door.label, p.x, p.y - radius - DPR * 8);
    }
  });
  void front;
}

function drawFocus(now) {
  if (focus === null) return;
  const p = project(focus.x, focus.y, LAYER_Z + 0.03);
  const pulse = 12 + 7 * Math.sin(now * 0.0035);
  ctx.beginPath();
  ctx.arc(p.x, p.y, (16 + pulse) * DPR * (0.72 + 0.4 * (p.k - 0.6)), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(126,226,168,0.8)';
  ctx.lineWidth = DPR * 1.4;
  ctx.shadowColor = 'rgba(126,226,168,0.9)';
  ctx.shadowBlur = DPR * 18;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function frame(now) {
  const dt = Math.min(64, now - last);
  last = now;
  if (document.visibilityState === 'hidden') {
    requestAnimationFrame(frame);
    return;
  }
  const live = focus !== null && now < focusUntil;
  bloom += (((live ? 1 : 0)) - bloom) * 0.04;

  if (live && !dragging) {
    const targetYaw = -Math.atan2(focus.y, focus.x);
    yaw += (targetYaw - yaw) * 0.035;
    pitch += (-0.30 - pitch) * 0.035;
  } else if (!dragging && !reduce) {
    yaw += dt * IDLE_SPEED;
  }

  drawHalo(now);
  drawTrail(now);
  drawSpheres(now);
  drawLattice();
  drawAgents();
  drawDoors(now);
  drawFocus(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- polling: the object turns toward whatever is being built --------------
function simulate(now) {
  const seed = Math.floor(now / 30000);
  const pool = ['geometry', 'dashboard', 'web-app', 'scripting', 'testing', 'docs'];
  trail = [];
  for (let i = 0; i < 14; i += 1) {
    const wobble = Math.sin(seed * 0.7 + i * 1.3);
    trail.push({ skill: pool[Math.abs(Math.floor(wobble * 3) + i) % pool.length], at: now - (14 - i) * 9000 });
  }
  agents = [{ id: 'demo-1', steps: 9, lastSkill: 'geometry' }, { id: 'demo-2', steps: 5, lastSkill: 'docs' }];
  simulated = true;
}

async function poll() {
  try {
    const response = await fetch('/api/one-turn/activity', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    trail = Array.isArray(data.trail) ? data.trail : [];
    agents = Array.isArray(data.agents) ? data.agents : [];
    trailTotal = data.counts && typeof data.counts.total === 'number' ? data.counts.total : trail.length;
    simulated = trail.length === 0;
    if (simulated) simulate(Date.now());
    if (counter) counter.textContent = trailTotal > 0 ? trailTotal + ' actions · 38 spheres · 61 points' : '';
    const badge = document.getElementById('simulated');
    if (badge) badge.style.opacity = simulated ? '0.75' : '0';
    const hot = data.focus;
    if (!hot) {
      const settled = document.getElementById('settled');
      if (settled) settled.textContent = trail.length > 0 ? 'session settled' : '';
      return;
    }
    const index = SKILL_ORDER.indexOf(hot.skill);
    const point = index >= 0 ? skillPoints[index % skillPoints.length] : null;
    if (!point) return;
    focus = { x: point[0], y: point[1], label: hot.label };
    focusUntil = performance.now() + 25000;
    if (caption) {
      caption.textContent = hot.label;
      caption.style.opacity = '1';
    }
  } catch {
    /* a live view that fails is still a flower */
  }
}
poll();
setInterval(poll, 2500);

// --- interaction ----------------------------------------------------------
canvas.addEventListener('pointerdown', function (event) {
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  canvas.dataset.drag = event.clientX + ',' + event.clientY;
});
canvas.addEventListener('pointermove', function (event) {
  if (dragging) {
    const parts = (canvas.dataset.drag || '0,0').split(',');
    const lx = Number(parts[0]);
    const ly = Number(parts[1]);
    yaw += (event.clientX - lx) * 0.005;
    pitch = Math.max(-1.15, Math.min(1.15, pitch + (event.clientY - ly) * 0.004));
    canvas.dataset.drag = event.clientX + ',' + event.clientY;
    if (hint) hint.style.opacity = '0';
    return;
  }
  let best = -1;
  let bestDistance = 28 * DPR;
  doors.forEach(function (door, index) {
    const p = project(door.x, door.y, LAYER_Z + 0.02);
    const distance = Math.hypot(p.x - event.clientX * DPR, p.y - event.clientY * DPR);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  hovered = best;
  canvas.style.cursor = best >= 0 ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerup', function () {
  dragging = false;
  if (hovered >= 0) location.href = doors[hovered].href;
});
canvas.addEventListener('wheel', function (event) {
  event.preventDefault();
  zoom = Math.max(0.65, Math.min(2.2, zoom * (event.deltaY > 0 ? 0.95 : 1.05)));
}, { passive: false });
addEventListener('keydown', function (event) {
  if (event.key === 'ArrowLeft') yaw -= 0.1;
  if (event.key === 'ArrowRight') yaw += 0.1;
  if (event.key === 'ArrowUp') pitch = Math.max(-1.15, pitch - 0.07);
  if (event.key === 'ArrowDown') pitch = Math.min(1.15, pitch + 0.07);
  if (event.key === '0') { yaw = 0.35; pitch = -0.42; zoom = 1; }
});
setTimeout(function () { if (hint) hint.style.opacity = '0'; }, 7000);
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
  .caption{position:fixed;left:0;right:0;top:3.2rem;text-align:center;font-size:.82rem;
    color:#7ee2a8;opacity:0;transition:opacity .6s ease;letter-spacing:.02em}
  .counter{position:fixed;left:0;right:0;bottom:3.2rem;text-align:center;font-size:.72rem;
    color:#6f6f78;letter-spacing:.08em}
  .settled{position:fixed;left:0;right:0;bottom:2.1rem;text-align:center;font-size:.66rem;
    color:#4f4f58;letter-spacing:.12em;text-transform:uppercase}
  .sim{position:fixed;left:0;right:0;bottom:.9rem;text-align:center;font-size:.62rem;
    color:#5a4a30;letter-spacing:.14em;text-transform:uppercase;transition:opacity .8s ease}
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
<p class="caption" id="caption"></p>
<p class="counter" id="counter"></p>
<p class="settled" id="settled"></p>
<p class="sim" id="simulated">simulated — no live activity yet</p>
<p class="hint" id="hint"><b>drag</b> to turn · <b>scroll</b> to zoom · <b>click</b> a point to move${hideHelp ? '' : ' · arrows work too'}</p>
<a class="plain" href="/map">plain map for screen readers</a>
<script>${FLOWER_SCRIPT}</script>
</body></html>`
}
