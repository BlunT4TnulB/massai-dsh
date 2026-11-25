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
const params = new URLSearchParams(location.search);
const EMBEDDED = params.get('embed') === '1';
const SHAPE = (params.get('shape') || 'galaxy').toLowerCase();

// --- the galaxy -----------------------------------------------------------
// A fixed, symmetrical sphere of interlocking circles. The circles come from the
// icosahedron's own symmetry: six axes through opposite vertices, fifteen through
// opposite edges, ten through opposite faces. Thirty-one circles, and every pair
// of them crosses twice — hundreds of intersections, all rooted in the same
// geometry as the nineteen circles of the mark.
const PHI = (1 + Math.sqrt(5)) / 2;
const norm = function (v) {
  const r = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / r, v[1] / r, v[2] / r];
};
const cross = function (a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
};
const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };

const ICOSA = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1],
].map(norm);

const axes = [];
const addAxis = function (v, kind) {
  const n = norm(v);
  if (axes.some(function (a) { return Math.abs(dot(a.n, n)) > 0.9999; })) return;
  axes.push({ n: n, kind: kind });
};
// six through the vertices
for (const v of ICOSA) addAxis(v, 'vertex');
// fifteen through the edges
for (let i = 0; i < ICOSA.length; i += 1) {
  for (let j = i + 1; j < ICOSA.length; j += 1) {
    const d = Math.hypot(ICOSA[i][0] - ICOSA[j][0], ICOSA[i][1] - ICOSA[j][1], ICOSA[i][2] - ICOSA[j][2]);
    if (d < 1.2) addAxis([ICOSA[i][0] + ICOSA[j][0], ICOSA[i][1] + ICOSA[j][1], ICOSA[i][2] + ICOSA[j][2]], 'edge');
  }
}
// ten through the faces
for (let i = 0; i < ICOSA.length; i += 1) {
  for (let j = i + 1; j < ICOSA.length; j += 1) {
    for (let k = j + 1; k < ICOSA.length; k += 1) {
      const near = function (a, b) {
        return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1.2;
      };
      if (near(ICOSA[i], ICOSA[j]) && near(ICOSA[j], ICOSA[k]) && near(ICOSA[i], ICOSA[k])) {
        addAxis([
          ICOSA[i][0] + ICOSA[j][0] + ICOSA[k][0],
          ICOSA[i][1] + ICOSA[j][1] + ICOSA[k][1],
          ICOSA[i][2] + ICOSA[j][2] + ICOSA[k][2],
        ], 'face');
      }
    }
  }
}

// Every intersection, deduplicated on a small grid: this is the galaxy's matter.
const nodes = [];
const seen = new Set();
const keyOf = function (v) {
  return Math.round(v[0] * 200) + ',' + Math.round(v[1] * 200) + ',' + Math.round(v[2] * 200);
};
for (let i = 0; i < axes.length; i += 1) {
  for (let j = i + 1; j < axes.length; j += 1) {
    const line = cross(axes[i].n, axes[j].n);
    if (Math.hypot(line[0], line[1], line[2]) < 1e-6) continue;
    for (const sign of [1, -1]) {
      const p = norm([line[0] * sign, line[1] * sign, line[2] * sign]);
      const key = keyOf(p);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ p: p, a: i, b: j });
    }
  }
}

// The nineteen circles of the mark, carried onto the sphere: the root of it.
function flowerPaths() {
  const out = [];
  const A = [1, 0];
  const B = [0.5, Math.sqrt(3) / 2];
  const centres = [];
  for (let i = -2; i <= 2; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      const x = i * A[0] + j * B[0];
      const y = i * A[1] + j * B[1];
      if (Math.hypot(x, y) <= 2 + 1e-6) centres.push([x, y]);
    }
  }
  const scale = 1 / 2.0;
  for (const c of centres) {
    for (const hemis of [1, -1]) {
      const line = [];
      for (let t = 0; t <= 28; t += 1) {
        const angle = (t / 28) * Math.PI * 2;
        const px = (c[0] + Math.cos(angle)) * scale;
        const py = (c[1] + Math.sin(angle)) * scale;
        const rr = Math.hypot(px, py);
        if (rr > 0.995) { line.push(null); continue; }
        line.push([px, py, hemis * Math.sqrt(Math.max(0, 1 - rr * rr))]);
      }
      out.push(line);
    }
  }
  return out;
}
const FLOWER = flowerPaths();

const GOLD = '247,205,140';
const GREEN = '126,226,168';
const BLUE = '158,203,255';
const SKILL_ORDER = ['geometry', 'dashboard', 'web-app', 'scripting', 'scanner', 'docs', 'testing', 'service'];
const IDLE_SPEED = 0.00006 * 1.3;
const FRICTION = 0.955;
const LEVELS = ['dormant', 'stirring', 'working', 'busy', 'surging', 'at full stretch'];
const FIT = EMBEDDED ? 0.46 : 0.40;

/**
 * How far inside the body you are, 0 at rest and 1 deep in.
 *
 * This is the one number the whole composition answers to: as it rises the
 * circles step back, the fog thickens, the dust comes close and a soft vignette
 * encloses the view. Looking at a sphere becomes standing within one.
 * @param z - the current zoom factor.
 * @returns the inside factor, clamped to 0..1.
 */
function insideOf(z) {
  return Math.max(0, Math.min(1, (z - 1.75) / 2.6));
}
// Zoom bands: each passed threshold reveals the next galaxy inside the last.
const ZOOM_BANDS = [1.5, 2.4, 3.8, 5.6, 8.0, 11.0];
const ANCHOR = EMBEDDED ? 0.40 : 0.5;

const spriteCache = new Map();

