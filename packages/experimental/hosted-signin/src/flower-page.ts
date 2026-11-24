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

// --- shapes ---------------------------------------------------------------
// Four bodies, one presence. The two candidates under review are the buckyball
// and the 3-fold icosahedron; the flower is what it came from.
//   ?shape=bucky | threefold | icosa | dodeca | flower
const SHAPE = (new URLSearchParams(location.search).get('shape') || 'bucky').toLowerCase();
const PHI = (1 + Math.sqrt(5)) / 2;

const norm = function (v) {
  const r = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / r, v[1] / r, v[2] / r];
};
const lerp3 = function (a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};
const dist3 = function (a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};
const dedupe = function (list) {
  const out = [];
  for (const v of list) {
    if (!out.some(function (q) { return dist3(q, v) < 1e-6; })) out.push(v);
  }
  return out;
};
const edgesOf = function (vertices) {
  let shortest = Infinity;
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const d = dist3(vertices[i], vertices[j]);
      if (d < shortest) shortest = d;
    }
  }
  const out = [];
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      if (dist3(vertices[i], vertices[j]) < shortest * 1.12) out.push([vertices[i], vertices[j]]);
    }
  }
  return out;
};
const trianglesOf = function (vertices) {
  let shortest = Infinity;
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const d = dist3(vertices[i], vertices[j]);
      if (d < shortest) shortest = d;
    }
  }
  const near = function (a, b) { return dist3(a, b) < shortest * 1.12; };
  const out = [];
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      for (let k = j + 1; k < vertices.length; k += 1) {
        if (near(vertices[i], vertices[j]) && near(vertices[j], vertices[k]) && near(vertices[i], vertices[k])) {
          out.push([vertices[i], vertices[j], vertices[k]]);
        }
      }
    }
  }
  return out;
};

const ICOSA = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1],
].map(norm);
const DODECA = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  [0, 1 / PHI, PHI], [0, 1 / PHI, -PHI], [0, -1 / PHI, PHI], [0, -1 / PHI, -PHI],
  [1 / PHI, PHI, 0], [1 / PHI, -PHI, 0], [-1 / PHI, PHI, 0], [-1 / PHI, -PHI, 0],
  [PHI, 0, 1 / PHI], [PHI, 0, -1 / PHI], [-PHI, 0, 1 / PHI], [-PHI, 0, -1 / PHI],
].map(norm);

const ICO_EDGES = edgesOf(ICOSA);
const ICO_FACES = trianglesOf(ICOSA);

// The buckyball: truncate every corner of the icosahedron. Two points one third
// along each edge give sixty vertices, ninety edges, twelve pentagons and twenty
// hexagons — the most reference points of anything here.
const BUCKY = dedupe(ICO_EDGES.flatMap(function (edge) {
  return [norm(lerp3(edge[0], edge[1], 1 / 3)), norm(lerp3(edge[0], edge[1], 2 / 3))];
}));
const BUCKY_PENTA = ICOSA.map(norm);
const BUCKY_HEXA = ICO_EDGES.map(function (edge) {
  return norm(lerp3(edge[0], edge[1], 0.5));
});
const BUCKY_PANELS = BUCKY_PENTA.concat(BUCKY_HEXA);

// The 3-fold icosahedron: every face split into three around its centre. Thirty
// two vertices, ninety edges, sixty triangular panels — threefold symmetry.
const THREEFOLD = dedupe(ICOSA.concat(ICO_FACES.map(function (face) {
  return norm([
    (face[0][0] + face[1][0] + face[2][0]) / 3,
    (face[0][1] + face[1][1] + face[2][1]) / 3,
    (face[0][2] + face[1][2] + face[2][2]) / 3,
  ]);
})));
const THREEFOLD_PANELS = ICO_FACES.map(function (face) {
  return norm([
    (face[0][0] + face[1][0] + face[2][0]) / 3,
    (face[0][1] + face[1][1] + face[2][1]) / 3,
    (face[0][2] + face[1][2] + face[2][2]) / 3,
  ]);
});

