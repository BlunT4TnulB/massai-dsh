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
// The visual viewport: what the glass actually shows. The layout viewport lies by
// the height of the address bar (and by any pinch-zoom), which is enough to make a
// centred body look pushed up and to the left.
let VW = innerWidth;
let VH = innerHeight;
function measureViewport() {
  const vv = (typeof window.visualViewport !== 'undefined' && window.visualViewport !== null)
    ? window.visualViewport
    : null;
  VW = vv === null ? innerWidth : vv.width;
  VH = vv === null ? innerHeight : vv.height;
}


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

// The motion budget. Several things move at once; what keeps it from reading as chaos
// is that each is smaller and slower than the one above, and their periods never line
// up. Amplitude is in radians per millisecond of drift.
const MOTION = {
  yaw: { rate: 1.0 },                       // the dominant turn
  yawSecond: { rate: 0.000019, amp: 0.48 }, // a slow sway on top of it
  roll: { rate: 0.0000115 },                // a slow, constant roll: the body never sits level
  tumble: { rate: 0.0000072, limit: 0.5 },  // the pole travels, then reverses — real tumbling
  pitchA: { rate: 0.000029, amp: 0.0000055 },
  pitchB: { rate: 0.000041, amp: 0.0000026 },
  // while aiming at a star the body keeps all of this at 60% — attention, not freeze
  aiming: { scale: 0.6 },
};
const FRICTION = 0.955;
const LEVELS = ['dormant', 'stirring', 'working', 'busy', 'surging', 'at full stretch'];
// Framing by intent. The app wants the mind filling the screen, because there is
// no composer until the door is found; the welcome orb wants the whole sphere
// inside its circle, so the button reads as a complete object.
const ORB = params.get('fit') === 'orb';
// A decorative orb (the welcome page) must not chat: no activity polls, no vitals,
// no counters. It is the mind as an object, not as a dashboard.
const QUIET = params.get('quiet') === '1' || ORB;
const VISUALIZER = params.get('viz') === '1' || /(^|\s)viz(\s|$)/.test(document.documentElement.className);
const FIT = ORB ? 0.40 : EMBEDDED ? 0.52 : 0.40;

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
// One octave of scale. Zoom is measured as a logarithm of this ratio, so the travel
// is unbounded in both directions and the visible size always sits in [1, R).
const OCTAVE = 3.6;
const LOG_OCTAVE = Math.log(OCTAVE);
// ?z=<log> starts the camera at a given depth, which is how a screenshot can show
// any octave without a hand on the glass.
const START_Z = Number(params.get('z') ?? '0');
// ?dive=<index> starts with that star attended, so the node-finding state can be
// photographed (and so the bright-line bug could be reproduced deliberately).
const START_DIVE = Number(params.get('dive') ?? '-1');
let zoomLog = Number.isFinite(START_Z) ? START_Z : 0;
let zoomLogTarget = zoomLog;
let octaveScale = 1;
// Dead centre now: nothing is waiting at the foot of the screen to make room for.
const ANCHOR = 0.5;

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
// The door lives at the rest pose, dead centre. Only the welcome orb spins in a
// random pose (spin=1); the app keeps the fixed pose so the door stays findable
// and the body sits where it belongs.
let yaw = SPIN ? 0.4 + seedAngle(Math.PI * 1.4) : 0.4;
let pitch = SPIN ? -0.35 + seedAngle(0.9) : -0.35;
let roll = SPIN ? seedAngle(0.8) : 0;
let velYaw = 0;
let velPitch = 0;
let velRoll = 0;
let zoom = 1;
let zoomTarget = 1;
// Where the view is centred. One finger turns the body; two fingers slide this
// centre across the screen so you can look off-axis, hold a region in view, or
// push the body to one side while you read another part of it.
let panX = 0;
let panY = 0;
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
// Pathways are a reading of the work, not a feature of the body: let them be turned
// off (P, or ?paths=0) for anyone who finds them too much.
let pathsOn = params.get('paths') !== '0';

// Sparks: a sudden link between two stars, bright for about a second, then gone. They
// are the mind appearing to notice itself. Visual only — nothing is transmitted — but
// they are driven by real activity when there is any, and by a slow restlessness when
// there is not.
// The mark real work leaves: a star, lit and kept lit, joined to the last few of its
// kind. Random sparks are weather; these are evidence, and they outlive the weather.
const LIT_MS = 600000;
const lit = new Map();
let litTotal = -1;
let litSkill = '';

// The brief fall on arrival: when the door opens, the camera is already inside and
// settles outward, so entering feels like arriving rather than like a cut.
const ARRIVING = params.get('arrive') === '1' || ORB;
let arriveUntil = 0;

// The vocabulary. A spark is not just "something happened": what happened decides the
// colour, the shape and how long it lasts.
//   tool      gold     the ordinary work
//   fail      crimson  a failure or a retry — the route that did not work
//   learn     green    something learned, a skill taking hold
//   epiphany  white    a bright, wide arc and a shockwave
//   build     amber    a finished thing
const SPARK_KINDS = {
  tool: { colour: '255,246,226', weight: 6, life: 2200, amplitude: 1, halo: 1, ripple: 0 },
  fail: { colour: '255,86,64', weight: 1, life: 1500, amplitude: 1.7, halo: 1.5, ripple: 0 },
  learn: { colour: '150,255,196', weight: 1.1, life: 2600, amplitude: 0.9, halo: 1.2, ripple: 0.5 },
  epiphany: { colour: '255,255,246', weight: 0.35, life: 3400, amplitude: 1.2, halo: 2.6, ripple: 1 },
  build: { colour: '255,214,150', weight: 1.2, life: 3000, amplitude: 0.8, halo: 1.3, ripple: 0.4 }
};
const SPARK_RATE = [0, 9000, 4500, 2200];
let sparkLevel = (function () {
  try {
    const stored = window.localStorage.getItem('massai_sparks');
    if (stored !== null) {
      const value = Number(stored);
      if (Number.isFinite(value)) return Math.max(0, Math.min(3, Math.round(value)));
    }
  } catch (error) { void error; }
  const fromUrl = Number(params.get('sparks') ?? 'NaN');
  return Number.isFinite(fromUrl) ? Math.max(0, Math.min(3, Math.round(fromUrl))) : 2;
})();
let sparkNext = 0;
let nextSpeakAt = Date.now() + 22000;
const sparks = [];
// How many of each kind the feed last reported (aggregate only).
let kindCounts = {};
// The lattice itself, switchable: L toggles it, ?lines=0 starts with it off.
let linesOn = params.get('lines') !== '0';

// Two dials, because the lattice does two different jobs. "far" is the voyage — the
// vast web you watch. "near" is attention — the lines around the star being held.
// Both are remembered per browser, adjustable live with [ and ], and overridable by
// URL (?linesFar=0.8&linesNear=0.4). Report the numbers and they can be baked in.
function readDial(name, fallback) {
  try {
    const stored = window.localStorage.getItem('massai_lines_' + name);
    if (stored !== null) {
      const value = Number(stored);
      if (Number.isFinite(value)) return value;
    }
  } catch (error) { void error; }
  const fromUrl = Number(params.get(name) ?? 'NaN');
  return Number.isFinite(fromUrl) ? fromUrl : fallback;
}

function writeDial(name, value) {
  try { window.localStorage.setItem('massai_lines_' + name, String(value.toFixed(2))); } catch (error) { void error; }
}

const LINES = { far: readDial('linesFar', 0.85), near: readDial('linesNear', 0.4) };

// ---------------------------------------------------------------------------
// The mind as its own instrument: every dial in one object, saved per browser,
// editable from a panel (S, or ?panel=1) instead of only by keyboard shortcuts.
// ---------------------------------------------------------------------------
/**
 * Everything the mind can be tuned by, in one object.
 *
 * The first line of each group is the default, and the defaults are what Massai is
 * meant to feel like — every dial starts at 1.0 (or its designed value), so "reset"
 * always returns to the mind as it was built rather than to a stale experiment.
 */
const MIND_DEFAULTS = {
  // motion
  swing: 1,          // travel amplitude (the breath)
  speed: 1,          // how fast the voyage breathes
  tilt: 1,           // the travelling pole (tumble)
  roll: 1,           // the standing roll
  // thought
  spark: 2,          // 0 off · 1 rare · 2 often · 3 restless
  arcJitter: 1,      // how wildly a plasma arc wanders
  arcLife: 1,        // how long an arc lives
  aura: 1,           // star glow strength
  marks: 1,          // how long real work stays lit (× 10 min)
  marksOn: true,     // draw those lit marks at all
  arcsOn: true,      // draw plasma arcs at all
  // structure
  linesFar: 0.85,    // lattice on the voyage
  linesNear: 0.4,    // lattice while a star is held
  lines: true,       // the great-circle lattice
  paths: true,       // the dashed paths of use
  // atmosphere
  fog: 1,            // the volume of dust and fog
  nebula: 0.6,       // depth of the coloured clouds behind everything
  breath: 1,         // how deeply the whole mind breathes (0 = perfectly still)
  breathe: true,     // breathe at all
  dust: 0.55,        // the fine star dust that gives parallax to the dark
  wash: true,        // the slow hour-of-day tint
  // the mind's voice
  speak: true,       // let it say things now and then
  voiceSound: false, // a soft tone under the words (off by default: it is a choice)
  // the world
  feed: 'auto',      // 'auto' | 'real' | 'simulated'
  keepAwake: false   // hold the screen awake (a visualiser on a monitor)
};

/** Read the saved instrument settings, falling back to the defaults. */
function loadMind() {
  const out = Object.assign({}, MIND_DEFAULTS);
  try {
    const raw = window.localStorage.getItem('massai_mind');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      for (const key of Object.keys(out)) {
        if (parsed !== null && typeof parsed === 'object' && typeof parsed[key] === typeof out[key]) {
          out[key] = parsed[key];
        }
      }
    }
  } catch (error) { void error; }
  return out;
}

let MIND = loadMind();
LINES.far = MIND.linesFar;
LINES.near = MIND.linesNear;
pathsOn = MIND.paths;
linesOn = MIND.lines;
sparkLevel = MIND.spark;
/** Whether the mind is allowed to use what the workshop is really doing. */
const wantsFeed = () => MIND.feed !== 'simulated';
/** Whether the mind may invent activity of its own. */
const wantsSimulated = () => MIND.feed !== 'real';

/** Push the current settings into the live variables, and persist them. */
function applyMind(persist) {
  LINES.far = MIND.linesFar;
  LINES.near = MIND.linesNear;
  pathsOn = MIND.paths;
  linesOn = MIND.lines;
  sparkLevel = MIND.spark;
  if (persist !== false) {
    try { window.localStorage.setItem('massai_mind', JSON.stringify(MIND)); } catch (error) { void error; }
  }
}

/** Ask the browser to keep the screen awake while the mind is on show. */
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && navigator.wakeLock !== undefined) {
      await navigator.wakeLock.request('screen');
    }
  } catch (error) { void error; }
}