/** Soft fog blobs: one sprite per nebula tint, drawn scaled and additively. */
const fogCache = new Map();
function fogSprite(tint) {
  if (fogCache.has(tint)) return fogCache.get(tint);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(' + tint + ',0.55)');
  grad.addColorStop(0.42, 'rgba(' + tint + ',0.20)');
  grad.addColorStop(0.75, 'rgba(' + tint + ',0.05)');
  grad.addColorStop(1, 'rgba(' + tint + ',0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  fogCache.set(tint, c);
  return c;
}

// The fog: a handful of enormous soft blobs wandering on slow Lissajous paths.
// They are not the mind, they are the air the mind hangs in.
const FOG = [
  { tint: '214,150,90', radius: 0.95, ax: 0.30, ay: 0.22, sx: 0.000021, sy: 0.000017, phase: 0.0 },
  { tint: '150,120,200', radius: 0.80, ax: 0.26, ay: 0.30, sx: -0.000016, sy: 0.000023, phase: 1.7 },
  { tint: '110,190,170', radius: 0.62, ax: 0.34, ay: 0.18, sx: 0.000019, sy: -0.000014, phase: 3.1 },
  { tint: '240,190,120', radius: 1.15, ax: 0.20, ay: 0.26, sx: -0.000011, sy: -0.000019, phase: 4.6 },
];
function glowSprite(tint) {
  if (spriteCache.has(tint)) return spriteCache.get(tint);
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,250,240,0.95)');
  grad.addColorStop(0.25, 'rgba(' + tint + ',0.55)');
  grad.addColorStop(1, 'rgba(' + tint + ',0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(tint, c);
  return c;
}

// A randomised pose for the welcome orb, so the first sight of the mind is never
// the same twice. Inside the app the pose stays fixed, because the door lives at
// a known place there.
// The geometry is fixed — it is always the same flower — but the weather is not.
// Each load draws its own palette weight, breath period, drift speed, fog paths
// and starting pose, so two visits are the same being in a different mood.
const SPIN = params.get('spin') === '1';
const random = Math.random;
const seedAngle = function (spread) { return (random() - 0.5) * spread; };
const MOOD = random();
const BREATH_SPEED = 0.00042 + random() * 0.00026;
const DRIFT = 0.78 + random() * 0.5;
const FOG_ENERGY = 0.75 + random() * 0.6;
let yaw = 0.4 + seedAngle(SPIN ? Math.PI * 1.4 : 1.1);
let pitch = -0.35 + seedAngle(0.9);
let roll = seedAngle(0.8);
let velYaw = 0;
let velPitch = 0;
let velRoll = 0;
let zoom = 1;
let dragging = false;
let dragMode = 'turn';
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
let thoughtTimer = 0;
// The screensaver: when nobody is driving, the mind drives. Any real input takes
// the wheel straight back, without moving the camera the user left.
let lastInput = performance.now();
let screensaver = false;
// Adaptive quality: the frame is measured continuously and layers are shed in
// order of cost-before-beauty. A phone in a car park gets the same mind, at a
// weight it can actually carry.
let frameAvg = 16;
let quality = 1;
let qualityTick = 0;
let exploreAt = 0;
let exploreNode = -1;
let simLevel = 0;
let hoverNode = -1;
let diveNode = -1;
let diveGlow = 0;
let auto = true;
let pointers = new Map();
let pinchStart = 0;
let zoomAtPinch = 1;
const KIND = { vertex: 'vertex', edge: 'edge', face: 'face' };
// What a star is, for the nine-tenths of them that are not the door.
const ROLES = [
  'a good thought', 'a bad thought', 'a random thought', 'a memory',
  'a tool', 'a project', 'a ramble', 'an unfinished idea', 'a doubt',
];
const DAY = Math.floor(Date.now() / 86400000);
const daySeed = (DAY * 2654435761) % 4294967296;
const roleOf = function (index) { return ROLES[(index * 7 + 3) % ROLES.length]; };
// The door: the one star that faces the viewer when nothing has moved yet, so it
// sits at the centre of the screen. Everything else is a thought you can look at;
// this is the only one you can enter. It drifts with the day, not with the view.
const REST_YAW = 0.4;
const REST_PITCH = -0.35;
const PORTAL = (function () {
  // rotate the rest camera's forward axis back into the sphere: that direction is
  // what the viewer is looking at when the page settles.
  const cy = Math.cos(REST_YAW);
  const sy = Math.sin(REST_YAW);
  const cp = Math.cos(REST_PITCH);
  const sp = Math.sin(REST_PITCH);
  const forward = [sy * cp, -sp, cy * cp];
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    const score = dot(nodes[i].p, forward);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
})();
const counter = document.getElementById('counter');
const caption = document.getElementById('caption');

const dust = [];
for (let i = 0; i < 70; i += 1) {
  const a = Math.random() * Math.PI * 2;
  const b = Math.acos(2 * Math.random() - 1);
  const r = 1.3 + Math.random() * 2.0;
  dust.push({ x: Math.sin(b) * Math.cos(a) * r, y: Math.sin(b) * Math.sin(a) * r, z: Math.cos(b) * r, s: 0.4 + Math.random() * 0.7 });
}

const DPR = Math.min((EMBEDDED || innerWidth < 700) ? 1.4 : 2, window.devicePixelRatio || 1);
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
  const scale = zoom * Math.min(innerWidth, innerHeight) * FIT;
  const k = distance / (distance + z3);
  return { x: innerWidth / 2 + x2 * scale * k, y: innerHeight * ANCHOR + y3 * scale * k, k: k, depth: z3, z: z3 };
}

function heat(now, x, y, z) {
  let value = 0;
  if (focus !== null) {
    const d = Math.hypot(x - focus.x, y - focus.y, z - focus.z);
    value += Math.max(0, 1 - d / 1.2) * bloom;
  }
  for (const ripple of ripples) {
    const radius = ((now - ripple.t0) / 1000) * 1.1;
    const band = Math.abs(Math.hypot(x, y, z) - radius);
    if (band < 0.14) value += (1 - band / 0.14) * ripple.strength * Math.max(0, 1 - radius / 2.6);
  }
  return value;
}