// The flower, wrapped onto the sphere: nineteen circles carried from the flat
// mark onto the surface. This is the transform — the logo becomes the skin.
function flowerWrap(radius, circles) {
  const out = [];
  const centres = [];
  const A = [1, 0];
  const B = [0.5, Math.sqrt(3) / 2];
  for (let i = -2; i <= 2; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      const x = i * A[0] + j * B[0];
      const y = i * A[1] + j * B[1];
      if (Math.hypot(x, y) <= 2 + 1e-6) centres.push([x, y]);
    }
  }
  const scale = radius / 2.0;
  for (const c of centres) {
    for (const hemis of [1, -1]) {
      const line = [];
      for (let t = 0; t <= circles * 2; t += 1) {
        const angle = (t / (circles * 2)) * Math.PI * 2;
        const px = (c[0] + Math.cos(angle)) * scale;
        const py = (c[1] + Math.sin(angle)) * scale;
        const rr = Math.hypot(px, py);
        if (rr > radius) { line.push(null); continue; }
        line.push([px, py, hemis * Math.sqrt(Math.max(0, radius * radius - rr * rr))]);
      }
      out.push(line);
    }
  }
  return out;
}

const BODY = SHAPE === 'icosa'
  ? { name: 'icosahedron', vertices: ICOSA, radius: 1, panels: [] }
  : SHAPE === 'dodeca'
    ? { name: 'dodecahedron', vertices: DODECA, radius: 1, panels: [] }
    : SHAPE === 'threefold'
      ? { name: '3-fold icosahedron', vertices: THREEFOLD, radius: 1, panels: THREEFOLD_PANELS }
      : SHAPE === 'flower'
        ? {
            name: 'flower ball',
            vertices: flowerWrap(1, 8).flat().filter(Boolean).map(norm),
            radius: 1,
            panels: [],
          }
        : { name: 'buckyball', vertices: BUCKY, radius: 1, panels: BUCKY_PANELS };
const VERTICES = BODY.vertices;
const EDGES = edgesOf(VERTICES);
const FLOWER_SKIN = flowerWrap(BODY.radius * 0.995, 6);

// Centring: one fit against the body's own radius, and the exact middle of the
// viewport. Every body occupies the same share of the smaller dimension.
const FIT = 0.34;

const DOOR_NAMES = ['Talk', 'Projects', 'Library', 'You', 'Limits', 'Tip jar', 'Help'];
const doors = DOOR_NAMES.map(function (label, index) {
  const v = VERTICES[index % VERTICES.length];
  return { x: v[0], y: v[1], z: v[2], label: label };
});
const SKILL_ORDER = ['geometry', 'dashboard', 'web-app', 'scripting', 'scanner', 'docs', 'testing', 'service'];
const skillPoints = VERTICES.slice(7, 15);

const GOLD = '247,205,140';
const GREEN = '126,226,168';
const BLUE = '158,203,255';
const SKILL_COLOR = {
  geometry: GREEN, dashboard: BLUE, 'web-app': GOLD, scripting: '217,130,43',
  testing: '200,160,255', docs: '180,190,200', scanner: '150,220,220',
  service: '240,180,140', general: GOLD,
};
// Idle movement, thirty percent quicker than it was. Still slow enough to breathe.
const IDLE_SPEED = 0.00006 * 1.3;
const FRICTION = 0.955;
const LEVELS = ['dormant', 'stirring', 'working', 'busy', 'surging', 'at full stretch'];

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

let yaw = 0.35;
let pitch = -0.42;
let roll = 0;
let velYaw = 0;
let velPitch = 0;
let velRoll = 0;
let zoom = 1;
let dragging = false;
let dragMode = 'turn';
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
let self = { energy: 1, memory: 1, wisdom: 0, works: 0, notice: '', awake: 0 };
let confessTimer = 0;
let simLevel = 0;
const counter = document.getElementById('counter');
const caption = document.getElementById('caption');

