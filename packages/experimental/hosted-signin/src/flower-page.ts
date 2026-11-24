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

// --- live activity: the flower turns toward whatever is being built --------
// The twelve outer centres are the skill points; the seven inner ones are doors.
// The server reports the hottest capability by id; we map it to a point.
const SKILL_ORDER = ['geometry', 'dashboard', 'web-app', 'scripting', 'scanner', 'docs', 'testing', 'service'];
const skillPoints = centres
  .filter((c) => Math.hypot(c[0], c[1]) > 1.5)
  .slice(0, 12);
let focus = null;   // { x, y, label }
let focusUntil = 0;
let trail = [];     // recent actions, oldest first: [{ skill, at, session }]
let trailTotal = 0;
let agents = [];    // distinct sessions at work: [{ id, steps, lastSkill }]
let simulated = false;

/** Colour per capability, so the work has a texture rather than one hue. */
const SKILL_COLOR = {
  geometry: '126,226,168', dashboard: '158,203,255', 'web-app': '239,220,164',
  scripting: '217,130,43', testing: '200,160,255', docs: '180,190,200',
  scanner: '150,220,220', service: '240,180,140', general: '217,130,43',
};

/**
 * Draw the session's work as a ring of dots: one per action, oldest at the top,
 * newest at the end. Brightness decays with age, colour is the capability, and
 * the radius breathes so a long run reads as a spiral rather than a smear.
 */
function drawTrail(now) {
  if (trail.length === 0) return;
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const base = Math.min(innerWidth, innerHeight) * 0.47;
  trail.forEach((event, index) => {
    const age = Math.max(0, now - event.at);
    const freshness = Math.max(0.08, 1 - age / 600000);
    // A long session winds into a spiral instead of crowding one ring: the radius
    // steps outward every 40 actions, so 200 calls read as three turns.
    const turn = index / 40;
    const angle = -Math.PI / 2 + (turn % 1) * Math.PI * 2;
    const radius = base * (0.74 + 0.06 * Math.min(4, Math.floor(turn)) + 0.12 * (turn % 1));
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const colour = SKILL_COLOR[event.skill] || SKILL_COLOR.general;
    ctx.beginPath();
    ctx.arc(x, y, DPR * (1.2 + 2.6 * freshness), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + colour + ',' + (0.15 + 0.75 * freshness).toFixed(3) + ')';
    ctx.shadowColor = 'rgba(' + colour + ',0.8)';
    ctx.shadowBlur = DPR * 8 * freshness;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

/**
 * A clearly-labelled simulation, used only when nothing real has happened.
 *
 * The page never pretends this is live work: the simulated flag is set, a badge
 * appears, and the nodes are generated from a time-seeded wobble rather than data.
 */
function simulate(now) {
  const seed = Math.floor(now / 30000);
  const pool = ['geometry', 'dashboard', 'web-app', 'scripting', 'testing', 'docs'];
  trail = [];
  for (let i = 0; i < 14; i += 1) {
    const wobble = Math.sin(seed * 0.7 + i * 1.3);
    trail.push({
      skill: pool[Math.abs(Math.floor(wobble * 3) + i) % pool.length],
      at: now - (14 - i) * 9000,
    });
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
    // Nothing real yet: show a labelled simulation rather than a dead page.
    if (simulated) simulate(Date.now());
    const badge = document.getElementById('simulated');
    if (badge) badge.style.opacity = simulated ? '.75' : '0';
    const counter = document.getElementById('counter');
    if (counter) counter.textContent = trailTotal > 0 ? trailTotal + ' actions in this session' : '';
    const hot = data.focus;
    if (!hot) {
      // Nothing live: keep the last session's shape on screen, dimmed, and say
      // "settled" so an empty ring is never mistaken for a broken one.
      const settled = document.getElementById('settled');
      if (settled) settled.textContent = trail.length > 0 ? 'session settled' : '';
      return;
    }
    const index = SKILL_ORDER.indexOf(hot.skill);
    const point = index >= 0 ? skillPoints[index % skillPoints.length] : null;
    if (!point) return;
    focus = { x: point[0], y: point[1], label: hot.label };
    focusUntil = performance.now() + 20000;
    const caption = document.getElementById('caption');
    caption.textContent = hot.label;
    caption.style.opacity = '1';
  } catch {
    /* a live view that fails is still a flower */
  }
}
poll();
setInterval(poll, 2500);

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

  // the session's shape: every action since the tab opened, colour-coded
  drawTrail(performance.now());

  // the agents at work: one body per session, with its steps strung behind it
  if (agents.length > 0) {
    agents.forEach((agent, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, agents.length)) * Math.PI * 2 + yaw * 0.4;
      const w = project(Math.cos(angle) * 1.55, Math.sin(angle) * 1.55, Math.sin(yaw + index) * 0.35);
      const radius = DPR * (4 + Math.min(6, agent.steps * 0.6));
      ctx.beginPath();
      ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,220,164,0.10)';
      ctx.strokeStyle = 'rgba(239,220,164,0.55)';
      ctx.lineWidth = DPR * 1.2;
      ctx.fill();
      ctx.stroke();
      // its steps, faintly strung outward: the path this agent has taken
      const mine = trail.filter((step) => step.session === undefined || step.session.slice(0, 6) === agent.id).slice(-8);
      mine.forEach((step, stepIndex) => {
        const hop = (stepIndex + 1) * 0.16;
        const p = project(Math.cos(angle) * (1.55 + hop), Math.sin(angle) * (1.55 + hop), 0);
        const colour = SKILL_COLOR[step.skill] || SKILL_COLOR.general;
        ctx.beginPath();
        ctx.arc(p.x, p.y, DPR * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + colour + ',0.55)';
        ctx.fill();
        if (stepIndex > 0) {
          const prev = project(Math.cos(angle) * (1.55 + hop - 0.16), Math.sin(angle) * (1.55 + hop - 0.16), 0);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = 'rgba(' + colour + ',0.16)';
          ctx.lineWidth = DPR * 0.8;
          ctx.stroke();
        }
      });
    });
  }

  // the live point: a pulsing ring around whatever is being built right now
  if (focus !== null && performance.now() < focusUntil) {
    const p = project(focus.x, focus.y, 0);
    const pulse = 10 + 6 * Math.sin(performance.now() * 0.004);
    ctx.beginPath();
    ctx.arc(p.x, p.y, (14 + pulse) * DPR * (0.7 + 0.4 * (p.k - 0.6)), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(126,226,168,0.85)';
    ctx.lineWidth = DPR * 1.6;
    ctx.shadowColor = 'rgba(126,226,168,0.9)';
    ctx.shadowBlur = DPR * 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
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
  const live = focus !== null && now < focusUntil;
  if (live && !dragging) {
    // Turn the focused point toward the viewer: the face of the medallion.
    const targetYaw = -Math.atan2(focus.y, focus.x);
    const targetPitch = -0.32;
    yaw += (targetYaw - yaw) * 0.045;
    pitch += (targetPitch - pitch) * 0.045;
  } else if (!dragging && !reduce) {
    yaw += dt * 0.00022;
  }
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