function drawHalo(now) {
  const cx = innerWidth / 2;
  const cy = innerHeight * ANCHOR;
  const reach = Math.max(innerWidth, innerHeight) * 0.82;
  breath = (reduce || !auto) ? 0.5 : 0.5 + 0.5 * Math.sin(now * BREATH_SPEED);
  life = 0.45 + 0.55 * self.energy * self.memory;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  g.addColorStop(0, 'rgba(' + Math.round(58 * self.memory) + ',' + Math.round(34 * self.memory) + ','
    + Math.round(16 + 24 * (1 - self.memory)) + ',' + (0.55 * life + 0.10 * breath + 0.18 * bloom).toFixed(3) + ')');
  g.addColorStop(0.38, 'rgba(20,15,12,' + (0.88 + 0.05 * breath).toFixed(3) + ')');
  g.addColorStop(0.8, 'rgba(11,11,13,0.98)');
  g.addColorStop(1, '#08080a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // The fog: slow, enormous, additive. Everything above it is drawn over fog, so
  // the whole body sits inside something rather than in empty space.
  ctx.globalCompositeOperation = 'lighter';
  const fogScale = Math.min(innerWidth, innerHeight) * FIT * 2.6;
  const inside = insideOf(zoom);
  const fogCount = Math.max(1, Math.round(FOG.length * Math.max(0.35, quality)));
  for (const blob of FOG.slice(0, fogCount)) {
    const x = cx + Math.cos(now * blob.sx * FOG_ENERGY + blob.phase + MOOD * 6.28) * innerWidth * blob.ax;
    const y = cy + Math.sin(now * blob.sy * FOG_ENERGY + blob.phase * 1.3 + MOOD * 6.28) * innerHeight * blob.ay;
    const radius = fogScale * blob.radius * (0.94 + 0.06 * breath) * (1 + 0.55 * inside);
    ctx.globalAlpha = ((0.030 + 0.012 * breath) * life) * (1 + 2.4 * inside);
    ctx.drawImage(fogSprite(blob.tint), x - radius, y - radius, radius * 2, radius * 2);
  }
  // the entity's own core veil: brightest where the body is densest
  const vein = fogScale * 0.42;
  ctx.globalAlpha = (0.05 + 0.02 * breath) * life;
  ctx.drawImage(fogSprite('255,214,160'), cx - vein, cy - vein, vein * 2, vein * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Going out is not an ending either: past the sphere sit larger, dimmer copies
  // of the same body, one beyond the next. Retreat far enough and the whole thing
  // is a star inside something bigger.
  const outward = Math.max(0, Math.min(1, (1.0 - zoom) / 0.7));
  if (outward > 0.02 && quality > 0.55) {
    ctx.globalCompositeOperation = 'lighter';
    for (const step of [1, 2, 3]) {
      const scale = 1 + step * (1.15 * outward + 0.25);
      const alpha = outward * (0.14 / step) * life;
      for (let i = 0; i < GREAT.length; i += 1) {
        const points = GREAT[i];
        ctx.beginPath();
        let started = false;
        for (const point of points) {
          const p = project(point[0] * scale, point[1] * scale, point[2] * scale);
          if (p.z <= -0.2) { started = false; continue; }
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(206,168,120,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = DPR * 0.45;
        ctx.stroke();
      }
      const sky = glowSprite('226,190,150');
      for (let i = 0; i < nodes.length; i += 3) {
        const n = nodes[i].p;
        const p = project(n[0] * scale, n[1] * scale, n[2] * scale);
        if (p.z <= -0.1) continue;
        const radius = DPR * (0.8 + 0.6 * scale * 0.2);
        ctx.globalAlpha = Math.min(1, alpha * 2.2);
        ctx.drawImage(sky, p.x - radius, p.y - radius, radius * 2, radius * 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // The shape, stated: at full retreat the whole thing is one sphere, so it gets
  // a limb — faint, and gone as soon as you travel in.
  const retreat = Math.max(0, Math.min(1, (1.35 - zoom) / 0.55));
  if (retreat > 0.02) {
    const rim = Math.min(innerWidth, innerHeight) * FIT * zoom;
    const g2 = ctx.createRadialGradient(cx, cy, rim * 0.72, cx, cy, rim);
    g2.addColorStop(0, 'rgba(217,130,43,0)');
    g2.addColorStop(0.82, 'rgba(224,170,110,' + (0.05 * retreat).toFixed(3) + ')');
    g2.addColorStop(1, 'rgba(247,205,140,' + (0.13 * retreat).toFixed(3) + ')');
    ctx.beginPath();
    ctx.arc(cx, cy, rim, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();
  }

  const insideNow = insideOf(zoom);
  for (const mote of dust) {
    const p = project(mote.x, mote.y, mote.z);
    const near = 1 + insideNow * (0.6 + 1.6 * Math.max(0, p.k - 0.85));
    ctx.beginPath();
    ctx.arc(p.x, p.y, DPR * mote.s * p.k * near, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,222,190,'
      + ((0.05 + 0.14 * (p.k - 0.5)) * (1 + 1.8 * insideNow)).toFixed(3) + ')';
    ctx.fill();
  }

  // Inside, the mind closes around you: a soft vignette with no edge of its own.
  if (insideNow > 0.02) {
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(innerWidth, innerHeight) * 0.75);
    vg.addColorStop(0, 'rgba(8,8,10,0)');
    vg.addColorStop(0.72, 'rgba(6,6,8,' + (0.10 * insideNow).toFixed(3) + ')');
    vg.addColorStop(1, 'rgba(4,4,6,' + (0.55 * insideNow).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/** Sample one great circle perpendicular to an axis. */
function circlePath(axis, steps) {
  const helper = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(axis, helper));
  const v = cross(axis, u);
  const out = [];
  for (let t = 0; t < steps; t += 1) {
    const angle = (t / steps) * Math.PI * 2;
    out.push([
      u[0] * Math.cos(angle) + v[0] * Math.sin(angle),
      u[1] * Math.cos(angle) + v[1] * Math.sin(angle),
      u[2] * Math.cos(angle) + v[2] * Math.sin(angle),
    ]);
  }
  return out;
}
const GREAT = axes.map(function (axis) { return circlePath(axis.n, EMBEDDED || innerWidth < 700 ? 56 : 84); });

// --- the deeper axes -------------------------------------------------------
// The same thirty-one circles, rotated onto four more orientations. Five
// families in all: one fixed (the mark's own symmetry) and four the mind turns
// for itself. A phone carries three families; a wide screen carries five.
const FAMILIES = innerWidth < 700 ? 3 : 5;

/**
 * Rotate a direction by three angles (X, then Y, then Z).
 * @param v - unit direction.
 * @param a - X angle in radians.
 * @param b - Y angle in radians.
 * @param c - Z angle in radians.
 * @returns the rotated unit direction.
 */
function spin3(v, a, b, c) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  const y1 = v[1] * ca - v[2] * sa;
  const z1 = v[1] * sa + v[2] * ca;
  const x2 = v[0] * cb + z1 * sb;
  const z2 = -v[0] * sb + z1 * cb;
  const x3 = x2 * cc - y1 * sc;
  const y3 = x2 * sc + y1 * cc;
  return [x3, y3, z2];
}

const EXTRA_AXES = [];
for (let family = 1; family < FAMILIES; family += 1) {
  // deterministic, day-seeded, and far apart: no two families lie on one another
  const a = ((daySeed % 1000) / 1000) * Math.PI + family * 0.618;
  const b = (((daySeed >> 3) % 1000) / 1000) * Math.PI * 2 + family * 0.414;
  const c = ((family * 137.5) * Math.PI) / 180;
  const rotated = axes.map(function (axis) { return spin3(axis.n, a, b, c); });
  EXTRA_AXES.push(rotated);
}

// A dulled copy of the sprite cache for the extras: one tint, dimmer.
const EXTRA_CIRCLES = [];
const EXTRA_NODES = [];
for (const family of EXTRA_AXES) {
  EXTRA_CIRCLES.push(family.map(function (axis) { return circlePath(axis, 44); }));
  // the crossings inside a family, deduplicated: the extra sky's stars
  const seenExtra = new Set();
  for (let i = 0; i < family.length; i += 1) {
    for (let j = i + 1; j < family.length; j += 1) {
      const line = cross(family[i], family[j]);
      if (Math.hypot(line[0], line[1], line[2]) < 1e-6) continue;
      for (const sign of [1, -1]) {
        const p = norm([line[0] * sign, line[1] * sign, line[2] * sign]);
        const key = Math.round(p[0] * 200) + ',' + Math.round(p[1] * 200) + ',' + Math.round(p[2] * 200);
        if (seenExtra.has(key)) continue;
        seenExtra.add(key);
        EXTRA_NODES.push({ p: p, family: EXTRA_AXES.length });
      }
    }
  }
}

function circleWeight(index) {
  const chosen = hoverNode >= 0 ? nodes[hoverNode] : (diveNode >= 0 ? nodes[diveNode] : null);
  if (chosen === null) return 1;
  return (index === chosen.a || index === chosen.b) ? 2.6 : 0.55;
}

function strokeCircle(index, points, now, front) {
  ctx.beginPath();
  let started = false;
  for (const point of points) {
    const p = project(point[0], point[1], point[2]);
    if ((p.z > 0) !== front) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  }
  const chosen = hoverNode >= 0 ? nodes[hoverNode] : (diveNode >= 0 ? nodes[diveNode] : null);
  const weight = chosen === null ? 1 : ((index === chosen.a || index === chosen.b) ? 2.6 : 0.55);
  const base = front ? 0.30 : 0.10;
  // The further in you travel, the more the circles step back: up close the
  // individual great circles read as straight lines, which is the opposite of a
  // galaxy. The stars and the fog carry that depth instead.
  const soft = Math.max(0.08, Math.min(1, 1.45 - zoom * 0.28 - insideOf(zoom) * 0.35));
  ctx.strokeStyle = 'rgba(' + (weight > 2 ? '255,240,215' : GOLD) + ','
    + Math.min(1, (base * life + 0.04 * breath) * weight * soft).toFixed(3) + ')';
  ctx.lineWidth = DPR * (front ? 0.9 : 0.6) * (weight > 2 ? 1.9 : 1);
  ctx.stroke();
  void now;
}

/**
 * Basis for the tangent plane at a direction: two orthonormal vectors and the
 * direction itself. A child galaxy is planted here, scaled, so that zooming into
 * a star reveals a smaller galaxy — the same structure, repeated. That is the
 * fractal part: the whole is made of pieces that are themselves the whole.
 * @param axis - the anchor direction (a unit vector).
 * @returns [u, v, axis] an orthonormal frame.
 */
function frameAt(axis) {
  const helper = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(axis, helper));
  const v = cross(axis, u);
  return [u, v, axis];
}

/**
 * Draw the galaxy (circles + nodes), optionally planted on a cap of angular
 * radius (radius) around an anchor direction, so a zoomed view keeps resolving
 * into the same figure. When anchor is null it draws the root sphere.
 */
function drawGalaxyAt(now, anchor, radius, rotPhase, alpha) {
  const frame = anchor === null ? null : frameAt(anchor);
  const local = function (point) {
    if (frame === null) return point;
    const x = point[0] * Math.cos(rotPhase) - point[1] * Math.sin(rotPhase);
    const y = point[0] * Math.sin(rotPhase) + point[1] * Math.cos(rotPhase);
    const z = point[2];
    const u = frame[0];
    const v = frame[1];
    const a = frame[2];
    return norm([
      a[0] + (u[0] * x + v[0] * y) * radius,
      a[1] + (u[1] * x + v[1] * y) * radius,
      a[2] + (u[2] * x + v[2] * y) * radius,
    ]);
  };
  const localZ = function (point) {
    if (frame === null) return point[2];
    return dot(point, frame[2]);
  };

  // back circles
  for (let i = 0; i < GREAT.length; i += 1) {
    const points = GREAT[i];
    ctx.beginPath();
    let started = false;
    for (const raw of points) {
      const point = local(raw);
      const p = project(point[0], point[1], point[2]);
      if (localZ(point) > 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    const weight = i === -1 ? 2 : 1;
    ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.10 * alpha * weight).toFixed(3) + ')';
    ctx.lineWidth = DPR * 0.6;
    ctx.stroke();
  }

  // nodes, dimmed by depth, warmed by work
  const ordered = nodes.map(function (node, index) {
    const point = local(node.p);
    const p = project(point[0], point[1], point[2]);
    return { node: node, index: index, p: p, point: point };
  }).sort(function (a, b) { return a.p.depth - b.p.depth; });
  for (const entry of ordered) {
    const p = entry.p;
    if (p.z < -0.5) continue;
    const near = Math.max(0, Math.min(1, (p.k - 0.55) / 0.6));
    const hot = heat(now, entry.point[0], entry.point[1], entry.point[2]);
    const sprite = glowSprite(hot > 0.1 ? GREEN : GOLD);
    const radius = DPR * (0.7 + 2.2 * near) * (1 + hot * 1.4);
    ctx.globalAlpha = Math.min(1, ((0.10 + 0.5 * near) * life + hot * 0.4) * alpha);
    ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  // front circles
  for (let i = 0; i < GREAT.length; i += 1) {
    const points = GREAT[i];
    ctx.beginPath();
    let started = false;
    for (const raw of points) {
      const point = local(raw);
      const p = project(point[0], point[1], point[2]);
      if (localZ(point) <= 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.30 * alpha).toFixed(3) + ')';
    ctx.lineWidth = DPR * 0.9;
    ctx.stroke();
  }
}

function drawGalaxy(now) {
  // back hemisphere first, then the nodes, then the front: depth without sorting
  // thousands of segments.
  GREAT.forEach(function (points, index) { strokeCircle(index, points, now, false); });
  for (const line of FLOWER) {
    ctx.beginPath();
    let started = false;
    for (const point of line) {
      if (point === null) { started = false; continue; }
      const p = project(point[0], point[1], point[2]);
      if (p.z > 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(255,236,205,' + (0.05 * life + 0.02 * breath).toFixed(3) + ')';
    ctx.lineWidth = DPR * 0.7;
    ctx.stroke();
  }

  // the matter: every intersection, dimmed by depth, warmed by work
  const ordered = nodes.map(function (node, index) {
    const p = project(node.p[0], node.p[1], node.p[2]);
    return { node: node, index: index, p: p };
  }).sort(function (a, b) { return a.p.depth - b.p.depth; });
  // Every star carries a wide, faint halo. Drawn additively, the haloes of a few
  // hundred stars accumulate into one cloud: no single star is bright, the sum of
  // them is. That overlap is the glow of the mind, and why it reads as alive.
  ctx.globalCompositeOperation = 'lighter';
  for (const entry of ordered) {
    const p = entry.p;
    if (p.z < -0.55) continue;
    const near = Math.max(0, Math.min(1, (p.k - 0.55) / 0.6));
    const hot = heat(now, entry.node.p[0], entry.node.p[1], entry.node.p[2]);
    const picked = entry.index === hoverNode || entry.index === diveNode;
    const isDoor = entry.index === PORTAL;
    // thoughts sit a shade darker than the door and far lighter in weight
    const tint = hot > 0.1 ? GREEN : isDoor ? '255,246,224' : picked ? '255,236,205' : GOLD;
    const core = DPR * (0.6 + 1.9 * near) * (1 + hot * 1.4) * (picked ? 2.4 : isDoor ? 1.7 : 1);
    const cloud = core * (isDoor ? 5.5 : 3.6);
    const strength = Math.min(1, (0.07 + 0.34 * near) * life + hot * 0.35 + (picked ? 0.4 : 0));
    const sprite = glowSprite(tint);
    ctx.globalAlpha = strength * (isDoor ? 0.30 : 0.16);
    ctx.drawImage(sprite, p.x - cloud, p.y - cloud, cloud * 2, cloud * 2);
    ctx.globalAlpha = strength * (isDoor ? 1 : 0.85);
    ctx.drawImage(sprite, p.x - core, p.y - core, core * 2, core * 2);
    ctx.globalAlpha = 1;
    // The door is an Easter egg, not a signpost: the ring appears only when you are
    // close enough to be looking, or when the pointer is already on it.
    // Under reduced motion there is no drift to reveal the ring, so it is simply
    // always there: the Easter egg still has to be reachable without hunting.
    if (entry.index === PORTAL && (reduce || zoom > 1.5 || hoverNode === PORTAL)) {
      const pulse = 8 + 3.5 * Math.sin(now * 0.0016);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (pulse + DPR * 3) * DPR * p.k, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,242,214,' + (0.18 + 0.14 * breath).toFixed(3) + ')';
      ctx.lineWidth = DPR * 1.2;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // Inner shells: the same circles, smaller and dimmer, so the eye reads a body
  // with layers of light rather than a single skin. Drawn additive beside the
  // root so the centre gains depth without gaining weight.
  ctx.globalCompositeOperation = 'lighter';
  const shells = [{ r: 0.86, a: 0.16 }, { r: 0.70, a: 0.11 }, { r: 0.55, a: 0.07 }];
  for (const shell of shells.slice(0, Math.max(1, Math.ceil(shells.length * quality)))) {
    for (let i = 0; i < GREAT.length; i += 1) {
      const points = GREAT[i];
      ctx.beginPath();
      let started = false;
      for (const point of points) {
        const p = project(point[0] * shell.r, point[1] * shell.r, point[2] * shell.r);
        if (p.z <= 0) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(232,186,132,' + (shell.a * life).toFixed(3) + ')';
      ctx.lineWidth = DPR * 0.55;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  GREAT.forEach(function (points, index) { strokeCircle(index, points, now, true); });
  for (const line of FLOWER) {
    ctx.beginPath();
    let started = false;
    for (const point of line) {
      if (point === null) { started = false; continue; }
      const p = project(point[0], point[1], point[2]);
      if (p.z <= 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(255,240,215,' + (0.16 * life + 0.03 * breath).toFixed(3) + ')';
    ctx.lineWidth = DPR * 0.8;
    ctx.stroke();
  }

  // The deeper sky: four rotated families over the root, drawn additive and dim,
  // so the cloud gains volume without the frame budget paying for four sprites a
  // star. Circles first (they are structure), then their crossings.
  // The deeper sky emerges one family at a time as you travel: at rest there is
  // the fixed flower and its first extra family; deeper zoom surfaces the next,
  // and the next. The sky is never all of it, which is what makes it feel endless.
  if (EXTRA_CIRCLES.length > 0 && quality > 0.5) {
    ctx.globalCompositeOperation = 'lighter';
    // At full retreat every family is present: the complete sphere, which is the
    // shape this has always been. Travelling inward lets the deeper families step
    // back so the structure you are entering can lead.
    const inward = Math.max(0, Math.min(1, (zoom - 1.05) / 1.9));
    const reveal = function (familyIndex) {
      return 1 - inward * (0.35 + familyIndex * 0.12);
    };
    for (let fi = 0; fi < EXTRA_CIRCLES.length; fi += 1) {
      const alpha = reveal(fi);
      if (alpha <= 0.01) continue;
      for (const points of EXTRA_CIRCLES[fi]) {
        ctx.beginPath();
        let started = false;
        for (const point of points) {
          const p = project(point[0], point[1], point[2]);
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(214,168,120,' + ((0.045 * life + 0.012 * breath) * alpha).toFixed(3) + ')';
        ctx.lineWidth = DPR * 0.5;
        ctx.stroke();
      }
    }
    const sky = glowSprite('232,196,150');
    for (const node of EXTRA_NODES) {
      const p = project(node.p[0], node.p[1], node.p[2]);
      if (p.z < -0.35) continue;
      const famAlpha = reveal(node.family - 1);
      if (famAlpha <= 0.01) continue;
      const near = Math.max(0, Math.min(1, (p.k - 0.55) / 0.6));
      const radius = DPR * (0.5 + 1.5 * near);
      ctx.globalAlpha = (0.05 + 0.20 * near) * life * famAlpha;
      ctx.drawImage(sky, p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Endless finding: every band of zoom grows another galaxy inside the last.
  // The root never moves — it is always the fixed flower — but each child is
  // anchored on a different star, so no two journeys repeat.
  // Children only exist inside a star you entered. Without a dive there is one
  // body and nothing else, so the view can never grow a second sphere beside the
  // first (which read as a bug, because it was one).
  if (diveNode >= 0) {
    for (let band = 0; band < ZOOM_BANDS.length; band += 1) {
      if (zoom <= ZOOM_BANDS[band]) break;
      const anchorNode = nodes[diveNode].p;
      drawGalaxyAt(now, anchorNode, 0.26 / Math.pow(1.9, band), yaw * (2 + band) + band, 0.75 - band * 0.1);
    }
  }
}

/**
 * Draw one great-circle arc between two stars: the shortest path over the sphere,
 * sampled so it can be dashed and animated.
 * @param a - unit direction of the start.
 * @param b - unit direction of the end.
 * @param steps - samples along the arc.
 * @returns the arc as unit directions.
 */
function arcBetween(a, b, steps) {
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  const out = [];
  if (angle < 1e-4) return out;
  const sin = Math.sin(angle);
  for (let t = 0; t <= steps; t += 1) {
    const u = t / steps;
    const wa = Math.sin((1 - u) * angle) / sin;
    const wb = Math.sin(u * angle) / sin;
    out.push(norm([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]));
  }
  return out;
}

/**
 * The paths of use: consecutive moments of work, joined over the sphere and lit
 * so the light travels along them. This is what makes the body read as thinking
 * while it is being used, rather than as a still object with a counter.
 */
function drawPathways(now) {
  if (trail.length < 2) return;
  const recent = trail.slice(-10);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = DPR * 1.1;
  for (let i = 1; i < recent.length; i += 1) {
    const from = nodes[(recent[i - 1].skill.length * 37 + i) % nodes.length].p;
    const to = nodes[(recent[i].skill.length * 53 + i * 7) % nodes.length].p;
    const arc = arcBetween(from, to, 18);
    if (arc.length === 0) continue;
    const fresh = Math.max(0.15, 1 - (now - (recent[i].at || now)) / 90000);
    ctx.beginPath();
    let started = false;
    for (const point of arc) {
      const p = project(point[0], point[1], point[2]);
      if (p.z <= -0.15) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    // the dash walks along the arc: light running down a pathway
    ctx.setLineDash([DPR * 3, DPR * 9]);
    ctx.lineDashOffset = -((now * 0.06) % (DPR * 12));
    ctx.strokeStyle = 'rgba(126,226,168,' + (0.10 + 0.34 * fresh).toFixed(3) + ')';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawTrail(now) {
  if (trail.length === 0) return;
  const cx = innerWidth / 2;
  const cy = innerHeight * ANCHOR;
  const base = Math.min(innerWidth, innerHeight) * FIT * 1.45;
  trail.forEach(function (event, index) {
    const age = Math.max(0, now - event.at);
    const freshness = Math.max(0.06, 1 - age / 600000);
    const turn = index / 40;
    const angle = -Math.PI / 2 + (turn % 1) * Math.PI * 2;
    const radius = base * (0.72 + 0.05 * Math.min(4, Math.floor(turn)) + 0.10 * (turn % 1));
    const colour = event.skill === 'geometry' ? GREEN : event.skill === 'dashboard' ? BLUE : GOLD;
    drawGlow(colour, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, DPR * (1.8 + 2.2 * freshness), (0.06 + 0.35 * freshness) * life);
  });
}

function drawGlow(tint, x, y, radius, alpha) {
  const sprite = glowSprite(tint);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function drawAgents() {
  agents.forEach(function (agent, index) {
    const angle = -Math.PI / 2 + (index / Math.max(1, agents.length)) * Math.PI * 2 + yaw * 0.45;
    const p = project(Math.cos(angle) * 1.25, Math.sin(angle) * 1.25, Math.sin(yaw + index) * 0.4);
    drawGlow(GOLD, p.x, p.y, DPR * (5 + Math.min(5, agent.steps * 0.5)), 0.30);
  });
}

/** Send a ripple outward from one star, the way work does. */
function rippleFrom(index) {
  const node = nodes[index];
  ripples.push({ t0: performance.now(), strength: 0.8 });
  const label = nodes[index] === undefined ? null : node;
  void label;
}

function drawRipples(now) {
  for (const ripple of ripples) {
    const radius = ((now - ripple.t0) / 1000) * 1.1;
    const left = Math.max(0, 1 - radius / 2.6);
    if (left <= 0) continue;
    ctx.beginPath();
    for (let t = 0; t <= 96; t += 1) {
      const angle = (t / 96) * Math.PI * 2;
      const p = project(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      if (t === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(' + GREEN + ',' + (left * 0.18).toFixed(3) + ')';
    ctx.lineWidth = DPR * 1.2;
    ctx.stroke();
  }
  ripples = ripples.filter(function (ripple) { return ((now - ripple.t0) / 1000) * 1.1 < 2.6; });
}

function drawMood() {
  const hour = new Date().getHours();
  const dayness = Math.max(0, Math.cos(((hour - 13) / 24) * Math.PI * 2));
  ctx.fillStyle = 'rgba(' + Math.round(60 + 30 * dayness) + ',' + Math.round(34 + 40 * dayness) + ','
    + Math.round(90 - 40 * dayness) + ',' + (0.04 + 0.03 * dayness).toFixed(3) + ')';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function frame(now) {
  const dt = Math.min(64, now - last);
  last = now;
  // Measure, then decide. Below ~42 fps shed a layer; comfortably above, recover
  // one. Nothing is shown to the user about this: it is just the body pacing itself.
  frameAvg += (dt - frameAvg) * 0.06;
  qualityTick += 1;
  if (qualityTick % 90 === 0) {
    if (frameAvg > 23) quality = Math.max(0.3, quality - 0.15);
    else if (frameAvg < 14) quality = Math.min(1, quality + 0.06);
  }
  if (document.visibilityState === 'hidden') {
    requestAnimationFrame(frame);
    return;
  }
  const live = focus !== null && now < focusUntil;
  bloom += ((live ? 1 : 0) - bloom) * 0.035;
  const spinning = Math.abs(velYaw) + Math.abs(velPitch) + Math.abs(velRoll) > 0.00008;
  // The dive: aim the chosen star at the viewer and come close enough to see the
  // two circles that cross there. Returning is the same motion, unwound.
  if (diveNode >= 0 && !dragging && !spinning) {
    const node = nodes[diveNode].p;
    const wantYaw = Math.atan2(-node[0], node[2]);
    const wantPitch = Math.atan2(node[1], Math.hypot(node[0], node[2]));
    let dx = (wantYaw - yaw) % (Math.PI * 2);
    if (dx > Math.PI) dx -= Math.PI * 2;
    if (dx < -Math.PI) dx += Math.PI * 2;
    yaw += dx * 0.055;
    pitch += ((wantPitch * 0.75) - pitch) * 0.055;
    roll += (0 - roll) * 0.055;
    zoom += (2.0 - zoom) * 0.05;
    diveGlow += (1 - diveGlow) * 0.06;
  } else if (diveNode < 0) {
    // No automatic retreat: where you put the camera is yours to keep. Coming back
    // out is an explicit act (reset, escape, or tapping empty space).
    diveGlow += (0 - diveGlow) * 0.06;
  }

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
    } else if (!reduce && auto) {
      yaw += dt * IDLE_SPEED * DRIFT;
      // It tilts as well as turns, on periods that do not divide into each other,
      // so the pose never repeats exactly.
      pitch += Math.sin(now * 0.000034) * dt * 0.0000042;
      roll += Math.sin(now * 0.000021 + 1.7) * dt * 0.0000056;
      pitch = Math.max(-0.6, Math.min(0.6, pitch));
    }
  }
  // The screensaver: forty-five seconds of stillness and the mind takes itself for
  // a walk. It picks stars, names them, dives and withdraws — the same voyage a
  // hand would make, on its own schedule.
  if (!reduce && !screensaver && now - lastInput > 45000) {
    screensaver = true;
    document.body.classList.add('screensaver');
    exploreAt = now;
  }
  if (screensaver) {
    if (now > exploreAt) {
      exploreAt = now + 5200 + Math.random() * 3600;
      exploreNode = (exploreNode + 37 + Math.floor(Math.random() * 40)) % nodes.length;
      diveNode = exploreNode;
      zoom = Math.random() < 0.45 ? 2.4 : 1.15;
      rippleFrom(exploreNode);
      const label = document.getElementById('nodeName');
      if (label) {
        const event = trail[trail.length - 1];
        label.textContent = event !== undefined && event.label !== undefined
          ? String(event.label)
          : (exploreNode === PORTAL ? 'the door' : roleOf(exploreNode));
      }
    }
  } else {
    diveNode = diveNode >= 0 && now > focusUntil && zoom > 4 ? -1 : diveNode;
  }

  document.body.classList.toggle('deep', zoom > 2.2);
  drawHalo(now);
  drawTrail(now);
  drawGalaxy(now);
  drawPathways(now);
  drawAgents();
  drawRipples(now);
  drawMood();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- simulation -----------------------------------------------------------
function applyLevel(level) {
  simLevel = level;
  const nameEl = document.getElementById('levelName');
  if (nameEl) nameEl.textContent = LEVELS[level] || '';
  if (level === 0) { focus = null; simulated = true; return; }
  const now = Date.now();
  const count = level * 6;
  trail = [];
  for (let i = 0; i < count; i += 1) {
    trail.push({ skill: SKILL_ORDER[(i * (level + 1)) % SKILL_ORDER.length], at: now - (count - i) * (9000 / level) });
  }
  agents = [];
  for (let a = 0; a < Math.min(6, level); a += 1) agents.push({ id: 'sim-' + a, steps: 2 + a * 2 });
  const target = nodes[(level * 97) % nodes.length].p;
  focus = { x: target[0], y: target[1], z: target[2] };
  focusUntil = performance.now() + 600000;
  ripples.push({ t0: performance.now(), strength: 1 });
  simulated = true;
  if (counter) {
    counter.textContent = 'Massai · ' + (nodes.length + EXTRA_NODES.length) + ' thoughts · '
      + (axes.length * FAMILIES) + ' circles · one door';
  }
}
const slider = document.getElementById('level');
if (slider) {
  slider.addEventListener('input', function () { applyLevel(Number(slider.value)); });
  applyLevel(Number(slider.value));
}
if (counter) {
    counter.textContent = 'Massai · ' + (nodes.length + EXTRA_NODES.length) + ' thoughts · '
      + (axes.length * FAMILIES) + ' circles · one door';
  }

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
    const badge = document.getElementById('simulated');
    if (badge) badge.style.opacity = simulated ? '0.7' : '0';
    const hot = data.focus;
    if (!hot) return;
    const target = nodes[Math.abs(SKILL_ORDER.indexOf(hot.skill) + 3) % nodes.length].p;
    focus = { x: target[0], y: target[1], z: target[2] };
    focusUntil = performance.now() + 25000;
    ripples.push({ t0: performance.now(), strength: 1 });
    if (caption) { caption.textContent = hot.label; caption.style.opacity = '1'; }
  } catch { /* a live view that fails is still a galaxy */ }
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

// --- interaction ----------------------------------------------------------
canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
function nodeAt(clientX, clientY) {
  let best = -1;
  // A thumb is not a mouse: on glass the door needs a generous target, and the
  // nearest star to the finger wins so a near miss still finds it.
  let bestDistance = 34 * DPR;
  for (let i = 0; i < nodes.length; i += 1) {
    const p = project(nodes[i].p[0], nodes[i].p[1], nodes[i].p[2]);
    if (p.z < -0.1) continue;
    const distance = Math.hypot(p.x - clientX * DPR, p.y - clientY * DPR);
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  return best;
}

function describe(index) {
  if (index < 0) return '';
  if (index === PORTAL) return 'the door — touch it to enter';
  return roleOf(index);
}

let askedFullscreen = false;
/**
 * Ask for the whole screen, once, on the first real touch.
 * @returns nothing; failures are silent because some browsers refuse by policy.
 */
function goFullscreen() {
  if (askedFullscreen) return;
  askedFullscreen = true;
  try {
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (request) Promise.resolve(request.call(root)).catch(function () { /* policy */ });
  } catch { /* a browser that will not, will not */ }
}

/**
 * Note that a person is here: stops the screensaver and resets the idle clock.
 * @returns nothing.
 */
function wake() {
  lastInput = performance.now();
  if (screensaver) {
    screensaver = false;
    document.body.classList.remove('screensaver');
  }
}

canvas.addEventListener('pointerdown', function (event) {
  wake();
  goFullscreen();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    // pinch: two fingers decide distance, the way a hand would
    const two = [...pointers.values()];
    pinchStart = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
    zoomAtPinch = zoom;
    dragging = false;
    return;
  }
  dragging = true;
  dragMode = event.button === 2 || event.shiftKey ? 'roll' : 'turn';
  velYaw = 0; velPitch = 0; velRoll = 0;
  canvas.setPointerCapture(event.pointerId);
  canvas.dataset.drag = event.clientX + ',' + event.clientY;
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', function (event) {
  wake();
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2 && pinchStart > 0) {
    const two = [...pointers.values()];
    const now = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
    zoom = Math.max(0.16, Math.min(20, zoomAtPinch * (now / pinchStart)));
    return;
  }
  if (!reduce) {
    lookX += ((event.clientX / innerWidth - 0.5) * 0.16 - lookX) * 0.06;
    lookY += ((event.clientY / innerHeight - 0.5) * 0.11 - lookY) * 0.06;
  }
  if (!dragging) {
    // Hovering a star names it and lights its two circles: the mind shows its
    // wiring before you commit to entering it.
    hoverNode = nodeAt(event.clientX, event.clientY);
    canvas.style.cursor = hoverNode >= 0 ? 'pointer' : 'grab';
    const label = document.getElementById('nodeName');
    if (label) label.textContent = describe(hoverNode);
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
canvas.addEventListener('pointerup', function (event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = 0;
  if (!dragging) return;
  dragging = false;
  canvas.style.cursor = 'grab';
  // A tap enters the star under it; a tap on empty space comes back out.
  const picked = nodeAt(event.clientX, event.clientY);
  if (picked >= 0 && picked !== PORTAL) {
    // A thought, not a door: name it, then let it be.
    const label = document.getElementById('nodeName');
    if (label) {
      label.textContent = describe(picked);
      clearTimeout(thoughtTimer);
      thoughtTimer = setTimeout(function () { if (label) label.textContent = ''; }, 2600);
    }
    return;
  }
  if (picked === PORTAL) {
    const label = document.getElementById('nodeName');
    if (label) label.textContent = 'entering…';
    // Embedded in the app, the door asks the room to open. Standing alone on the
    // web, the door is the way in: it walks you to the workshop.
    try {
      if (window.parent !== window) window.parent.postMessage({ type: 'massai:enter' }, '*');
      else setTimeout(function () { location.href = '/access'; }, 420);
    } catch (error) { void error; }
  } else if (picked >= 0) {
    diveNode = picked;
    const label = document.getElementById('nodeName');
    if (label) label.textContent = describe(picked);
  } else if (diveNode >= 0) {
    diveNode = -1;
    const label = document.getElementById('nodeName');
    if (label) label.textContent = '';
  }
});
canvas.addEventListener('pointercancel', function (event) {
  pointers.delete(event.pointerId);
  dragging = false;
});
addEventListener('pointerleave', function () { lookX = 0; lookY = 0; });
canvas.addEventListener('wheel', function (event) {
  wake();
  event.preventDefault();
  zoom = Math.max(0.16, Math.min(20, zoom * (event.deltaY > 0 ? 0.95 : 1.05)));
}, { passive: false });
addEventListener('keydown', function (event) {
  wake();
  if (event.key === 'ArrowLeft') yaw -= 0.1;
  if (event.key === 'ArrowRight') yaw += 0.1;
  if (event.key === 'ArrowUp') pitch = Math.max(-1.5, pitch - 0.07);
  if (event.key === 'ArrowDown') pitch = Math.min(1.5, pitch + 0.07);
  if (event.key === 'q' || event.key === 'Q') roll -= 0.1;
  if (event.key === 'e' || event.key === 'E') roll += 0.1;
  if (event.key === 'r' || event.key === 'R') { yaw = 0.4; pitch = -0.35; roll = 0; }
  // Space stills the whole thing: sometimes you want to study the mind, not watch it.
  if (event.key === 'f' || event.key === 'F') {
    if (document.fullscreenElement) { void document.exitFullscreen() } else { goFullscreen() }
  }
  if (event.key === ' ') {
    event.preventDefault();
    auto = !auto;
    const state = document.getElementById('still');
    if (state) state.textContent = auto ? '' : 'still';
  }
  if (event.key === 'Escape') { diveNode = -1; const label = document.getElementById('nodeName'); if (label) label.textContent = ''; }
});
setTimeout(function () { if (hint) hint.style.opacity = '0'; }, 8000);
void SHAPE;
`

/**
 * Render the immersive flower page.
 * @returns the page HTML.
 */
export function flowerPageHtml(embed = false): string {
  return `<!doctype html>
<html lang="en"${embed ? ' class="embed"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
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
  /* Embedded as a stage: the object is the whole frame. */
  /* Travelling in, the page's own voice fades: the deeper you are, the less the
     interface says. Lost is a feature here, not a failure. */
  .deep .overlay, .deep .hint, .deep .shapes, .deep .sim-ui, .deep .counter,
  .deep .settled, .deep .sim, .deep .node-name { opacity: .12; transition: opacity 1.2s ease }
  /* Screensaver: the mind is the whole screen and it narrates itself quietly. */
  body.screensaver .overlay, body.screensaver .hint, body.screensaver .shapes,
  body.screensaver .sim-ui, body.screensaver .counter, body.screensaver .settled,
  body.screensaver .sim, body.screensaver .toward, body.screensaver .back { opacity: 0; transition: opacity 2s ease }
  body.screensaver .node-name { opacity: .55; transition: opacity 2s ease }
  body.embed .overlay, body.embed .hint, body.embed .shapes, body.embed .sim-ui,
  body.embed .being, body.embed .confession, body.embed .counter, body.embed .settled,
  body.embed .sim { display: none !important }
  body.embed { background: #08080a }
</style></head><body${embed ? ' class="embed"' : ''}>
<canvas id="flower" aria-label="The Massai flower of life, rotatable" role="img"></canvas>
<div class="overlay">
  <div class="brand"><img src="/massai-crest.svg" alt="" width="22" height="22"><span>MASSAI</span></div>
  <a class="back" href="/">← the door</a>
</div>
<p class="caption" id="caption"></p>
<p class="node-name" id="nodeName"></p>
<p class="still" id="still"></p>
<p class="counter" id="counter"></p>
<p class="settled" id="settled"></p>
<p class="sim" id="simulated">simulated — no live activity yet</p>
<p class="being" id="being"></p>
<p class="confession" id="confession"></p>
<p class="hint" id="hint"><b>drag</b> to travel · <b>shift-drag</b> to roll · <b>pinch</b>/<b>scroll</b> for depth · <b>tap once</b> for the whole screen · one star is a door</p>
<div class="sim-ui">
    <label for="level">simulate intelligence</label>
    <input type="range" id="level" min="0" max="5" step="1" value="0">
    <span id="levelName">dormant</span>
  </div>
  <span class="shapes"><a href="/flower">galaxy</a> &nbsp;|&nbsp; <a href="/map">where everything is →</a></span>
<script>${FLOWER_SCRIPT}</script>
</body></html>`
}