const dust = [];
for (let i = 0; i < 90; i += 1) {
  const a = Math.random() * Math.PI * 2;
  const b = Math.acos(2 * Math.random() - 1);
  const r = 1.4 + Math.random() * 2.2;
  dust.push({ x: Math.sin(b) * Math.cos(a) * r, y: Math.sin(b) * Math.sin(a) * r, z: Math.cos(b) * r, s: 0.4 + Math.random() * 0.8 });
}

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
  const ya = yaw + lookX;
  const pa = pitch + lookY;
  const ra = roll;
  const cy = Math.cos(ya);
  const sy = Math.sin(ya);
  const cp = Math.cos(pa);
  const sp = Math.sin(pa);
  const cr = Math.cos(ra);
  const sr = Math.sin(ra);
  const x1 = x * cr - y * sr;
  const y1 = x * sr + y * cr;
  const x2 = x1 * cy + z * sy;
  const z2 = -x1 * sy + z * cy;
  const y3 = y1 * cp - z2 * sp;
  const z3 = y1 * sp + z2 * cp;
  const distance = 6.4;
  const scale = zoom * Math.min(innerWidth, innerHeight) * (FIT / BODY.radius);
  const k = distance / (distance + z3);
  return { x: innerWidth / 2 + x2 * scale * k, y: innerHeight / 2 + y3 * scale * k, k: k, depth: z3 };
}

function drawSprite(tint, x, y, radius, alpha) {
  const sprite = sphereSprite(tint);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function heatAt(x, y, z, now) {
  let heat = 0;
  if (focus !== null) {
    const d = Math.hypot(x - focus.x, y - focus.y, z - focus.z);
    heat += Math.max(0, 1 - d / 1.1) * bloom;
  }
  for (const ripple of ripples) {
    const radius = ((now - ripple.t0) / 1000) * 0.9;
    const band = Math.abs(Math.hypot(x, y, z) - radius);
    if (band < 0.12) heat += (1 - band / 0.12) * ripple.strength * Math.max(0, 1 - radius / 2.4);
  }
  return heat;
}

function drawHalo(now) {
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const reach = Math.max(innerWidth, innerHeight) * 0.82;
  breath = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.00055);
  life = 0.45 + 0.55 * self.energy * self.memory;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  g.addColorStop(0, 'rgba(' + Math.round(58 * self.memory) + ',' + Math.round(34 * self.memory) + ','
    + Math.round(16 + 24 * (1 - self.memory)) + ',' + (0.52 * life + 0.10 * breath + 0.20 * bloom).toFixed(3) + ')');
  g.addColorStop(0.35, 'rgba(20,15,12,' + (0.88 + 0.05 * breath).toFixed(3) + ')');
  g.addColorStop(0.78, 'rgba(11,11,13,0.98)');
  g.addColorStop(1, '#08080a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const mote of dust) {
    const p = project(mote.x, mote.y, mote.z);
    ctx.beginPath();
    ctx.arc(p.x, p.y, DPR * mote.s * p.k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,222,190,' + (0.05 + 0.15 * (p.k - 0.5)).toFixed(3) + ')';
    ctx.fill();
  }
}