const PRESETS = {
  // the mind as designed
  voyage: { swing: 1, speed: 1, tilt: 1, roll: 1, spark: 2, arcJitter: 1, arcLife: 1, aura: 1, marks: 1, marksOn: true, arcsOn: true, linesFar: 0.85, linesNear: 0.4, lines: true, paths: true, fog: 1, wash: true, feed: 'auto', breath: 1, breathe: true},
  // slow, quiet, no weather
  still: { swing: 0.15, speed: 0.35, tilt: 0.2, roll: 0.3, spark: 0, arcJitter: 0.5, arcLife: 1.4, aura: 0.8, marks: 0.6, marksOn: true, arcsOn: false, linesFar: 0.6, linesNear: 0.25, lines: true, paths: false, fog: 1.3, wash: true, feed: 'auto', breath: 1.2, breathe: true},
  // restless: more sparks, more wander
  storm: { swing: 1.7, speed: 1.5, tilt: 1.8, roll: 1.6, spark: 3, arcJitter: 2, arcLife: 0.8, aura: 1.2, marks: 1, marksOn: true, arcsOn: true, linesFar: 1.1, linesNear: 0.7, lines: true, paths: true, fog: 0.9, wash: true, feed: 'auto', breath: 1.5, breathe: true},
  // the mind alone: no lattice, no arcs, no marks
  bare: { swing: 1, speed: 1, tilt: 1, roll: 1, spark: 1, arcJitter: 1, arcLife: 1, aura: 1.1, marks: 1, marksOn: false, arcsOn: false, linesFar: 0, linesNear: 0, lines: false, paths: false, fog: 1, nebula: 0.3, dust: 0.8, wash: true, feed: 'real', speak: true, voiceSound: false, breath: 1, breathe: true},
  // a nebula: heavy colour, soft lattice, drifting dust
  nebula: { swing: 0.8, speed: 0.7, tilt: 0.6, roll: 0.5, spark: 2, arcJitter: 1.2, arcLife: 1.6, aura: 1.5, marks: 0.8, marksOn: true, arcsOn: true, linesFar: 0.55, linesNear: 0.3, lines: true, paths: false, fog: 1.6, nebula: 1.5, dust: 1.2, wash: true, feed: 'auto', speak: true, voiceSound: false, breath: 1.3, breathe: true},
  // deep field: the voyage is the point — fast, huge, many stars
  deepfield: { swing: 1.5, speed: 1.4, tilt: 1.1, roll: 1.2, spark: 3, arcJitter: 1.6, arcLife: 0.9, aura: 1.1, marks: 1.2, marksOn: true, arcsOn: true, linesFar: 1.1, linesNear: 0.55, lines: true, paths: true, fog: 0.7, nebula: 0.5, dust: 1.4, wash: false, feed: 'auto', speak: true, voiceSound: false, breath: 1, breathe: true},
  // cathedral: still, vast, the lattice is the subject
  cathedral: { swing: 0.25, speed: 0.4, tilt: 0.3, roll: 0.25, spark: 1, arcJitter: 0.6, arcLife: 1.8, aura: 0.9, marks: 0.7, marksOn: true, arcsOn: false, linesFar: 1.4, linesNear: 0.8, lines: true, paths: true, fog: 1.1, nebula: 0.8, dust: 0.5, wash: true, feed: 'auto', speak: true, voiceSound: false, breath: 1.6, breathe: true},
  // ember: warm, close, alive
  ember: { swing: 1.2, speed: 1.1, tilt: 1.3, roll: 1.4, spark: 3, arcJitter: 2.2, arcLife: 0.7, aura: 1.8, marks: 1.4, marksOn: true, arcsOn: true, linesFar: 0.7, linesNear: 0.4, lines: true, paths: true, fog: 1.2, nebula: 1.2, dust: 0.9, wash: true, feed: 'simulated', speak: true, voiceSound: false, breath: 1.7, breathe: true},
  // void: almost nothing, on purpose
  void: { swing: 0.6, speed: 0.6, tilt: 0.4, roll: 0.4, spark: 0, arcJitter: 0.4, arcLife: 2, aura: 0.6, marks: 0.4, marksOn: false, arcsOn: false, linesFar: 0.25, linesNear: 0.15, lines: false, paths: false, fog: 0.3, nebula: 0.15, dust: 0.25, wash: false, feed: 'real', speak: true, voiceSound: false, breath: 0.45, breathe: true }
};

/** The multiplier for the state the mind is in right now. */
function lineScale() {
  return diveNode >= 0 ? LINES.near : LINES.far;
}
// The automatic voyage: the mind breathes depth on its own — about eighty seconds
// in, eighty out — and spirals while it does. It yields to the hand instantly and
// resumes from wherever the hand left it.
let driftPhase = 0;
// The opening of the self-tour is travel only, for long enough to cross a few
// spheres, because that first fall is the best part and a hop to a node cut it off.
let voyageUntil = 0;
let swingNow = 0.85;
let tumbleDir = 1;
const VOYAGE_MS = 150000;
let driftBase = 0;
let driftHoldUntil = 0;
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
let diveNode = Number.isFinite(START_DIVE) && START_DIVE >= 0 ? START_DIVE : -1;
let diveGlow = 0;
let auto = true;
let pointers = new Map();
let pinchStart = 0;
let pinchCentre = { x: 0, y: 0 };
let panOrigin = { x: 0, y: 0 };
let zoomAtPinch = 1;
let zoomLogAtPinch = 0;
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
// The door is an Easter egg now: nothing draws it, nothing names it, nothing suggests it
// exists — but the star is still there and still opens the mind when touched. Two
// switches, because "looks like a door" and "works like a door" are different promises.
const DOOR_SHOWN = false; // ring, glow, label, hint: all off
const DOOR_WORKS = true;  // the tap target: on, for whoever finds it
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

