/**
 * The immersive flower: the logo as a presence you can turn, and nothing more.
 *
 * It breathes on its own. Dragging turns it and scrolling comes closer, but
 * nothing here takes you anywhere and nothing asks you for anything — the moment
 * a presence has buttons it becomes an appliance. Navigation lives on `/map`.
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

function intersections() {
  const out = [];
  for (let i = 0; i < centres.length; i += 1) {
    for (let j = i + 1; j < centres.length; j += 1) {
      const x1 = centres[i][0];
      const y1 = centres[i][1];
      const x2 = centres[j][0];
      const y2 = centres[j][1];
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

// The web: lattice points close enough to be joined by a filament. This is the
// structure the flower *implies* and never draws.
const filaments = [];
for (let i = 0; i < lattice.length; i += 1) {
  for (let j = i + 1; j < lattice.length; j += 1) {
    const d = Math.hypot(lattice[i][0] - lattice[j][0], lattice[i][1] - lattice[j][1]);
    if (d > 0.36 && d < 0.72) filaments.push([lattice[i], lattice[j], d]);
  }
}

// --- doors and skill points -----------------------------------------------
const doors = [
  { x: 0, y: 0, label: 'Talk' },
  { x: 1, y: 0, label: 'Projects' },
  { x: 0.5, y: Math.sqrt(3) / 2, label: 'Library' },
  { x: -0.5, y: Math.sqrt(3) / 2, label: 'You' },
  { x: -1, y: 0, label: 'Limits' },
  { x: -0.5, y: -Math.sqrt(3) / 2, label: 'Tip jar' },
  { x: 0.5, y: -Math.sqrt(3) / 2, label: 'Help' },
];
const SKILL_ORDER = ['geometry', 'dashboard', 'web-app', 'scripting', 'scanner', 'docs', 'testing', 'service'];
const skillPoints = centres.filter(function (c) { return Math.hypot(c[0], c[1]) > 1.5; }).slice(0, 12);

// --- palette, restraint ---------------------------------------------------
const GOLD = '247,205,140';
const GREEN = '126,226,168';
const BLUE = '158,203,255';
const SKILL_COLOR = {
  geometry: GREEN, dashboard: BLUE, 'web-app': GOLD, scripting: '217,130,43',
  testing: '200,160,255', docs: '180,190,200', scanner: '150,220,220',
  service: '240,180,140', general: GOLD,
};
const IDLE_SPEED = 0.00006;

// --- sprite cache ---------------------------------------------------------
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
  grad.addColorStop(0.18, 'rgba(' + tint + ',0.72)');
  grad.addColorStop(0.55, 'rgba(' + tint + ',0.20)');
  grad.addColorStop(1, 'rgba(' + tint + ',0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(tint, c);
  return c;
}

// --- state ----------------------------------------------------------------
let yaw = 0.35;
let pitch = -0.42;
let zoom = 1;
let dragging = false;
let hovered = -1;
let last = performance.now();
let bloom = 0;
let breath = 0;
let life = 1;
let lookX = 0;
let lookY = 0;
let trail = [];
let trailTotal = 0;
let agents = [];
let focus = null;
let focusUntil = 0;
let simulated = false;
let ripples = [];
// The being's own condition. Everything it knows about itself arrives here.
let self = { energy: 1, memory: 1, wisdom: 0, works: 0, notice: '', awake: 0 };
const counter = document.getElementById('counter');
const caption = document.getElementById('caption');

// Dust: a slow cloud the object hangs inside. Pure atmosphere.
const dust = [];
for (let i = 0; i < 90; i += 1) {
  const a = Math.random() * Math.PI * 2;
  const r = 0.8 + Math.random() * 2.2;
  dust.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: (Math.random() - 0.5) * 2.4, s: 0.4 + Math.random() * 0.8 });
}

const DPR = Math.min(innerWidth < 700 ? 1.5 : 2, window.devicePixelRatio || 1);
// Layers: four depths on a wide screen, two on a phone. Volume costs fill rate.
const LAYERS = innerWidth < 700
  ? [{ z: -0.28, alpha: 0.30, size: 1.07 }, { z: 0.28, alpha: 0.70, size: 0.98 }]
  : [
      { z: -0.52, alpha: 0.18, size: 1.16 },
      { z: -0.17, alpha: 0.34, size: 1.07 },
      { z: 0.17, alpha: 0.52, size: 1.00 },
      { z: 0.52, alpha: 0.74, size: 0.94 },
    ];

function resize() {
  canvas.width = Math.floor(innerWidth * DPR);
  canvas.height = Math.floor(innerHeight * DPR);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
resize();
addEventListener('resize', resize);

function project(x, y, z) {
  const cy = Math.cos(yaw + lookX);
  const sy = Math.sin(yaw + lookX);
  const cp = Math.cos(pitch + lookY);
  const sp = Math.sin(pitch + lookY);
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

/** Bloom from proximity to the work, plus whatever ripple is passing through. */
function heatAt(x, y, now) {
  let heat = 0;
  if (focus !== null) {
    const d = Math.hypot(x - focus.x, y - focus.y);
    heat += Math.max(0, 1 - d / 2.4) * bloom;
  }
  for (const ripple of ripples) {
    const radius = ((now - ripple.t0) / 1000) * 1.5;
    const band = Math.abs(Math.hypot(x, y) - radius);
    if (band < 0.22) heat += (1 - band / 0.22) * ripple.strength * Math.max(0, 1 - radius / 4);
  }
  return heat;
}