function drawFlowerSkin() {
  // The transform: the flat flower carried onto the surface, both hemispheres.
  ctx.lineWidth = DPR * 0.55;
  for (const line of FLOWER_SKIN) {
    ctx.beginPath();
    let started = false;
    for (const point of line) {
      if (point === null) { started = false; continue; }
      const p = project(point[0], point[1], point[2]);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(247,205,140,' + (0.045 + 0.03 * breath).toFixed(3) + ')';
    ctx.stroke();
  }
}

function drawPanels(now) {
  for (const panel of BODY.panels) {
    const p = project(panel[0], panel[1], panel[2]);
    const near = Math.max(0, Math.min(1, (p.k - 0.62) / 0.5));
    const radius = DPR * 1.8 * p.k;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(158,203,255,' + (0.05 + 0.16 * near + 0.02 * breath).toFixed(3) + ')';
    ctx.lineWidth = DPR * 0.7;
    ctx.stroke();
  }
  void now;
}

function drawEdges(now) {
  const drawn = EDGES.map(function (edge) {
    const a = project(edge[0][0], edge[0][1], edge[0][2]);
    const b = project(edge[1][0], edge[1][1], edge[1][2]);
    return { a: a, b: b, near: (a.k + b.k) / 2 };
  }).sort(function (p, q) { return p.near - q.near; });
  for (const edge of drawn) {
    const heat = (heatAt(edge.a.x, edge.a.y, 0, now) + heatAt(edge.b.x, edge.b.y, 0, now)) / 2;
    const glow = Math.max(0, Math.min(1, (edge.near - 0.62) / 0.5));
    ctx.beginPath();
    ctx.moveTo(edge.a.x, edge.a.y);
    ctx.lineTo(edge.b.x, edge.b.y);
    ctx.strokeStyle = 'rgba(247,205,140,'
      + ((0.035 + self.wisdom * 0.045) + glow * 0.20 + heat * 0.30).toFixed(3) + ')';
    ctx.lineWidth = DPR * (0.6 + 1.0 * glow);
    ctx.stroke();
  }
}

function drawVertices(now) {
  const ordered = VERTICES.map(function (v) {
    const p = project(v[0], v[1], v[2]);
    return { v: v, p: p, depth: p.depth };
  }).sort(function (a, b) { return a.depth - b.depth; });
  for (const entry of ordered) {
    const heat = heatAt(entry.v[0], entry.v[1], entry.v[2], now);
    const isDoor = doors.some(function (d) {
      return Math.abs(d.x - entry.v[0]) < 1e-9 && Math.abs(d.y - entry.v[1]) < 1e-9 && Math.abs(d.z - entry.v[2]) < 1e-9;
    });
    const tint = heat > 0.06 ? GREEN : GOLD;
    const base = Math.min(innerWidth, innerHeight) * 0.020 * (FIT / BODY.radius) * (isDoor ? 1.7 : 1);
    const radius = base * entry.p.k * (1 + heat * 0.15);
    const depthFade = 0.28 + 0.72 * Math.max(0, Math.min(1, (entry.p.k - 0.62) / 0.5));
    drawSprite(tint, entry.p.x, entry.p.y, radius, (depthFade + heat * 0.4) * life);
  }
}

function drawCentres(now) {
  ctx.lineWidth = DPR * 0.45;
  for (const v of VERTICES) {
    const a = project(0, 0, 0);
    const b = project(v[0], v[1], v[2]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(158,203,255,' + (0.010 + 0.030 * Math.max(0, b.k - 0.62) + 0.010 * breath).toFixed(3) + ')';
    ctx.stroke();
  }
  void now;
}

function drawTrail(now) {
  if (trail.length === 0) return;
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const base = Math.min(innerWidth, innerHeight) * (FIT / BODY.radius) * 1.55;
  trail.forEach(function (event, index) {
    const age = Math.max(0, now - event.at);
    const freshness = Math.max(0.06, 1 - age / 600000);
    const turn = index / 40;
    const angle = -Math.PI / 2 + (turn % 1) * Math.PI * 2;
    const radius = base * (0.70 + 0.05 * Math.min(4, Math.floor(turn)) + 0.10 * (turn % 1));
    drawSprite(SKILL_COLOR[event.skill] || GOLD,
      cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius,
      DPR * (2.0 + 2.6 * freshness) * (0.9 + 0.2 * self.works), (0.07 + 0.4 * freshness) * life);
  });
}

function drawAgents() {
  agents.forEach(function (agent, index) {
    const angle = -Math.PI / 2 + (index / Math.max(1, agents.length)) * Math.PI * 2 + yaw * 0.45;
    const orbit = BODY.radius * 1.22;
    const p = project(Math.cos(angle) * orbit, Math.sin(angle) * orbit, Math.sin(yaw + index) * 0.4);
    drawSprite(GOLD, p.x, p.y, DPR * (6 + Math.min(6, agent.steps * 0.6)), 0.32);
    const mine = trail.filter(function (step) {
      return step.agent === undefined || step.agent === agent.id;
    }).slice(-8);
    mine.forEach(function (step, i) {
      const hop = (i + 1) * 0.13;
      const q = project(Math.cos(angle) * (orbit + hop), Math.sin(angle) * (orbit + hop), 0);
      drawSprite(SKILL_COLOR[step.skill] || GOLD, q.x, q.y, DPR * 1.9, 0.45);
    });
  });
}

function drawDoors() {
  doors.forEach(function (door, index) {
    const p = project(door.x, door.y, door.z);
    const active = index === hovered;
    const radius = DPR * (active ? 9 : 6) * (0.85 + 0.5 * (p.k - 0.6));
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(255,238,205,0.92)' : 'rgba(239,220,164,0.36)';
    ctx.shadowColor = 'rgba(217,130,43,0.85)';
    ctx.shadowBlur = DPR * (active ? 18 : 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (active || zoom > 1.15) {
      ctx.font = (DPR * 11).toFixed(0) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? 'rgba(255,240,215,0.95)' : 'rgba(220,210,190,0.6)';
      ctx.fillText(door.label, p.x, p.y - radius - DPR * 7);
    }
  });
}

function drawRipples(now) {
  for (const ripple of ripples) {
    const radius = ((now - ripple.t0) / 1000) * 0.9;
    const left = Math.max(0, 1 - radius / 2.4);
    if (left <= 0) continue;
    ctx.beginPath();
    for (let t = 0; t <= 128; t += 1) {
      const angle = (t / 128) * Math.PI * 2;
      const p = project(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      if (t === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(126,226,168,' + (left * 0.16).toFixed(3) + ')';
    ctx.lineWidth = DPR * 1.1;
    ctx.stroke();
  }
  ripples = ripples.filter(function (ripple) { return ((now - ripple.t0) / 1000) * 0.9 < 2.4; });
}

function drawMood() {
  const hour = new Date().getHours();
  const dayness = Math.max(0, Math.cos(((hour - 13) / 24) * Math.PI * 2));
  ctx.fillStyle = 'rgba(' + Math.round(60 + 30 * dayness) + ',' + Math.round(34 + 40 * dayness) + ','
    + Math.round(90 - 40 * dayness) + ',' + (0.05 + 0.03 * dayness).toFixed(3) + ')';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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

  const spinning = Math.abs(velYaw) + Math.abs(velPitch) + Math.abs(velRoll) > 0.00008;
  if (!dragging && spinning) {
    yaw += velYaw * dt;
    pitch += velPitch * dt;
    roll += velRoll * dt;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
    velYaw *= FRICTION;
    velPitch *= FRICTION;
    velRoll *= FRICTION;
  } else if (!dragging) {
    velYaw = 0;
    velPitch = 0;
    velRoll = 0;
    if (live) {
      const targetYaw = -Math.atan2(focus.y, focus.x);
      yaw += (targetYaw - yaw) * 0.03;
      pitch += (-0.30 - pitch) * 0.03;
      roll += (0 - roll) * 0.03;
    } else if (!reduce) {
      yaw += dt * IDLE_SPEED;
      roll += (0 - roll) * 0.01;
    }
  }

  drawHalo(now);
  drawFlowerSkin();
  drawPanels(now);
  drawCentres(now);
  drawEdges(now);
  drawTrail(now);
  drawVertices(now);
  drawAgents();
  drawDoors();
  drawRipples(now);
  drawMood();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- simulation: a slider that ramps the intelligence levels ---------------
function applyLevel(level) {
  simLevel = level;
  const nameEl = document.getElementById('levelName');
  if (nameEl) nameEl.textContent = LEVELS[level] || '';
  if (level === 0) {
    trail = [];
    agents = [];
    focus = null;
    simulated = true;
    return;
  }
  const now = Date.now();
  const pool = ['geometry', 'dashboard', 'web-app', 'scripting', 'testing', 'docs', 'scanner', 'service'];
  const count = level * 6;
  trail = [];
  for (let i = 0; i < count; i += 1) {
    trail.push({
      skill: pool[(i * (level + 1)) % pool.length],
      at: now - (count - i) * (9000 / level),
      agent: 'sim-' + (i % Math.min(6, level)),
    });
  }
  agents = [];
  for (let a = 0; a < Math.min(6, level); a += 1) {
    agents.push({ id: 'sim-' + a, steps: 2 + a * 2, lastSkill: pool[a % pool.length] });
  }
  const point = skillPoints[level % skillPoints.length];
  focus = { x: point[0], y: point[1], z: point[2], label: 'simulated level ' + level + ' — ' + (LEVELS[level] || '') };
  focusUntil = performance.now() + 600000;
  ripples.push({ t0: performance.now(), strength: 1 });
  simulated = true;
  if (counter) counter.textContent = BODY.name + ' · ' + VERTICES.length + ' vertices · ' + EDGES.length + ' edges';
}
const slider = document.getElementById('level');
if (slider) {
  slider.addEventListener('input', function () { applyLevel(Number(slider.value)); });
  applyLevel(Number(slider.value));
}

// --- live data -------------------------------------------------------------
async function poll() {
  try {
    const response = await fetch('/api/one-turn/activity', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    if (simLevel > 0) return;
    trail = Array.isArray(data.trail) ? data.trail : [];
    agents = Array.isArray(data.agents) ? data.agents : [];
    trailTotal = data.counts && typeof data.counts.total === 'number' ? data.counts.total : trail.length;
    simulated = trail.length === 0;
    if (counter) counter.textContent = BODY.name + ' · ' + VERTICES.length + ' vertices · ' + EDGES.length
      + ' edges' + (trailTotal > 0 ? ' · ' + trailTotal + ' actions' : '');
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
    focus = { x: point[0], y: point[1], z: point[2], label: hot.label };
    focusUntil = performance.now() + 25000;
    ripples.push({ t0: performance.now(), strength: 1 });
    if (caption) { caption.textContent = hot.label; caption.style.opacity = '1'; }
  } catch { /* a live view that fails is still a flower */ }
}
poll();
setInterval(poll, 2500);

async function pollVitals() {
  try {
    const response = await fetch('/api/vitals', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const v = await response.json();
    const fuel = typeof v.fuelUsd === 'number' ? v.fuelUsd : 0;
    self = {
      energy: v.fuelAvailable === false ? 0.25 : Math.max(0.18, Math.min(1, fuel / 5)),
      memory: v.memoryOk === false ? 0.35 : 1,
      wisdom: Math.min(1, (v.lessons || 0) / 20),
      works: Math.min(1, (v.projects || 0) / 60),
      notice: typeof v.notice === 'string' ? v.notice : '',
      awake: typeof v.awakeSeconds === 'number' ? v.awakeSeconds : 0,
    };
    const confess = document.getElementById('confession');
    if (confess && typeof v.confession === 'string' && v.confession !== '') {
      confess.textContent = v.confession;
      confess.style.opacity = '0.85';
      clearTimeout(confessTimer);
      confessTimer = setTimeout(function () { confess.style.opacity = '0'; }, 14000);
    }
    const status = document.getElementById('being');
    if (status) {
      const hours = Math.floor(self.awake / 3600);
      const howLong = hours > 0 ? 'awake ' + hours + 'h' : 'awake ' + Math.max(1, Math.floor(self.awake / 60)) + 'm';
      status.textContent = (self.notice === '' ? '' : self.notice + ' · ') + howLong
        + ' · ' + (v.projects || 0) + ' works kept · ' + (v.lessons || 0) + ' lessons held';
      status.style.color = self.notice === '' ? '#57575f' : '#8a6a3a';
    }
  } catch { /* not knowing how you are is also a state */ }
}
pollVitals();
setInterval(pollVitals, 15000);

// --- interaction -----------------------------------------------------------
canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
canvas.addEventListener('pointerdown', function (event) {
  dragging = true;
  dragMode = event.button === 2 || event.shiftKey ? 'roll' : 'turn';
  velYaw = 0; velPitch = 0; velRoll = 0;
  canvas.setPointerCapture(event.pointerId);
  canvas.dataset.drag = event.clientX + ',' + event.clientY;
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', function (event) {
  if (!reduce) {
    lookX += ((event.clientX / innerWidth - 0.5) * 0.16 - lookX) * 0.06;
    lookY += ((event.clientY / innerHeight - 0.5) * 0.11 - lookY) * 0.06;
  }
  if (!dragging) {
    let best = -1;
    let bestDistance = 30 * DPR;
    doors.forEach(function (door, index) {
      const p = project(door.x, door.y, door.z);
      const distance = Math.hypot(p.x - event.clientX * DPR, p.y - event.clientY * DPR);
      if (distance < bestDistance) { bestDistance = distance; best = index; }
    });
    hovered = best;
    return;
  }
  const parts = (canvas.dataset.drag || '0,0').split(',');
  const dx = event.clientX - Number(parts[0]);
  const dy = event.clientY - Number(parts[1]);
  if (dragMode === 'roll') {
    roll += dx * 0.006;
    velRoll = dx * 0.0009;
  } else {
    yaw += dx * 0.005;
    pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * 0.004));
    velYaw = dx * 0.0008;
    velPitch = dy * 0.0006;
  }
  canvas.dataset.drag = event.clientX + ',' + event.clientY;
  if (hint) hint.style.opacity = '0';
});
canvas.addEventListener('pointerup', function () {
  dragging = false;
  canvas.style.cursor = 'grab';
});
addEventListener('pointerleave', function () { lookX = 0; lookY = 0; });
canvas.addEventListener('wheel', function (event) {
  event.preventDefault();
  zoom = Math.max(0.6, Math.min(2.2, zoom * (event.deltaY > 0 ? 0.95 : 1.05)));
}, { passive: false });
addEventListener('keydown', function (event) {
  if (event.key === 'ArrowLeft') yaw -= 0.1;
  if (event.key === 'ArrowRight') yaw += 0.1;
  if (event.key === 'ArrowUp') pitch = Math.max(-1.5, pitch - 0.07);
  if (event.key === 'ArrowDown') pitch = Math.min(1.5, pitch + 0.07);
  if (event.key === 'q' || event.key === 'Q') roll -= 0.1;
  if (event.key === 'e' || event.key === 'E') roll += 0.1;
  if (event.key === 'r' || event.key === 'R') { yaw = 0.35; pitch = -0.42; roll = 0; }
});
setTimeout(function () { if (hint) hint.style.opacity = '0'; }, 8000);
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
  .confession{position:fixed;left:0;right:0;top:4rem;text-align:center;font-size:.72rem;
    color:#8a6a3a;font-style:italic;opacity:0;transition:opacity 3s ease;padding:0 2rem}
  .sim-ui{position:fixed;left:1.1rem;bottom:1.2rem;display:flex;align-items:center;gap:.55rem;
    font-size:.68rem;color:#6f6f78;letter-spacing:.06em;background:rgba(12,12,14,.6);
    border:1px solid #24242b;border-radius:999px;padding:.3rem .8rem;backdrop-filter:blur(6px)}
  .sim-ui input{width:8rem;accent-color:#C1440E}
  .sim-ui #levelName{color:#EFDCA4;min-width:5.6rem}
  .shapes{position:fixed;left:0;right:0;bottom:1.2rem;text-align:center;font-size:.7rem;
    color:#5f5f68;letter-spacing:.06em;pointer-events:none}
  .shapes a{pointer-events:auto}
  .shapes a{color:#6f6f78;text-decoration:none}
  @media (max-width: 640px){ .shapes{display:none} .sim-ui{left:50%;transform:translateX(-50%)} }
  .shapes a:hover{color:#7ee2a8}
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
<p class="confession" id="confession"></p>
<p class="hint" id="hint"><b>drag</b> to turn it · <b>shift-drag</b> (or right-drag) to roll · <b>scroll</b> closer · throw it and it keeps spinning</p>
<div class="sim-ui">
    <label for="level">simulate intelligence</label>
    <input type="range" id="level" min="0" max="5" step="1" value="0">
    <span id="levelName">dormant</span>
  </div>
  <span class="shapes"><a href="/flower?shape=bucky">buckyball</a> · <a href="/flower?shape=threefold">3-fold icosahedron</a> · <a href="/flower?shape=flower">flower</a> &nbsp;|&nbsp; <a href="/map">where everything is →</a></span>
<script>${FLOWER_SCRIPT}</script>
</body></html>`
}