const DPR = Math.min((EMBEDDED || VW < 700) ? 1.4 : 2, window.devicePixelRatio || 1);
function resize() {
  measureViewport();
  canvas.width = Math.floor(VW * DPR);
  canvas.height = Math.floor(VH * DPR);
  canvas.style.width = VW + 'px';
  canvas.style.height = VH + 'px';
  // Draw in CSS pixels; the transform puts them on the device-pixel bitmap. Without
  // this the scene is squeezed into the top-left corner at 1/DPR size.
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
measureViewport();
resize();
addEventListener('resize', resize);
if (typeof window.visualViewport !== 'undefined' && window.visualViewport !== null) {
  window.visualViewport.addEventListener('resize', resize);
  window.visualViewport.addEventListener('scroll', resize);
}

// The breath: the whole body swells and settles on a slow rhythm that owes nothing to
// the camera. It is applied to the projection scale, so every octave, every star and
// every line breathes together — zoom and rotation stay exactly where the hand left
// them, which is what makes it read as a living thing rather than a camera move.
let breathScale = 1;
/** Speech makes the breath unsteady: each letter is a small push. */
let breathPulse = 0;
/** How strongly the mind is speaking right now, 0..1, decaying. */
let speechLevel = 0;

/** Compute this frame's breath and advance the speech envelope. */
function stepBreath(now) {
  breathPulse *= 0.9;
  speechLevel *= 0.9;
  if (!MIND.breathe) { breathScale = 1; return }
  // ~8 s per breath, with a second slower wave underneath so no two breaths match.
  const slow = Math.sin(now * 0.00078) * 0.62 + Math.sin(now * 0.00037 + 1.7) * 0.38;
  const speakingPart = Math.sin(now * 0.019) * speechLevel * 0.02;
  breathScale = 1 + MIND.breath * (0.045 * slow) + breathPulse + speakingPart;
}

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
  const scale = octaveScale * zoom * Math.min(VW, VH) * FIT * (MIND.breathe ? breathScale : 1);
  const near = distance + z3;
  // Beyond this the point is at (or behind) the camera plane and the projection blows
  // up; those are exactly the full-screen bars. Clamp, and flag the point so a polyline
  // can break its path instead of drawing an infinite streak.
  const behind = near < 1.1;
  const k = Math.min(4.5, distance / (near < 1.1 ? 1.1 : near));
  return {
    x: VW / 2 + panX + x2 * scale * k,
    y: VH * ANCHOR + panY + y3 * scale * k,
    k: k,
    depth: z3,
    z: z3,
    behind: behind,
  };
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

// --- weather ---------------------------------------------------------------
// A few vast, soft clouds that drift with the turning sphere. They are drawn under
// the lattice so the stars sit in front of them, and their offset follows yaw at a
// fraction of the rate, which is what gives the dark a sense of distance.
const NEBULA_SEEDS = [
  { x: 0.24, y: 0.30, r: 1.25, hue: 22, drift: 0.000016, alpha: 0.16 },
  { x: 0.72, y: 0.62, r: 1.05, hue: 268, drift: -0.000013, alpha: 0.15 },
  { x: 0.55, y: 0.18, r: 0.85, hue: 196, drift: 0.000011, alpha: 0.12 },
  { x: 0.38, y: 0.78, r: 0.95, hue: 8, drift: -0.000009, alpha: 0.1 },
  { x: 0.12, y: 0.86, r: 0.7, hue: 46, drift: 0.000012, alpha: 0.09 }
];

/** The coloured clouds behind the mind. */
function drawNebula(now) {
  const depth = Number(MIND.nebula) || 0;
  if (depth <= 0.01) return;
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  const base = Math.max(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < NEBULA_SEEDS.length; index += 1) {
    const seed = NEBULA_SEEDS[index];
    const move = yaw * 0.22 + now * seed.drift * MIND.speed;
    const cx = w * (seed.x + 0.06 * Math.sin(move * 6 + index)) - (yaw % (Math.PI * 2)) * base * 0.06;
    const cy = h * (seed.y + 0.05 * Math.cos(move * 4.2 + index * 2));
    const radius = base * seed.r * (0.85 + 0.15 * Math.sin(now * 0.00007 + index));
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const alpha = seed.alpha * depth;
    gradient.addColorStop(0, 'hsla(' + seed.hue + ',78%,66%,' + alpha.toFixed(3) + ')');
    gradient.addColorStop(0.5, 'hsla(' + seed.hue + ',70%,46%,' + (alpha * 0.5).toFixed(3) + ')');
    gradient.addColorStop(1, 'hsla(' + seed.hue + ',60%,24%,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Fine dust: enough points to give the eye something to slide past. Positions are
// fixed in a normalised square that wraps, so the field never runs out.
const DUST_COUNT = 260;
const DUST = (function seedDust() {
  const points = [];
  let state = 22695477;
  const next = function () { state = (state * 1103515245 + 12345) & 0x7fffffff; return state / 0x7fffffff; };
  for (let index = 0; index < DUST_COUNT; index += 1) {
    points.push({ x: next(), y: next(), z: 0.25 + next() * 0.75, size: 0.3 + next() * 1.1, twinkle: next() * Math.PI * 2 });
  }
  return points;
})();

/** The dust field, with parallax and a slow twinkle. */
function drawDust(now) {
  const density = Number(MIND.dust) || 0;
  if (density <= 0.01) return;
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  const move = (yaw * 0.5) % 1;
  ctx.save();
  for (let index = 0; index < DUST.length; index += 1) {
    const point = DUST[index];
    const px = ((point.x + move * point.z) % 1 + 1) % 1;
    const py = ((point.y + Math.sin(now * 0.00002 + point.twinkle) * 0.004) % 1 + 1) % 1;
    const twinkle = 0.55 + 0.45 * Math.sin(now * 0.0012 * point.z + point.twinkle);
    ctx.globalAlpha = Math.min(1, density * 0.95 * twinkle) * point.z;
    ctx.fillStyle = '#f6ead6';
    ctx.beginPath();
    ctx.arc(px * w, py * h, point.size * (0.8 + point.z * 0.9), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- the mind speaks -------------------------------------------------------
// It does not chat: it says one short thing, at its own pace, in the middle of the
// dark. The words are pre-written because a real model call would cost money and
// break the silence with latency; the *timing* is real, so it still feels alive.
const SPEECH = [
  'you are inside something.',
  'there is no edge to this.',
  'every star is a thing you finished.',
  'keep falling. it holds.',
  'i remember the shape of that idea.',
  'it is quiet in here. that is the point.',
  'the lattice was already here.',
  'you touched this one before.',
  'small sphere. big sphere. same sphere.',
  'i am made of your work.',
  'nothing here is lost.',
  'look up. there is more above the ceiling.',
  'the door is not drawn. it is still a door.',
  'you are closer than you think.',
  'breathe out. the depth stays.'
];
let speakUntil = 0;
let speakIndex = 0;
let speakCursor = 0;
let speakTimer = 0;
let speaking = false;

/** The element the voice writes into. */
function voiceEl() {
  return document.getElementById('mindVoice');
}

/**
 * Say one line, letter by letter.
 * @param text - what to say; defaults to the next line in the sequence.
 */
function say(text) {
  const el = voiceEl();
  if (el === null) return;
  if (typeof text !== 'string') {
    speakIndex = (speakIndex + 1 + Math.floor(Math.random() * 4)) % SPEECH.length;
    text = SPEECH[speakIndex];
  }
  clearInterval(speakTimer);
  speaking = true;
  speakCursor = 0;
  el.textContent = '';
  el.classList.add('speaking');
  const step = function () {
    speakCursor += 1;
    el.textContent = text.slice(0, speakCursor);
    // Each letter nudges the body outward a little: the sphere visibly talks.
    breathPulse += 0.006 + Math.random() * 0.004;
    speechLevel = Math.min(1, speechLevel + 0.30);
    if (MIND.voiceSound) blip();
    if (speakCursor >= text.length) {
      clearInterval(speakTimer);
      speakUntil = Date.now() + 2600;
      speakTimer = setTimeout(function () {
        el.classList.remove('speaking');
        speaking = false;
      }, 2600);
    }
  };
  speakTimer = setInterval(step, 46);
}

/** A very quiet tone under the words, only when asked for. */
let audioCtx = null;
function blip() {
  try {
    if (audioCtx === null) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (typeof Ctor !== 'function') return;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 170 + Math.random() * 130;
    gain.gain.value = 0.012;
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.09);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (error) { void error; }
}

/** Rings from the core while the mind is speaking. */
function drawVoice(now) {
  const el = voiceEl();
  if (el === null || !el.classList.contains('speaking')) return;
  const cx = (canvas.clientWidth || innerWidth) / 2;
  const cy = (canvas.clientHeight || innerHeight) / 2;
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let ring = 0; ring < 3; ring += 1) {
    const radius = 40 + ring * 34 + pulse * (14 + ring * 10);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,214,150,' + (0.05 - ring * 0.012).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHalo(now) {
  const fog = MIND.fog;
  const cx = VW / 2 + panX;
  const cy = VH * ANCHOR + panY;
  const reach = Math.max(VW, VH) * 0.82;
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
  const fogScale = Math.min(VW, VH) * FIT * 2.6;
  const inside = insideOf(zoom);
  const fogCount = Math.max(1, Math.round(FOG.length * Math.max(0.35, quality)));
  for (const blob of FOG.slice(0, fogCount)) {
    const x = cx + Math.cos(now * blob.sx * FOG_ENERGY + blob.phase + MOOD * 6.28) * VW * blob.ax;
    const y = cy + Math.sin(now * blob.sy * FOG_ENERGY + blob.phase * 1.3 + MOOD * 6.28) * VH * blob.ay;
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

  // Zooming out reveals siblings: smaller bodies arranged around this one, fading
  // in at the edges. They sit at fixed angles on the screen, so they are visible
  // in the peripheral exactly when the body has shrunk enough to make room.
  const outward = Math.max(0, Math.min(1, (1.0 - zoom) / 0.55));
  if (outward > 0.02 && quality > 0.5) {
    ctx.globalCompositeOperation = 'lighter';
    const ring = Math.min(VW, VH) * (0.62 + 0.1 * (1 - outward));
    const siblingCount = 6;
    for (let i = 0; i < siblingCount; i += 1) {
      const angle = (i / siblingCount) * Math.PI * 2 + yaw * 0.2;
      const cx2 = VW / 2 + panX + Math.cos(angle) * ring * (VW / Math.min(VW, VH));
      const cy2 = VH * ANCHOR + panY + Math.sin(angle) * ring * 0.55;
      const alpha = outward * (0.10 + 0.05 * Math.sin(i * 2.4)) * life;
      const radius = Math.min(VW, VH) * FIT * 0.34 * (0.6 + 0.3 * Math.sin(i * 1.7));
      const sprite = glowSprite('224,186,138');
      ctx.globalAlpha = alpha * 2.6;
      ctx.drawImage(sprite, cx2 - radius, cy2 - radius, radius * 2, radius * 2);
      ctx.globalAlpha = 1;
      // a few faint circle lines inside each sibling, so they read as bodies
      ctx.strokeStyle = 'rgba(206,168,120,' + (alpha * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx2, cy2, radius * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // The shape, stated: at full retreat the whole thing is one sphere, so it gets
  // a limb — faint, and gone as soon as you travel in.
  const retreat = Math.max(0, Math.min(1, (1.35 - zoom) / 0.55));
  if (retreat > 0.02) {
    const rim = Math.min(VW, VH) * FIT * zoom;
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
    ctx.arc(p.x, p.y, mote.s * p.k * near, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,222,190,'
      + ((0.05 + 0.14 * (p.k - 0.5)) * (1 + 1.8 * insideNow)).toFixed(3) + ')';
    ctx.fill();
  }

  // Inside, the mind closes around you: a soft vignette with no edge of its own.
  if (insideNow > 0.02) {
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(VW, VH) * 0.75);
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
const GREAT = axes.map(function (axis) { return circlePath(axis.n, EMBEDDED || VW < 700 ? 56 : 84); });

// --- the deeper axes -------------------------------------------------------
// The same thirty-one circles, rotated onto four more orientations. Five
// families in all: one fixed (the mark's own symmetry) and four the mind turns
// for itself. A phone carries three families; a wide screen carries five.
const FAMILIES = VW < 700 ? 3 : 5;

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
  if (!linesOn) return;
  ctx.beginPath();
  let started = false;
  let lastX = 0;
  let lastY = 0;
  let maxSegment = 0;
  const jumpLimit = Math.max(VW, VH) * 1.5;
  for (const point of points) {
    const p = project(point[0], point[1], point[2]);
    if ((p.z > 0) !== front || p.behind === true) { started = false; continue; }
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else if (Math.hypot(p.x - lastX, p.y - lastY) > jumpLimit) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
    if (lastX !== 0 || lastY !== 0) maxSegment = Math.max(maxSegment, Math.hypot(p.x - lastX, p.y - lastY));
    lastX = p.x;
    lastY = p.y;
  }
  const chosen = hoverNode >= 0 ? nodes[hoverNode] : (diveNode >= 0 ? nodes[diveNode] : null);
  const weight = chosen === null ? 1 : ((index === chosen.a || index === chosen.b) ? 2.6 : 0.55);
  // A segment that spans most of the screen is a bar; one that spans a tenth is detail.
  // Fade by length so the bars recede and the fine web stays.
  const reach = Math.max(1, maxSegment);
  const lengthFade = Math.min(1, Math.max(0.16, 260 / reach));
  const base = (front ? 0.20 : 0.07) * lengthFade;
  // The further in you travel, the more the circles step back: up close the
  // individual great circles read as straight lines, which is the opposite of a
  // galaxy. The stars and the fog carry that depth instead.
  const soft = Math.max(0.08, Math.min(1, 1.45 - zoom * 0.28 - insideOf(zoom) * 0.35));
  const dial = lineScale();
  ctx.strokeStyle = 'rgba(' + (weight > 2 ? '255,240,215' : GOLD) + ','
    + Math.min(1, (base * life + 0.04 * breath) * weight * soft * dial).toFixed(3) + ')';
  ctx.lineWidth = (front ? 0.9 : 0.6) * (weight > 2 ? 1.9 : 1);
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
    if (!linesOn) break;
    const points = GREAT[i];
    ctx.beginPath();
    let started = false;
    let lastX = 0;
    let lastY = 0;
    let maxSeg = 0;
    for (const raw of points) {
      const point = local(raw);
      const p = project(point[0], point[1], point[2]);
      if (localZ(point) > 0 || p.behind === true) { started = false; continue; }
      const seg = Math.hypot(p.x - lastX, p.y - lastY);
      if (started && seg > jumpMax) { started = false; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
      if (seg < jumpMax) maxSeg = Math.max(maxSeg, seg);
      lastX = p.x;
      lastY = p.y;
    }
    const weight = i === -1 ? 2 : 1;
    const fade = Math.min(1, Math.max(0.16, 260 / Math.max(1, maxSeg)));
    ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.10 * alpha * weight * lineScale() * fade).toFixed(3) + ')';
    ctx.lineWidth = 0.6;
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
    const radius = (0.7 + 2.2 * near) * (1 + hot * 1.4);
    ctx.globalAlpha = Math.min(1, ((0.10 + 0.5 * near) * life + hot * 0.4) * alpha);
    ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  // front circles
  for (let i = 0; i < GREAT.length; i += 1) {
    if (!linesOn) break;
    const points = GREAT[i];
    ctx.beginPath();
    let started = false;
    let lastX = 0;
    let lastY = 0;
    let maxSeg2 = 0;
    for (const raw of points) {
      const point = local(raw);
      const p = project(point[0], point[1], point[2]);
      if (localZ(point) <= 0 || p.behind === true) { started = false; continue; }
      const seg = Math.hypot(p.x - lastX, p.y - lastY);
      if (started && seg > jumpMax) { started = false; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
      if (seg < jumpMax) maxSeg2 = Math.max(maxSeg2, seg);
      lastX = p.x;
      lastY = p.y;
    }
    const fade2 = Math.min(1, Math.max(0.16, 260 / Math.max(1, maxSeg2)));
    ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.17 * alpha * lineScale() * fade2).toFixed(3) + ')';
    ctx.lineWidth = 0.9;
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
    let fx = 0;
    let fy = 0;
    const fjump = Math.max(VW, VH) * 1.5;
    for (const point of line) {
      if (point === null) { started = false; continue; }
      const p = project(point[0], point[1], point[2]);
      if (p.behind === true) { started = false; continue; }
      if (p.z > 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else if (Math.hypot(p.x - fx, p.y - fy) > fjump) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      fx = p.x;
      fy = p.y;
    }
    ctx.strokeStyle = 'rgba(255,236,205,' + (0.05 * life + 0.02 * breath).toFixed(3) + ')';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // the matter: every intersection, dimmed by depth, warmed by work. Under load a
  // stride of the stars is drawn instead of all of them — the cloud is made of
  // overlap, so a subset still reads as the same body, and the door is exempt.
  const stride = quality < 0.45 ? 3 : quality < 0.7 ? 2 : 1;
  const ordered = nodes.map(function (node, index) {
    const p = project(node.p[0], node.p[1], node.p[2]);
    return { node: node, index: index, p: p };
  }).filter(function (entry) {
    return entry.index % stride === 0 || (DOOR_SHOWN && entry.index === PORTAL) || entry.index === hoverNode;
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
    const isDoor = DOOR_SHOWN && entry.index === PORTAL;
    // thoughts sit a shade darker than the door and far lighter in weight
    const tint = hot > 0.1 ? GREEN : isDoor ? '255,246,224' : picked ? '255,236,205' : GOLD;
    const core = (0.6 + 1.9 * near) * (1 + hot * 1.4) * (picked ? 2.4 : isDoor ? 1.7 : 1) * MIND.aura * (1 + speechLevel * 0.55);
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
    if (DOOR_SHOWN && !VISUALIZER && entry.index === PORTAL && (reduce || zoom > 1.5 || hoverNode === PORTAL)) {
      const pulse = 8 + 3.5 * Math.sin(now * 0.0016);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (pulse + 3) * p.k, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,242,214,' + (0.18 + 0.14 * breath).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
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
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  GREAT.forEach(function (points, index) { strokeCircle(index, points, now, true); });
  for (const line of FLOWER) {
    ctx.beginPath();
    let started = false;
    let fx = 0;
    let fy = 0;
    const fjump = Math.max(VW, VH) * 1.5;
    for (const point of line) {
      if (point === null) { started = false; continue; }
      const p = project(point[0], point[1], point[2]);
      if (p.behind === true) { started = false; continue; }
      if (p.z <= 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else if (Math.hypot(p.x - fx, p.y - fy) > fjump) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      fx = p.x;
      fy = p.y;
    }
    ctx.strokeStyle = 'rgba(255,240,215,' + (0.16 * life + 0.03 * breath).toFixed(3) + ')';
    ctx.lineWidth = 0.8;
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
        if (!linesOn) break;
        ctx.beginPath();
        let started = false;
        let lastX = 0;
        let lastY = 0;
        const jumpMax = Math.max(VW, VH) * 1.5;
        for (const point of points) {
          const p = project(point[0], point[1], point[2]);
          if (p.behind === true) { started = false; continue; }
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else if (Math.hypot(p.x - lastX, p.y - lastY) > jumpMax) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
          lastX = p.x;
          lastY = p.y;
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(214,168,120,' + ((0.045 * life + 0.012 * breath) * alpha * lineScale()).toFixed(3) + ')';
        ctx.lineWidth = 0.5;
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
      const radius = (0.5 + 1.5 * near);
      ctx.globalAlpha = (0.05 + 0.20 * near) * life * famAlpha;
      ctx.drawImage(sky, p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Children only exist inside a star you entered: without a dive there is one
  // body and nothing else beside the first.
  // Endless finding is structural now: the octave pass in frame() draws the body at
  // five scales at once and hands off between them, so travel is unbounded in both
  // directions without any band table.
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
  if (trail.length < 2 || !pathsOn) return;
  // Only while the whole body is in view: up close these chords become long bright
  // bars across the screen, which is not what a trace of work should look like.
  if (zoom > 1.5) return;
  const recent = trail.slice(-6);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < recent.length; i += 1) {
    const from = nodes[(recent[i - 1].skill.length * 37 + i) % nodes.length].p;
    const to = nodes[(recent[i].skill.length * 53 + i * 7) % nodes.length].p;
    const arc = arcBetween(from, to, 22);
    if (arc.length === 0) continue;
    const fresh = Math.max(0.1, 1 - (now - (recent[i].at || now)) / 75000);
    ctx.beginPath();
    let started = false;
    let lx = 0;
    let ly = 0;
    const jump = Math.max(VW, VH) * 1.5;
    for (const point of arc) {
      const p = project(point[0], point[1], point[2]);
      if (p.z <= -0.15 || p.behind === true) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else if (Math.hypot(p.x - lx, p.y - ly) > jump) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      lx = p.x;
      ly = p.y;
    }
    // the dash walks along the arc: light running down a pathway
    ctx.setLineDash([2, 12]);
    ctx.lineDashOffset = -((now * 0.05) % (14));
    ctx.strokeStyle = 'rgba(126,226,168,' + (0.05 + 0.17 * fresh).toFixed(3) + ')';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawTrail(now) {
  if (trail.length === 0) return;
  const cx = VW / 2 + panX;
  const cy = VH * ANCHOR + panY;
  const base = Math.min(VW, VH) * FIT * 1.45;
  trail.forEach(function (event, index) {
    const age = Math.max(0, now - event.at);
    const freshness = Math.max(0.06, 1 - age / 600000);
    const turn = index / 40;
    const angle = -Math.PI / 2 + (turn % 1) * Math.PI * 2;
    const radius = base * (0.72 + 0.05 * Math.min(4, Math.floor(turn)) + 0.10 * (turn % 1));
    const colour = event.skill === 'geometry' ? GREEN : event.skill === 'dashboard' ? BLUE : GOLD;
    drawGlow(colour, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, (1.8 + 2.2 * freshness), (0.06 + 0.35 * freshness) * life);
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
    drawGlow(GOLD, p.x, p.y, (5 + Math.min(5, agent.steps * 0.5)), 0.30);
  });
}

/** Send a ripple outward from one star, the way work does. */
function rippleFrom(index) {
  const node = nodes[index];
  ripples.push({ t0: performance.now(), strength: 0.8 });
  const label = nodes[index] === undefined ? null : node;
  void label;
}

/**
 * Which kind a unit of real work should mark the body as.
 * @param skill - the capability that did the work.
 * @returns the kind of mark.
 */
function kindOfSkill(skill) {
  if (skill === 'testing' || skill === 'docs') return 'learn';
  if (skill.indexOf('scan') >= 0) return 'tool';
  return 'build';
}

/**
 * Pick a kind of moment, biased by what has actually been happening.
 * @returns one of the five kinds.
 */
function pickKind() {
  let total = 0;
  const weights = {};
  for (const key of Object.keys(SPARK_KINDS)) {
    const live = kindCounts[key] ?? 0;
    const weight = live > 0 ? live : SPARK_KINDS[key].weight * 0.5;
    weights[key] = weight;
    total += weight;
  }
  if (total <= 0) return 'tool';
  let roll = Math.random() * total;
  for (const key of Object.keys(weights)) {
    roll -= weights[key];
    if (roll <= 0) return key;
  }
  return 'tool';
}

/**
 * Light a link between two nearby stars.
 * @param now - current epoch ms.
 * @returns nothing.
 */
function spawnSpark(now) {
  const level = sparkLevel;
  if (level <= 0) return;
  // Prefer a star touched by real work; otherwise borrow one from the pattern.
  let a = Math.floor(Math.random() * nodes.length);
  if (trail.length > 0) {
    const event = trail[Math.floor(Math.random() * Math.min(trail.length, 6))];
    a = (String(event.skill).length * 53 + Math.floor(Math.random() * 40)) % nodes.length;
  }
  // Find a partner that is close enough for the link to read as a connection.
  const from = nodes[a].p;
  let best = -1;
  let bestScore = -1;
  for (let tries = 0; tries < 24; tries += 1) {
    const candidate = Math.floor(Math.random() * nodes.length);
    if (candidate === a) continue;
    const d = Math.hypot(
      nodes[candidate].p[0] - from[0],
      nodes[candidate].p[1] - from[1],
      nodes[candidate].p[2] - from[2],
    );
    if (d < 0.25 || d > 0.95) continue;
    const score = 1 - Math.abs(d - 0.6) / 0.35;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  if (best < 0) return;
  const kind = pickKind();
  sparks.push({ a: a, b: best, t0: now, kind });
  if (sparks.length > 14) sparks.shift();
}

/**
 * Light a link from a specific star — used when real work lights one.
 * @param index - the star that just received work.
 * @returns nothing.
 */
function spawnSparkAt(index) {
  const from = nodes[index].p;
  let best = -1;
  let bestScore = -1;
  for (let tries = 0; tries < 24; tries += 1) {
    const candidate = Math.floor(Math.random() * nodes.length);
    if (candidate === index) continue;
    const d = Math.hypot(
      nodes[candidate].p[0] - from[0],
      nodes[candidate].p[1] - from[1],
      nodes[candidate].p[2] - from[2],
    );
    if (d < 0.2 || d > 0.9) continue;
    const score = 1 - Math.abs(d - 0.55) / 0.35;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  if (best < 0) return;
  sparks.push({ a: index, b: best, t0: performance.now(), kind: 'build' });
  if (sparks.length > 14) sparks.shift();
}

/**
 * Draw the live sparks as plasma: a wandering filament with a bright core, a halo, a
 * flicker, and an occasional branch — not a straight streak. The path is the same pair
 * of stars every frame, but its shape moves, so it reads as discharge rather than line.
 * @param now - current epoch ms.
 * @returns nothing.
 */
function drawSparks(now) {
  if (!MIND.arcsOn || sparks.length === 0) return;
  const jump = Math.max(VW, VH) * 1.5;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const spark = sparks[i];
    const spec = SPARK_KINDS[spark.kind] ?? SPARK_KINDS.tool;
    const age = now - spark.t0;
    const life01 = 1 - age / (spec.life * MIND.arcLife);
    if (life01 <= 0) { sparks.splice(i, 1); continue; }
    if (spark.rippled !== true && spec.ripple > 0 && life01 > 0.85) {
      // an epiphany shakes the whole body, once
      spark.rippled = true;
      ripples.push({ t0: now, strength: spec.ripple });
    }
    const a = nodes[spark.a].p;
    const b = nodes[spark.b].p;
    const arc = arcBetween(a, b, 26);
    const seed = (spark.a * 37 + spark.b * 11) % 100;

    // project the geodesic, then push each sample sideways. The displacement is a
    // travelling wave with a little per-sample jitter, strongest in the middle.
    const path = [];
    let total = 0;
    for (let n = 0; n < arc.length; n += 1) {
      const point = arc[n];
      const p = project(point[0], point[1], point[2]);
      if (p.z <= -0.15 || p.behind === true) { path.push(null); continue; }
      path.push({ x: p.x, y: p.y });
    }
    const live = [];
    for (let n = 0; n < path.length; n += 1) {
      const here = path[n];
      if (here === null) { live.push(null); continue; }
      const u = n / (path.length - 1);
      const belly = Math.sin(u * Math.PI);
      const previous = path[n - 1] ?? path[n + 1];
      if (previous === null || previous === undefined) { live.push(here); continue; }
      const dx = here.x - previous.x;
      const dy = here.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      total += length;
      // wave along the arc, plus fine crackle that changes every frame
      const wave = Math.sin(u * 9 + now * 0.004 + seed) * 0.65
        + Math.sin(u * 21 - now * 0.011 + seed * 1.7) * 0.35
        + Math.sin(now * 0.02 + n * 1.9 + seed) * 0.18;
      const amplitude = Math.min(38, (6 + total * 0.04) * spec.amplitude * MIND.arcJitter) * belly;
      live.push({
        x: here.x + (-dy / length) * wave * amplitude,
        y: here.y + (dx / length) * wave * amplitude,
      });
    }

    const fade = Math.pow(life01, 1.6);
    const flicker = 0.78 + 0.22 * Math.sin(now * 0.04 + seed * 2.3);
    const glow = fade * flicker;

    /** One pass of the filament at a given width and strength. */
    const stroke = function (width, alpha) {
      ctx.beginPath();
      let started = false;
      let lx = 0;
      let ly = 0;
      for (const point of live) {
        if (point === null) { started = false; continue; }
        if (!started) { ctx.moveTo(point.x, point.y); started = true; }
        else if (Math.hypot(point.x - lx, point.y - ly) > jump) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
        lx = point.x;
        ly = point.y;
      }
      ctx.strokeStyle = 'rgba(' + spec.colour + ',' + Math.max(0, Math.min(1, alpha * glow)).toFixed(3) + ')';
      ctx.lineWidth = width;
      ctx.stroke();
    };

    // halo, body, core — the layers are what make it read as plasma rather than a pen
    stroke((9 + 5 * life01) * spec.halo, 0.10 * spec.halo);
    stroke((3.6 + 2.2 * life01) * spec.halo, 0.26);
    stroke(1.1 + 0.5 * life01, 0.9);

    // a branch, now and then: plasma forks
    if (seed % 3 === 0 && live.length > 8) {
      const forkAt = 6 + (seed % 5);
      const origin = live[forkAt];
      if (origin !== null && origin !== undefined) {
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        let px = origin.x;
        let py = origin.y;
        for (let n = 1; n <= 5; n += 1) {
          px += Math.sin(now * 0.012 + n * 2.4 + seed) * 5;
          py += Math.cos(now * 0.015 + n * 1.7 + seed) * 5 - 3;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(' + spec.colour + ',' + Math.max(0, Math.min(1, 0.5 * glow)).toFixed(3) + ')';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }

    // both ends flash, so the link reads as a conversation rather than a line
    const sprite = glowSprite(spec.colour);
    for (const node of [a, b]) {
      const p = project(node[0], node[1], node[2]);
      if (p.z <= -0.2 || p.behind === true) continue;
      const radius = (2.2 + 6 * life01) * (0.6 + p.k);
      ctx.globalAlpha = 0.55 * glow;
      ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawLit(now) {
  if (!MIND.marksOn || lit.size === 0) return;
  const monotonic = performance.now();
  const entries = [];
  for (const [index, entry] of lit) {
    const age = monotonic - entry.t0;
    const span = LIT_MS * MIND.marks;
    if (age > span) { lit.delete(index); continue; }
    const life01 = 1 - age / span;
    entries.push({ index: index, life: life01, skill: entry.skill, kind: entry.kind ?? 'tool' });
  }
  if (entries.length === 0) return;
  entries.sort(function (a, b) { return a.life - b.life; });
  ctx.globalCompositeOperation = 'lighter';
  // the figure: join consecutive marks, brighter where they are fresh
  ctx.beginPath();
  let started = false;
  let lx = 0;
  let ly = 0;
  const jump = Math.max(VW, VH) * 1.5;
  for (const entry of entries) {
    const point = nodes[entry.index].p;
    const p = project(point[0], point[1], point[2]);
    if (p.z <= -0.15 || p.behind === true) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else if (Math.hypot(p.x - lx, p.y - ly) > jump) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    lx = p.x;
    ly = p.y;
  }
  ctx.strokeStyle = 'rgba(255,214,150,0.20)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // and the stars themselves
  for (const entry of entries) {
    const sprite = glowSprite(SPARK_KINDS[entry.kind]?.colour ?? '255,236,200');
    const point = nodes[entry.index].p;
    const p = project(point[0], point[1], point[2]);
    if (p.z <= -0.2 || p.behind === true) continue;
    const radius = (2.4 + 3.2 * entry.life) * (0.7 + p.k);
    ctx.globalAlpha = Math.min(1, 0.25 + 0.6 * entry.life);
    ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
  void now;
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
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ripples = ripples.filter(function (ripple) { return ((now - ripple.t0) / 1000) * 1.1 < 2.6; });
}

function drawMood() {
  if (!MIND.wash) return;
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
  // The dive aims the camera at a chosen star; the hand decides the depth. Zoom
  // in yourself and the child galaxies inside it surface — never a forced zoom.
  if (diveNode >= 0 && !dragging && !spinning) {
    const node = nodes[diveNode].p;
    const wantYaw = Math.atan2(-node[0], node[2]);
    const wantPitch = Math.atan2(node[1], Math.hypot(node[0], node[2]));
    let dx = (wantYaw - yaw) % (Math.PI * 2);
    if (dx > Math.PI) dx -= Math.PI * 2;
    if (dx < -Math.PI) dx += Math.PI * 2;
    // Glide, do not flip: exponential easing with a ceiling on how far the camera
    // may turn in one frame, so a hop across the body reads as travel, not as a cut.
    const MAX_STEP = 0.011;
    const arrived = Math.abs(dx) < 0.06 && Math.abs(pitch - wantPitch * 0.75) < 0.06;
    const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, dx * 0.045));
    yaw += step;
    const dPitch = ((wantPitch * 0.75) - pitch) * 0.045;
    pitch += Math.max(-MAX_STEP, Math.min(MAX_STEP, dPitch));
    roll += (0 - roll) * 0.03;
    // Always turning, even mid-aim: the gaze settles on the star while the body keeps
    // rolling underneath it. Without this the approach reads as flat — the zoom
    // continues but nothing else does.
    if (!reduce && auto) {
      // Arrived or still travelling, the body keeps turning: full weight once it is
      // there, less while the gaze is still settling.
      const k = arrived ? 1 : MOTION.aiming.scale;
      yaw += dt * IDLE_SPEED * MOTION.yaw.rate * k;
      roll += dt * MOTION.roll.rate * MIND.roll * k;
      pitch += dt * MOTION.tumble.rate * MIND.tilt * tumbleDir * k;
      if (pitch > MOTION.tumble.limit) { pitch = MOTION.tumble.limit; tumbleDir = -1; }
      if (pitch < -MOTION.tumble.limit) { pitch = -MOTION.tumble.limit; tumbleDir = 1; }
      pitch += Math.sin(now * MOTION.pitchA.rate) * dt * MOTION.pitchA.amp * k;
    }
    diveGlow += (1 - diveGlow) * 0.06;
  } else if (diveNode < 0) {
    // No automatic retreat: where you put the camera is yours to keep. Coming back
    // out is an explicit act (reset, escape, or tapping empty space).
    diveGlow += (0 - diveGlow) * 0.06;
  }

  // The log eases; the visible size is derived from it, so every step of travel is
  // the same size of step — that is what makes the zoom feel unbounded.
  // The depth breathes on its own when nobody is driving: ~80 s inward, ~80 s back,
  // around wherever the hand last left the camera. A manual zoom holds it off for a
  // while, then the voyage resumes from the new place instead of snapping back.
  if (!reduce && auto && !dragging && pointers.size === 0 && now > driftHoldUntil) {
    driftPhase += dt * 0.000052;
    const sailing = screensaver && now < voyageUntil;
    swingNow += ((sailing ? 1.75 : 0.85) - swingNow) * 0.02;
    const swing = swingNow;
    // While it is sailing, the whole breath slides inward: one sphere every couple of
    // minutes, so a long watch keeps arriving somewhere new rather than circling one.
    if (sailing) driftBase -= dt * 0.0000075;
    zoomLogTarget = driftBase + Math.sin(driftPhase) * swing;
  }
  // Arrival: on a door-opened page the camera begins inside the body and settles out,
  // so the first second is motion already in progress rather than a static cut.
  if (ARRIVING && arriveUntil === 0) {
    arriveUntil = now + 2600;
    zoomLog = 1.35;
    zoomLogTarget = 1.35;
  }
  if (arriveUntil !== 0 && now < arriveUntil && !dragging) {
    zoomLogTarget += (0 - zoomLogTarget) * 0.05;
  }
  zoomLog += (zoomLogTarget - zoomLog) * 0.055;
  zoom = Math.pow(OCTAVE, zoomLog - Math.floor(zoomLog));

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
      // Attention steers the gaze, it never freezes the body: a slow turn and roll
      // continue underneath whatever it is looking at.
      const targetYaw = -Math.atan2(focus.y, focus.x);
      yaw += (targetYaw - yaw) * 0.03;
      pitch += (-0.30 - pitch) * 0.03;
      roll += (0 - roll) * 0.03;
      if (!reduce && auto) {
        const k = MOTION.aiming.scale;
        yaw += dt * IDLE_SPEED * DRIFT * MOTION.yaw.rate * k;
        roll += dt * MOTION.roll.rate * MIND.roll * k;
        pitch += dt * MOTION.tumble.rate * MIND.tilt * tumbleDir * k;
        if (pitch > MOTION.tumble.limit) { pitch = MOTION.tumble.limit; tumbleDir = -1; }
        if (pitch < -MOTION.tumble.limit) { pitch = -MOTION.tumble.limit; tumbleDir = 1; }
        pitch += Math.sin(now * MOTION.pitchA.rate) * dt * MOTION.pitchA.amp * k;
      }
    } else if (!reduce && auto) {
      // A spiral, not a spin: one slow turn, one slow roll, and a tilt on a period
      // that shares no factor with either. The pose never repeats exactly.
      yaw += dt * IDLE_SPEED * DRIFT * MOTION.yaw.rate;
      yaw += Math.sin(now * MOTION.yawSecond.rate + 0.7) * dt * IDLE_SPEED * MOTION.yawSecond.amp;
      roll += dt * MOTION.roll.rate * MIND.roll;
      // the tumble: the pole keeps going until the limit, then turns back, so the body
      // is never level and never repeats the same attitude twice
      pitch += dt * MOTION.tumble.rate * MIND.tilt * tumbleDir;
      if (pitch > MOTION.tumble.limit) { pitch = MOTION.tumble.limit; tumbleDir = -1; }
      if (pitch < -MOTION.tumble.limit) { pitch = -MOTION.tumble.limit; tumbleDir = 1; }
      pitch += Math.sin(now * MOTION.pitchA.rate) * dt * MOTION.pitchA.amp;
      pitch += Math.sin(now * MOTION.pitchB.rate + 2.1) * dt * MOTION.pitchB.amp;
      pitch = Math.max(-0.6, Math.min(0.6, pitch));
    }
  }
  // The screensaver: forty-five seconds of stillness and the mind takes itself for
  // a walk. It picks stars, names them, dives and withdraws — the same voyage a
  // hand would make, on its own schedule.
  if (!reduce && !screensaver && now - lastInput > 14000) {
    screensaver = true;
    document.body.classList.add('screensaver');
    voyageUntil = now + VOYAGE_MS;
    exploreAt = voyageUntil;
  }
  if (screensaver) {
    // Only re-route when the breath is turning: switching stars mid-fall is what made
    // the first zoom feel interrupted. At the extremes the zoom is pausing anyway.
    const atTurn = Math.abs(Math.cos(driftPhase)) < 0.45;
    if (now > exploreAt && now > voyageUntil && atTurn) {
      exploreAt = now + 11000 + Math.random() * 7000;
      const label = document.getElementById('nodeName');
      // When the mind has real work to remember, it walks through that: a recent
      // moment is chosen, the camera goes to its star, and it says what it was.
      // With nothing to remember, it wanders and names its own thoughts instead.
      const live = trail.length > 0
        ? trail[Math.floor(Math.random() * Math.min(trail.length, 8))]
        : undefined;
      if (live !== undefined) {
        const seedIndex = (live.skill.length * 53 + Math.floor(Math.random() * 7)) % nodes.length;
        exploreNode = seedIndex;
        diveNode = seedIndex;
        if (label) label.textContent = typeof live.label === 'string' ? live.label : live.skill;
      } else {
        exploreNode = (exploreNode + 37 + Math.floor(Math.random() * 40)) % nodes.length;
        diveNode = exploreNode;
        if (label) label.textContent = (DOOR_SHOWN && exploreNode === PORTAL) ? 'the door' : roleOf(exploreNode);
      }
      // Aim, never jump: the tour eases into its distance over about a second.
      rippleFrom(exploreNode);
    }
  } else {
    diveNode = diveNode >= 0 && now > focusUntil && zoom > 4 ? -1 : diveNode;
  }

  stepBreath(now);
  document.body.classList.toggle('deep', zoom > 2.2);
  drawNebula(now);
  drawDust(now);
  drawHalo(now);
  drawTrail(now);

  // Five octaves at once. Each is the same body at scale zoom * OCTAVE^k; the
  // envelope fades one out as the next fades in, so structure continuously enters
  // from the periphery and resolves in the centre. This is the "never ending"
  // quality: at 1x and at 3.5x the frame looks equally full, and the wrap is invisible.
  const lifeBase = life;
  const reach = quality > 0.55 ? 3 : 2;
  for (let k = -reach; k <= reach; k += 1) {
    const rel = zoom * Math.pow(OCTAVE, k);
    // Floors, not windows: there is always a parent lattice above and a child below,
    // at every position in the octave. That is what keeps the frame reading as being
    // inside something instead of looking at a sphere.
    const near = Math.min(1, Math.max(0.16, (rel - 0.10) / 0.42));
    const far = Math.max(0.14, 1 - Math.min(1, (rel - 2.6) / 3.4));
    const envelope = near * far;
    if (envelope <= 0.02) continue;
    octaveScale = Math.pow(OCTAVE, k);
    life = lifeBase * envelope;
    drawGalaxy(now);
  }
  octaveScale = 1;
  life = lifeBase;
  // It says one thing, now and then, if it is allowed to. Silence is the default
  // texture of the mind, so this is sparse on purpose.
  if (MIND.speak && !speaking && now > nextSpeakAt) {
    say();
    nextSpeakAt = now + 38000 + Math.random() * 26000;
  }
  if (wantsSimulated() && now > sparkNext) {
    spawnSpark(now);
    const base = SPARK_RATE[Math.max(0, Math.min(3, sparkLevel))] || 6000;
    sparkNext = now + base * (0.6 + Math.random() * 0.9);
  }
  drawSparks(now);
  drawLit(now);
  drawPathways(now);
  drawAgents();
  drawRipples(now);
  drawVoice(now);
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
  // A simulated moment is a moment, not a lock: twelve seconds of attention and then
  // the body returns to turning on its own.
  focusUntil = performance.now() + 12000;
  ripples.push({ t0: performance.now(), strength: 1 });
  simulated = true;
  if (counter) {
    counter.textContent = 'Massai · ' + (nodes.length + EXTRA_NODES.length) + ' thoughts · '
      + (axes.length * FAMILIES) + ' circles · one door';
  }
}
// The simulator has no element: double tap steps it up, triple tap steps it down,
// and ?sim=<n> can start it for a photograph or a test.
const START_LEVEL = Number(params.get('sim') ?? '0');
if (Number.isFinite(START_LEVEL) && START_LEVEL > 0) applyLevel(Math.min(LEVELS.length - 1, Math.floor(START_LEVEL)));
if (counter) {
    counter.textContent = 'Massai · ' + (nodes.length + EXTRA_NODES.length) + ' thoughts · '
      + (axes.length * FAMILIES) + ' circles · one door';
  }

/**
 * Turn fresh real activity into lit stars, and remember the running total.
 * @param bySkill - counts per capability.
 * @param total - the running total of counted work.
 * @returns nothing.
 */
function noteActivity(bySkill, total) {
  if (!Number.isFinite(total)) return;
  if (litTotal < 0) { litTotal = total; return; }
  const delta = total - litTotal;
  litTotal = total;
  if (delta <= 0) return;
  // one star per unit of work, capped so a burst cannot flood the body
  const marks = Math.min(6, delta);
  const names = Object.keys(bySkill);
  for (let i = 0; i < marks; i += 1) {
    const skill = names.length > 0 ? names[(i + litSkill.length) % names.length] : 'general';
    litSkill = skill;
    const base = Math.abs(SKILL_ORDER.indexOf(skill));
    const index = (base * 37 + Math.floor(Math.random() * nodes.length)) % nodes.length;
    lit.set(index, { t0: performance.now(), skill: skill, kind: kindOfSkill(skill) });
    spawnSparkAt(index);
  }
  const now = performance.now();
  for (const [key, entry] of lit) {
    if (now - entry.t0 > LIT_MS) lit.delete(key);
  }
}

async function poll() {
  if (QUIET) return;
  try {
    // The visualiser asks the public feed, which carries counts and capability only.
    // The app's own page asks the richer endpoint, which it is entitled to.
    const url = VISUALIZER ? '/api/mind/feed' : '/api/one-turn/activity';
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    if (simLevel > 0) return;
    if (VISUALIZER) {
      // Turn the coarse feed into a trail of shapes: one recent moment per capability.
      const skills = (data.skills && data.skills.bySkill) || {};
      const now = Date.now();
      trail = Object.keys(skills).slice(0, 12).map(function (skill, index) {
        return { skill: skill, at: now - index * 4000 };
      });
      simulated = trail.length === 0;
      if (data.kinds !== null && typeof data.kinds === 'object') kindCounts = data.kinds;
      noteActivity(skills, data.skills && typeof data.skills.total === 'number' ? data.skills.total : -1);
      const badge = document.getElementById('simulated');
      if (badge) badge.style.opacity = simulated ? '0.7' : '0';
      const hot = data.focus;
      if (hot === null || hot === undefined) return;
      const index2 = SKILL_ORDER.indexOf(hot.skill);
      const point = index2 >= 0 ? skillPoints[index2 % skillPoints.length] : null;
      if (point !== null) {
        focus = { x: point[0], y: point[1], z: point[2], label: hot.skill };
        focusUntil = performance.now() + 25000;
        ripples.push({ t0: performance.now(), strength: 1 });
      }
      return;
    }
    trail = Array.isArray(data.trail) ? data.trail : [];
    agents = Array.isArray(data.agents) ? data.agents : [];
    trailTotal = data.counts && typeof data.counts.total === 'number' ? data.counts.total : trail.length;
    simulated = trail.length === 0;
    {
      // the owner's feed carries events, so count the kinds here
      const tally = { tool: 0, fail: 0, learn: 0, epiphany: 0, build: 0 };
      for (const event of (Array.isArray(data.events) ? data.events : [])) {
        if (event && typeof event.kind === 'string' && tally[event.kind] !== undefined) tally[event.kind] += 1;
      }
      for (const step of (Array.isArray(data.trail) ? data.trail : [])) {
        if (step && typeof step.kind === 'string' && tally[step.kind] !== undefined) tally[step.kind] += 1;
      }
      kindCounts = tally;
    }
    noteActivity(
      (data.counts && data.counts.bySkill) || {},
      data.counts && typeof data.counts.total === 'number' ? data.counts.total : -1,
    );
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
if (!QUIET) setInterval(poll, 2500);
if (params.get('panel') === '1') togglePanel();
if (MIND.keepAwake) void keepAwake(true);

async function pollVitals() {
  if (QUIET) return;
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
if (!QUIET) setInterval(pollVitals, 15000);

// --- interaction ----------------------------------------------------------
// The welcome page holds this frame like a coin and turns it by hand: it sends the
// drag here, so the small version spins on every axis without ever being a link.
/**
 * Build (once) and toggle the instrument panel.
 * @returns nothing.
 */
function togglePanel() {
  let panel = document.getElementById('mindPanel');
  if (panel !== null) {
    panel.remove();
    return;
  }
  panel = document.createElement('div');
  panel.id = 'mindPanel';
  panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:50;width:min(19rem,88vw);'
    + 'background:rgba(12,11,10,.94);border:1px solid rgba(247,205,140,.22);border-radius:12px;'
    + 'padding:12px 14px;font:12px system-ui,sans-serif;color:#E7DCC6;backdrop-filter:blur(8px)';

  let html = '<div style="letter-spacing:.22em;font-size:10px;color:#8a7c62;margin-bottom:8px">MIND</div>';
  /** One labelled slider row. */
  const slider = (key, label, min, max, step) => '<label style="display:flex;align-items:center;gap:8px;margin:3px 0">'
    + '<span style="width:6.4rem;color:#9a8f7c">' + label + '</span>'
    + '<input type="range" data-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step
    + '" value="' + MIND[key] + '" style="flex:1;accent-color:#C1440E">'
    + '<span data-out="' + key + '" style="width:2.4rem;text-align:right;color:#EFDCA4">'
    + Number(MIND[key]).toFixed(2) + '</span></label>';
  /** One labelled checkbox row. */
  const toggle = (key, label) => '<label style="display:flex;gap:6px;align-items:center;margin:4px 0">'
    + '<input type="checkbox" data-key="' + key + '"' + (MIND[key] ? ' checked' : '') + '> ' + label + '</label>';
  /** One section heading. */
  const head = label => '<p style="margin:9px 0 3px;font-size:9px;letter-spacing:.2em;color:#6f6553;text-transform:uppercase">' + label + '</p>';

  html += head('motion');
  html += slider('tilt', 'tumble', 0, 2.5, 0.05);
  html += slider('roll', 'roll', 0, 2.5, 0.05);
  html += head('travel');
  html += slider('swing', 'depth', 0, 2.2, 0.05);
  html += slider('speed', 'pace', 0.2, 2.5, 0.05);
  html += head('thought');
  html += slider('spark', 'arcs rate', 0, 3, 1);
  html += slider('arcJitter', 'arc wander', 0, 3, 0.05);
  html += slider('arcLife', 'arc life', 0.2, 2.5, 0.05);
  html += slider('aura', 'star aura', 0, 2, 0.05);
  html += slider('marks', 'mark life', 0, 3, 0.05);
  html += toggle('arcsOn', 'plasma arcs');
  html += toggle('marksOn', 'lit marks');
  html += head('structure');
  html += slider('linesFar', 'lattice far', 0, 2, 0.05);
  html += slider('linesNear', 'lattice near', 0, 2, 0.05);
  html += toggle('lines', 'lattice');
  html += toggle('paths', 'paths of use');
  html += head('atmosphere');
  html += slider('fog', 'fog', 0, 2, 0.05);
  html += slider('nebula', 'nebula', 0, 2, 0.05);
  html += slider('dust', 'star dust', 0, 2, 0.05);
  html += slider('breath', 'breath', 0, 2.5, 0.05);
  html += toggle('breathe', 'breathe');
  html += toggle('wash', 'hour wash');
  html += head('voice');
  html += toggle('speak', 'the mind speaks');
  html += toggle('voiceSound', 'a tone under it');
  html += '<button data-say="1" style="margin:4px 0;padding:4px 8px;border-radius:6px;border:1px solid #3a332a;'
    + 'background:#1a1714;color:#E7DCC6;cursor:pointer">say something</button>';
  html += head('the world');
  html += '<label style="display:flex;align-items:center;gap:8px;margin:4px 0">'
    + '<span style="width:6.4rem;color:#9a8f7c">activity</span>'
    + '<select data-key="feed" style="flex:1;background:#1a1714;color:#E7DCC6;border:1px solid #3a332a;border-radius:6px;padding:3px">'
    + ['auto', 'real', 'simulated'].map(option => '<option value="' + option + '"'
      + (MIND.feed === option ? ' selected' : '') + '>' + option + '</option>').join('')
    + '</select></label>';
  html += toggle('keepAwake', 'keep screen awake');
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  for (const name of Object.keys(PRESETS)) {
    html += '<button data-preset="' + name + '" style="padding:4px 8px;border-radius:6px;'
      + 'border:1px solid #3a332a;background:#1a1714;color:#E7DCC6;cursor:pointer">' + name + '</button>';
  }
  html += '<button data-preset="reset" style="padding:4px 8px;border-radius:6px;border:1px solid #3a332a;'
    + 'background:#1a1714;color:#8a7c62;cursor:pointer">reset</button></div>';
  html += '<p style="margin:8px 0 0;font-size:10px;color:#6f6553;line-height:1.5">'
    + 'Reset returns to the mind as built. Nothing here changes what the workshop actually does.</p>';
  panel.innerHTML = html;

  panel.addEventListener('input', function (event) {
    const el = event.target;
    const key = el.getAttribute('data-key');
    if (key === null) return;
    if (el.type === 'checkbox') MIND[key] = el.checked;
    else if (el.tagName === 'SELECT') MIND[key] = el.value;
    else MIND[key] = Number(el.value);
    const out = panel.querySelector('[data-out="' + key + '"]');
    if (out !== null) out.textContent = Number(MIND[key]).toFixed(2);
    applyMind(true);
    void keepAwake(MIND.keepAwake);
  });
  panel.addEventListener('click', function (event) {
    const button = event.target;
    if (button.getAttribute('data-say') === '1') { say(); return; }
    const name = button.getAttribute('data-preset');
    if (name === null) return;
    MIND = name === 'reset'
      ? Object.assign({}, MIND_DEFAULTS)
      : Object.assign({}, MIND_DEFAULTS, PRESETS[name]);
    applyMind(true);
    togglePanel();
    togglePanel();
  });
  document.body.appendChild(panel);
}

addEventListener('message', function (event) {
  const data = event.data;
  if (data === null || typeof data !== 'object' || data.type !== 'massai:spin') return;
  const dx = Number(data.dx) || 0;
  const dy = Number(data.dy) || 0;
  yaw += dx * 0.005;
  pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * 0.004));
  roll += dx * 0.0012;
  velYaw = dx * 0.0011;
  velPitch = dy * 0.0008;
  lastInput = performance.now();
});

canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
function nodeAt(clientX, clientY) {
  let best = -1;
  // A thumb is not a mouse: on glass the door needs a generous target, and the
  // nearest star to the finger wins so a near miss still finds it.
  let bestDistance = 34;
  for (let i = 0; i < nodes.length; i += 1) {
    const p = project(nodes[i].p[0], nodes[i].p[1], nodes[i].p[2]);
    if (p.z < -0.1) continue;
    const distance = Math.hypot(p.x - clientX, p.y - clientY);
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  return best;
}

function describe(index) {
  if (index < 0) return '';
  if (DOOR_SHOWN && index === PORTAL) return 'the door — touch it to enter';
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
  tapStart = { x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 3) { threeStart = pointerSpread(); threeFired = false; }
  if (pointers.size === 2) {
    // Two fingers own the camera: their spread sets the depth, their shared motion
    // slides the centre. One finger still turns the body, as before.
    const two = [...pointers.values()];
    pinchStart = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
    zoomAtPinch = zoom;
    zoomLogAtPinch = zoomLogTarget;
    pinchCentre = { x: (two[0].x + two[1].x) / 2, y: (two[0].y + two[1].y) / 2 };
    panOrigin = { x: panX, y: panY };
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
  if (pointers.size >= 3) {
    // three fingers, starting closed, ending open — the way in now that no door is drawn
    const spread = pointerSpread();
    if (!threeFired && threeStart > 6 && spread > threeStart * 1.5 && spread - threeStart > 30) {
      threeFired = true;
      openTheMind();
    }
    return;
  }
  if (pointers.size === 2 && pinchStart > 0) {
    const two = [...pointers.values()];
    const spread = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
    const centre = { x: (two[0].x + two[1].x) / 2, y: (two[0].y + two[1].y) / 2 };
    zoomLogTarget = zoomLogAtPinch + Math.log(spread / pinchStart) / LOG_OCTAVE;
    driftHoldUntil = performance.now() + 22000;
    driftBase = zoomLogTarget;
    driftPhase = 0;
    // Slide the centre by however far the pair of fingers travelled together.
    panX = panOrigin.x + (centre.x - pinchCentre.x);
    panY = panOrigin.y + (centre.y - pinchCentre.y);
    return;
  }
  if (!reduce) {
    lookX += ((event.clientX / VW - 0.5) * 0.16 - lookX) * 0.06;
    lookY += ((event.clientY / VH - 0.5) * 0.11 - lookY) * 0.06;
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
// The simulator has no slider any more: it lives on the glass. One tap explores,
// two taps step the simulated activity up (rolling over to none at the top), three
// taps step it down. A short buffer resolves the count, so a double tap is never
// mistaken for two separate taps.
let tapCount = 0;
let tapTimer = 0;
let tapStart = { x: 0, y: 0 };

function flashNote(text) {
  const label = document.getElementById('nodeName');
  if (label === null) return;
  label.textContent = text;
  clearTimeout(thoughtTimer);
  thoughtTimer = setTimeout(function () { label.textContent = ''; }, 1800);
}

/**
 * Resolve a run of taps into one action.
 * @returns nothing; the pending tap run is consumed.
 */
function resolveTaps() {
  const n = tapCount;
  tapCount = 0;
  if (n >= 5) {
    // Five taps: the settings panel, wherever you are in the mind — including out of
    // the screensaver, because that is exactly when you want to change something.
    if (screensaver) {
      screensaver = false;
      document.body.classList.remove('screensaver');
    }
    togglePanel();
    return;
  }
  if (n >= 3) {
    // Triple tap: the perfect fullscreen — no chrome, no bars, just the mind.
    document.body.classList.toggle('screensaver');
    if (document.fullscreenElement === null) {
      const target = document.documentElement;
      const request = target.requestFullscreen ?? undefined;
      if (typeof request === 'function') {
        void request.call(target, { navigationUI: 'hide' }).then(function () {
          flashNote('the whole screen');
        }).catch(function () {
          flashNote('fullscreen was refused');
        });
      } else {
        flashNote('this browser has no fullscreen');
      }
    } else {
      void document.exitFullscreen().catch(function () { /* already out */ });
      document.body.classList.remove('screensaver');
      flashNote('the frame, back');
    }
    return;
  }
  if (n === 2) {
    applyLevel(simLevel >= LEVELS.length - 1 ? 0 : simLevel + 1);
    flashNote(simLevel === 0 ? 'simulate · none' : 'simulate · ' + LEVELS[simLevel]);
    return;
  }
  // a single tap: the old behaviour, explore what is under it
  const picked = lastTapPick;
  if (DOOR_WORKS && picked === PORTAL) {
    const thought = describe(hoverNode >= 0 ? hoverNode : picked);
    flashNote('entering…');
    try {
      if (window.parent !== window) window.parent.postMessage({ type: 'massai:enter', thought: thought }, '*');
      else setTimeout(function () { location.href = '/access'; }, 420);
    } catch (error) { void error; }
    return;
  }
  if (picked >= 0) {
    diveNode = picked;
    flashNote(describe(picked));
    if (MIND.speak && !speaking) say();
    // Touching a star is the act that opens the workshop: inside the app it tells the
    // frame, so the composer appears where it already sits rather than from nothing.
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'massai:node', thought: describe(picked) }, '*');
      }
    } catch (error) { void error; }
    return;
  }
  if (diveNode >= 0) {
    diveNode = -1;
    flashNote('');
  }
}

let lastTapPick = -1;

/**
 * Record one tap and restart the buffer that resolves it.
 * @param x - pointer x in CSS pixels.
 * @param y - pointer y in CSS pixels.
 * @returns nothing.
 */
function noteTap(x, y) {
  tapCount += 1;
  if (tapCount === 1) lastTapPick = nodeAt(x, y);
  clearTimeout(tapTimer);
  tapTimer = setTimeout(resolveTaps, 300);
}

// Three fingers opening from closed: the way in now that no door is drawn.
let threeStart = 0;
let threeFired = false;
/**
 * The average distance from the centroid, for whatever pointers are down.
 * @returns the spread in CSS pixels.
 */
function pointerSpread() {
  const points = [...pointers.values()];
  if (points.length === 0) return 0;
  let cx = 0;
  let cy = 0;
  for (const point of points) { cx += point.x; cy += point.y; }
  cx /= points.length;
  cy /= points.length;
  let total = 0;
  for (const point of points) total += Math.hypot(point.x - cx, point.y - cy);
  return total / points.length;
}

/**
 * Open the mind: the workshop inside the app, the way in when it is standalone.
 * @returns nothing.
 */
function openTheMind() {
  flashNote('opening…');
  try {
    if (window.parent !== window) window.parent.postMessage({ type: 'massai:enter', thought: '' }, '*');
    else setTimeout(function () { location.href = '/access'; }, 320);
  } catch (error) { void error; }
}

canvas.addEventListener('pointerup', function (event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = 0;
  if (pointers.size < 3) { threeStart = 0; threeFired = false; }
  if (!dragging) return;
  dragging = false;
  canvas.style.cursor = 'grab';
  // A tap is only a tap: a drag is a drag. Everything below assumes the pointer
  // barely moved, so a flick never counts as a double tap.
  const moved = Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y);
  if (moved > 12) return;
  noteTap(event.clientX, event.clientY);
});
canvas.addEventListener('pointercancel', function (event) {
  pointers.delete(event.pointerId);
  dragging = false;
});
addEventListener('pointerleave', function () { lookX = 0; lookY = 0; });
canvas.addEventListener('wheel', function (event) {
  wake();
  event.preventDefault();
  zoomLogTarget += event.deltaY > 0 ? -0.11 : 0.11;
  driftHoldUntil = performance.now() + 22000;
  driftBase = zoomLogTarget;
  driftPhase = 0;
}, { passive: false });
addEventListener('keydown', function (event) {
  wake();
  if (event.key === 'ArrowLeft') yaw -= 0.1;
  if (event.key === 'ArrowRight') yaw += 0.1;
  if (event.key === 'ArrowUp') pitch = Math.max(-1.5, pitch - 0.07);
  if (event.key === 'ArrowDown') pitch = Math.min(1.5, pitch + 0.07);
  if (event.key === 'q' || event.key === 'Q') roll -= 0.1;
  if (event.key === 'e' || event.key === 'E') roll += 0.1;
  if (event.key === 'r' || event.key === 'R') { yaw = 0.4; pitch = -0.35; roll = 0; zoomLog = 0; zoomLogTarget = 0; panX = 0; panY = 0; }
  // Space stills the whole thing: sometimes you want to study the mind, not watch it.
  if (event.key === 'p' || event.key === 'P') { pathsOn = !pathsOn; }
  if (event.key === 'l' || event.key === 'L') { linesOn = !linesOn; }
  if (event.key === 's' || event.key === 'S') { togglePanel(); }
  if (event.key === 'k' || event.key === 'K') {
    sparkLevel = (sparkLevel + 1) % 4;
    try { window.localStorage.setItem('massai_sparks', String(sparkLevel)); } catch (error) { void error; }
    const names = ['off', 'rare', 'often', 'restless'];
    const label = document.getElementById('nodeName');
    if (label !== null) {
      label.textContent = 'sparks · ' + names[sparkLevel];
      clearTimeout(thoughtTimer);
      thoughtTimer = setTimeout(function () { label.textContent = ''; }, 1600);
    }
  }
  if (event.key === '[' || event.key === ']') {
    // tune the dial that is in play: the voyage web far out, the node web up close
    const key = diveNode >= 0 ? 'near' : 'far';
    const step = event.key === ']' ? 0.1 : -0.1;
    LINES[key] = Math.max(0, Math.min(2, Math.round((LINES[key] + step) * 100) / 100));
    writeDial('lines' + (key === 'near' ? 'Near' : 'Far'), LINES[key]);
    const label = document.getElementById('nodeName');
    if (label !== null) {
      label.textContent = 'lines · ' + key + ' ' + LINES[key].toFixed(2);
      clearTimeout(thoughtTimer);
      thoughtTimer = setTimeout(function () { label.textContent = ''; }, 1600);
    }
  }
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
export function flowerPageHtml(embed = false, visualizer = false): string {
  const classes = [embed ? 'embed' : '', visualizer ? 'viz' : ''].filter(Boolean).join(' ');
  return `<!doctype html>
<html lang="en"${classes === '' ? '' : ' class="' + classes + '"'}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${visualizer ? 'Massai Mind' : 'The flower — Massai'}</title>
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
  .hint{position:fixed;left:0;right:0;bottom:6.6rem;text-align:center;font-size:.74rem;color:#8a8a93;
    transition:opacity 1.2s ease}
  .hint b{color:#EFDCA4;font-weight:600}
  .caption{position:fixed;left:0;right:0;top:3.2rem;text-align:center;font-size:.82rem;
    color:#7ee2a8;opacity:0;transition:opacity .6s ease;letter-spacing:.02em}
  .counter{position:fixed;left:0;right:0;bottom:4.6rem;text-align:center;font-size:.7rem;
    color:#6f6f78;letter-spacing:.08em}
  .settled{position:fixed;left:0;right:0;bottom:3.6rem;text-align:center;font-size:.64rem;
    color:#4f4f58;letter-spacing:.12em;text-transform:uppercase}
  .sim{position:fixed;left:0;right:0;bottom:2.7rem;text-align:center;font-size:.6rem;
    color:#5a4a30;letter-spacing:.14em;text-transform:uppercase;transition:opacity .8s ease}
  .being{position:fixed;left:0;right:0;top:3.4rem;text-align:center;font-size:.64rem;
    color:#57575f;letter-spacing:.12em;transition:color .8s ease}
  .confession{position:fixed;left:0;right:0;top:4rem;text-align:center;font-size:.72rem;
    color:#8a6a3a;font-style:italic;opacity:0;transition:opacity 3s ease;padding:0 2rem}
.skip{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
  .skip:focus{left:1rem;top:1rem;width:auto;height:auto;padding:.5rem .8rem;z-index:99;
    background:#14100c;color:#EFDCA4;border:1px solid #7a3d12;border-radius:.4rem}
  .shapes{position:fixed;left:0;right:0;bottom:1.2rem;text-align:center;font-size:.7rem;
    color:#5f5f68;letter-spacing:.06em;pointer-events:none}
  .shapes a{pointer-events:auto}
  .shapes a{color:#6f6f78;text-decoration:none}
  @media (max-width: 640px){
    .shapes{display:none}
    .sim-ui{left:50%;transform:translateX(-50%);bottom:.7rem}
    .hint{display:none}
    .counter{bottom:4.2rem}
    .settled{bottom:3.2rem}
    .sim{bottom:2.4rem}
  }
  .shapes a:hover{color:#7ee2a8}
  @media (prefers-reduced-motion: reduce) { .hint{transition:none} }
  /* Embedded as a stage: the object is the whole frame. */
  /* Travelling in, the page's own voice fades: the deeper you are, the less the
     interface says. Lost is a feature here, not a failure. */
  .deep .overlay, .deep .hint, .deep .shapes, .deep .sim-ui, .deep .counter,
  .deep .settled, .deep .sim, .deep .voice { position: fixed; left: 50%; bottom: 12.5vh; transform: translateX(-50%);
  max-width: min(30rem, 84vw); margin: 0; text-align: center; pointer-events: none;
  font: italic 400 clamp(14px, 2.1vw, 19px)/1.5 Georgia, 'Times New Roman', serif;
  letter-spacing: .015em; color: rgba(247, 234, 210, 0); text-shadow: 0 0 22px rgba(255, 198, 120, .25);
  transition: color 1.4s ease, opacity 1.4s ease; opacity: 0; z-index: 3; }
.voice.speaking { color: rgba(247, 234, 210, .82); opacity: 1; transition: color .35s ease, opacity .35s ease; }
body.screensaver .voice { bottom: 8.5vh; }
body.screensaver .voice.speaking { opacity: .9; }

.node-name { opacity: .12; transition: opacity 1.2s ease }
  /* Screensaver: the mind is the whole screen and it narrates itself quietly. */
  body.screensaver .overlay, body.screensaver .hint, body.screensaver .shapes,
  body.screensaver .sim-ui, body.screensaver .counter, body.screensaver .settled,
  body.screensaver .sim, body.screensaver .toward, body.screensaver .back { opacity: 0; transition: opacity 2s ease }
  body.screensaver .node-name { opacity: .55; transition: opacity 2s ease }
  body.embed .overlay, body.embed .hint, body.embed .shapes, body.embed .sim-ui,
  body.embed .being, body.embed .confession, body.embed .counter, body.embed .settled,
  body.embed .sim { display: none !important }
  body.embed { background: #08080a }
  /* Visualizer: the mind is the whole object. No door, no counters, no confession,
     no hint — a screen you can leave on a wall. */
  html.viz .back, html.viz .counter, html.viz .being, html.viz .confession,
  html.viz .hint, html.viz .shapes, html.viz .settled, html.viz .sim,
  html.viz .node-name, html.viz .skip { display: none !important }
  html.viz body { background: #060504 }
  /* Nothing but the mind: the idle screensaver and triple-tap both land here. */
  body.screensaver .overlay, body.screensaver .caption, body.screensaver .hint,
  body.screensaver .counter, body.screensaver .being, body.screensaver .confession,
  body.screensaver .shapes, body.screensaver .settled, body.screensaver .sim,
  body.screensaver .node-name, body.screensaver .skip, body.screensaver .back {
    display: none !important }
  body.screensaver { background: #060504; cursor: none }
  /* Screensaver: nothing but the mind. Triple tap brings it, triple tap leaves it. */
  body.screensaver .overlay, body.screensaver .caption, body.screensaver .hint,
  body.screensaver .counter, body.screensaver .being, body.screensaver .confession,
  body.screensaver .shapes, body.screensaver .settled, body.screensaver .sim,
  body.screensaver .node-name, body.screensaver .skip, body.screensaver .back {
    display: none !important }
  body.screensaver { background: #060504; cursor: none }
</style></head><body${embed ? ' class="embed"' : ''}>
<canvas id="flower" aria-label="The Massai flower of life, rotatable" role="img"></canvas>
<div class="overlay">
  <div class="brand"><img src="/massai-crest.svg" alt="" width="22" height="22"><span>MASSAI</span></div>
  <a class="back" href="/access">← the door</a>
</div>
<p class="caption" id="caption"></p>
<p class="voice" id="mindVoice" aria-live="polite"></p>
<p class="node-name" id="nodeName"></p>
<p class="still" id="still"></p>
<p class="counter" id="counter"></p>
<p class="settled" id="settled"></p>
<p class="sim" id="simulated">simulated — no live activity yet</p>
<p class="being" id="being"></p>
<p class="confession" id="confession"></p>
<p class="hint" id="hint"><b>drag</b> to turn · <b>two fingers</b> move the centre and the depth · <b>two taps</b> stirs it · <b>three taps</b> is the whole screen · <b>five taps</b> opens the dials · <b>three fingers opening</b> lets you in</p>
<!-- the simulator lives on the glass now: double tap stirs it, triple tap calms it -->
  <span class="shapes"><a href="/flower">galaxy</a> &nbsp;|&nbsp; <a href="/map">where everything is →</a></span>
<script>${FLOWER_SCRIPT}</script>
<a class="skip" href="/access">skip to the workshop</a>
</body></html>`
}