function drawHalo(now) {
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const reach = Math.max(innerWidth, innerHeight) * 0.82;
  breath = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.00055);
  // A tired being breathes shallower and glows less; a well one breathes fully.
  life = 0.45 + 0.55 * self.energy * self.memory;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  g.addColorStop(0, 'rgba(' + Math.round(58 * self.memory) + ',' + Math.round(34 * self.memory) + ','
    + Math.round(16 + 24 * (1 - self.memory)) + ',' + (0.52 * life + 0.10 * breath + 0.20 * bloom).toFixed(3) + ')');
  g.addColorStop(0.35, 'rgba(20,15,12,' + (0.88 + 0.05 * breath).toFixed(3) + ')');
  g.addColorStop(0.78, 'rgba(11,11,13,0.98)');
  g.addColorStop(1, '#08080a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // one thin world ring, so the object hangs inside something rather than floating
  ctx.beginPath();
  for (let t = 0; t <= 96; t += 1) {
    const angle = (t / 96) * Math.PI * 2;
    const p = project(Math.cos(angle) * 2.4, Math.sin(angle) * 2.4, 0);
    if (t === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(217,130,43,0.09)';
  ctx.lineWidth = DPR * 0.8;
  ctx.stroke();

  // dust, projected and dimmed by depth
  for (const mote of dust) {
    const p = project(mote.x, mote.y, mote.z);
    ctx.beginPath();
    ctx.arc(p.x, p.y, DPR * mote.s * p.k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,222,190,' + (0.05 + 0.16 * (p.k - 0.5)).toFixed(3) + ')';
    ctx.fill();
  }
}

function drawWeb(now) {
  // Filaments between lattice points: the structure the flower implies.
  ctx.lineWidth = DPR * 0.5;
  for (const fil of filaments) {
    const a = project(fil[0][0], fil[0][1], 0);
    const b = project(fil[1][0], fil[1][1], 0);
    const heat = (heatAt(fil[0][0], fil[0][1], now) + heatAt(fil[1][0], fil[1][1], now)) / 2;
    const closeness = 1 - (fil[2] - 0.36) / 0.36;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(247,205,140,'
      + ((0.02 + self.wisdom * 0.05) + 0.05 * closeness + heat * 0.25).toFixed(3) + ')';
    ctx.stroke();
  }
  for (const point of lattice) {
    const p = project(point[0], point[1], 0);
    const heat = heatAt(point[0], point[1], now);
    ctx.beginPath();
    ctx.arc(p.x, p.y, DPR * (0.7 + 1.7 * (p.k - 0.55)) * (1 + heat * 1.2), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,236,205,' + (0.10 + 0.22 * (p.k - 0.5) + heat * 0.55).toFixed(3) + ')';
    ctx.fill();
  }
}

function drawSpheres(now) {
  for (const layer of LAYERS) {
    const ordered = centres
      .map(function (c) { return { c: c, depth: project(c[0], c[1], layer.z).depth }; })
      .sort(function (p, q) { return p.depth - q.depth; });
    for (const entry of ordered) {
      const c = entry.c;
      const p = project(c[0], c[1], layer.z);
      const isDoor = doors.some(function (d) { return Math.abs(d.x - c[0]) < 1e-6 && Math.abs(d.y - c[1]) < 1e-6; });
      const heat = heatAt(c[0], c[1], now);
      const tint = heat > 0.06 ? GREEN : GOLD;
      const base = Math.min(innerWidth, innerHeight) * 0.30 * 0.90 * layer.size;
      const radius = base * p.k * (isDoor ? 1.08 : 1) * (1 + heat * 0.10);
      const brightness = (layer.alpha * (0.55 + 0.45 * (p.k - 0.55))
        + heat * 0.45 + breath * 0.05 * layer.alpha) * life;
      drawSprite(tint, p.x, p.y, radius, brightness);
    }
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
    drawSprite(SKILL_COLOR[event.skill] || GOLD,
      cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius,
      DPR * (2.2 + 3.2 * freshness) * (0.9 + 0.2 * self.works), (0.08 + 0.5 * freshness) * life);
  });
}

function drawAgents() {
  agents.forEach(function (agent, index) {
    const angle = -Math.PI / 2 + (index / Math.max(1, agents.length)) * Math.PI * 2 + yaw * 0.45;
    const p = project(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62, Math.sin(yaw + index) * 0.36);
    drawSprite(GOLD, p.x, p.y, DPR * (7 + Math.min(7, agent.steps * 0.7)), 0.34);
    const mine = trail.filter(function (step) {
      return step.agent === undefined || step.agent === agent.id;
    }).slice(-8);
    mine.forEach(function (step, i) {
      const hop = (i + 1) * 0.17;
      const q = project(Math.cos(angle) * (1.62 + hop), Math.sin(angle) * (1.62 + hop), 0);
      drawSprite(SKILL_COLOR[step.skill] || GOLD, q.x, q.y, DPR * 2.0, 0.5);
    });
  });
}

function drawDoors(now) {
  doors.forEach(function (door, index) {
    const p = project(door.x, door.y, LAYERS[LAYERS.length - 1].z + 0.02);
    const active = index === hovered;
    const heat = heatAt(door.x, door.y, now);
    const radius = DPR * (active ? 11 : 8) * (0.85 + 0.5 * (p.k - 0.6)) * (1 + heat * 0.35);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(255,238,205,0.92)' : 'rgba(239,220,164,0.42)';
    ctx.shadowColor = 'rgba(217,130,43,0.85)';
    ctx.shadowBlur = DPR * (active ? 20 : 11);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (active || zoom > 1.2) {
      ctx.font = (DPR * 12).toFixed(0) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? 'rgba(255,240,215,0.95)' : 'rgba(220,210,190,0.66)';
      ctx.fillText(door.label, p.x, p.y - radius - DPR * 8);
    }
  });
}

function drawRipples(now) {
  for (const ripple of ripples) {
    const radius = ((now - ripple.t0) / 1000) * 1.5;
    const life = Math.max(0, 1 - radius / 4);
    if (life <= 0) continue;
    ctx.beginPath();
    for (let t = 0; t <= 128; t += 1) {
      const angle = (t / 128) * Math.PI * 2;
      const p = project(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      if (t === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(126,226,168,' + (life * 0.16).toFixed(3) + ')';
    ctx.lineWidth = DPR * 1.1;
    ctx.stroke();
  }
  ripples = ripples.filter(function (ripple) { return ((now - ripple.t0) / 1000) * 1.5 < 4; });
}

function drawFocus(now) {
  if (focus === null) return;
  const p = project(focus.x, focus.y, LAYERS[LAYERS.length - 1].z + 0.03);
  const pulse = 11 + 6 * Math.sin(now * 0.0035);
  ctx.beginPath();
  ctx.arc(p.x, p.y, (15 + pulse) * DPR * (0.72 + 0.4 * (p.k - 0.6)), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(126,226,168,0.72)';
  ctx.lineWidth = DPR * 1.3;
  ctx.shadowColor = 'rgba(126,226,168,0.85)';
  ctx.shadowBlur = DPR * 16;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawMood(now) {
  // The hour tints the whole thing: amber at noon, indigo deep at night. A four
  // percent wash — enough to feel time pass, not enough to notice why.
  const hour = new Date().getHours();
  const dayness = Math.max(0, Math.cos(((hour - 13) / 24) * Math.PI * 2));
  ctx.fillStyle = 'rgba(' + Math.round(60 + 30 * dayness) + ',' + Math.round(34 + 40 * dayness) + ','
    + Math.round(90 - 40 * dayness) + ',' + (0.05 + 0.03 * dayness).toFixed(3) + ')';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  void now;
}

function frame(now) {
  const dt = Math.min(64, now - last);
  last = now;
  if (document.visibilityState === 'hidden') {
    requestAnimationFrame(frame);
    return;
  }
  const live = focus !== null && now < focusUntil;
  bloom += ((live ? 1 : 0) - bloom) * 0.035;

  if (live && !dragging) {
    const targetYaw = -Math.atan2(focus.y, focus.x);
    yaw += (targetYaw - yaw) * 0.03;
    pitch += (-0.30 - pitch) * 0.03;
  } else if (!dragging && !reduce) {
    yaw += dt * IDLE_SPEED;
  }

  drawHalo(now);
  drawWeb(now);
  drawTrail(now);
  drawSpheres(now);
  drawAgents();
  drawDoors(now);
  drawRipples(now);
  drawFocus(now);
  drawMood(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- polling --------------------------------------------------------------
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
    if (counter) counter.textContent = trailTotal > 0 ? trailTotal + ' actions · 76 spheres · 61 points' : '';
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
    ripples.push({ t0: performance.now(), strength: 1 });
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

async function pollVitals() {
  try {
    const response = await fetch('/api/vitals', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const v = await response.json();
    // Fuel: five dollars is a full breath; a dollar is a whisper.
    const fuel = typeof v.fuelUsd === 'number' ? v.fuelUsd : 0;
    const energy = v.fuelAvailable === false ? 0.25 : Math.max(0.18, Math.min(1, fuel / 5));
    self = {
      energy: energy,
      memory: v.memoryOk === false ? 0.35 : 1,
      wisdom: Math.min(1, (v.lessons || 0) / 20),
      works: Math.min(1, (v.projects || 0) / 60),
      notice: typeof v.notice === 'string' ? v.notice : '',
      awake: typeof v.awakeSeconds === 'number' ? v.awakeSeconds : 0,
    };
    const status = document.getElementById('being');
    if (status) {
      // It says how it is, once, in the quietest place on the page.
      const hours = Math.floor(self.awake / 3600);
      const life = hours > 0 ? 'awake ' + hours + 'h' : 'awake ' + Math.max(1, Math.floor(self.awake / 60)) + 'm';
      status.textContent = (self.notice === '' ? '' : self.notice + ' · ') + life
        + ' · ' + (v.projects || 0) + ' works kept · ' + (v.lessons || 0) + ' lessons held';
      status.style.color = self.notice === '' ? '#57575f' : '#8a6a3a';
    }
  } catch {
    /* not knowing how you are is also a state */
  }
}
pollVitals();
setInterval(pollVitals, 15000);

// --- interaction: attention without demands -------------------------------
canvas.addEventListener('pointerdown', function (event) {
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  canvas.dataset.drag = event.clientX + ',' + event.clientY;
});
canvas.addEventListener('pointermove', function (event) {
  // It notices where you are. A few degrees of gaze, no commitment, no target.
  if (!reduce) {
    const targetX = (event.clientX / innerWidth - 0.5) * 0.18;
    const targetY = (event.clientY / innerHeight - 0.5) * 0.12;
    lookX += (targetX - lookX) * 0.06;
    lookY += (targetY - lookY) * 0.06;
  }
  if (dragging) {
    const parts = (canvas.dataset.drag || '0,0').split(',');
    yaw += (event.clientX - Number(parts[0])) * 0.005;
    pitch = Math.max(-1.15, Math.min(1.15, pitch + (event.clientY - Number(parts[1])) * 0.004));
    canvas.dataset.drag = event.clientX + ',' + event.clientY;
    if (hint) hint.style.opacity = '0';
    return;
  }
  let best = -1;
  let bestDistance = 28 * DPR;
  doors.forEach(function (door, index) {
    const p = project(door.x, door.y, LAYERS[LAYERS.length - 1].z + 0.02);
    const distance = Math.hypot(p.x - event.clientX * DPR, p.y - event.clientY * DPR);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  hovered = best;
  canvas.style.cursor = dragging ? 'grabbing' : 'grab';
});
canvas.addEventListener('pointerup', function () {
  // Nothing is clicked here on purpose. A presence that navigates is a menu;
  // leaving is what /map is for.
  dragging = false;
});
addEventListener('pointerleave', function () { lookX = 0; lookY = 0; });
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
 * @returns the page HTML.
 */
export function flowerPageHtml(): string {
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
  .being{position:fixed;left:0;right:0;top:3.4rem;text-align:center;font-size:.64rem;
    color:#57575f;letter-spacing:.12em;transition:color .8s ease}
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
<p class="being" id="being"></p>
<p class="hint" id="hint"><b>drag</b> to turn it · <b>scroll</b> to come closer · nothing to press</p>
<a class="plain" href="/map">where everything is →</a>
<script>${FLOWER_SCRIPT}</script>
</body></html>`
}
