---
name: infinite-zoom-canvas
description: How to build a canvas scene whose zoom never ends in either direction — logarithmic octave renormalisation, multi-octave alpha envelopes, and the DPR transform that decides whether any of it is centred.
whenToUse: When building or debugging an "infinite zoom" canvas, a screensaver/mind visualiser, a fractal-like scene, or any canvas whose geometry looks off-centre / too small on a phone.
---

# Infinite zoom on a canvas

Distilled from a reference screensaver ("Gemini" screensaver, 2026-11) plus the bugs we hit porting it
into Massai's `/flower`. Two separate lessons live here: **the scale model** and **the projection**.

## 1. The scale model — why "zoomed out" and "zoomed in" can both show more

A fixed zoom range (e.g. `zoom = 0.16 … 20`) always has an edge: at the limit the frame goes empty or
degenerate. The trick is to never let the visible size leave **one octave**:

```js
const OCTAVE = 3.6;                       // one "generation" of scale
const LOG_OCTAVE = Math.log(OCTAVE);

let zoomLog = 0;                          // continuous magnification exponent
let zoomLogTarget = 0;

// per frame: ease in log space, then derive the visible size
zoomLog += (zoomLogTarget - zoomLog) * 0.11;
const zoom = Math.pow(OCTAVE, zoomLog - Math.floor(zoomLog));  // always in [1, OCTAVE)
```

- **Gestures move the log, not the size.** `zoomLogTarget += deltaY > 0 ? -0.11 : 0.11` for the wheel;
  `+= Math.log(spread / pinchStart) / LOG_OCTAVE` for a pinch. Equal steps then feel equal at every depth.
- Because `zoom` is always in `[1, OCTAVE)`, the renderer never sees a degenerate scale, and the travel is
  unbounded in both directions — no banding, no float blow-up.

## 2. Draw several octaves at once, and hand off with an envelope

The "never ending" *look* comes from seeing adjacent scales simultaneously:

```js
for (let k = -2; k <= 2; k += 1) {
  const rel = zoom * Math.pow(OCTAVE, k);         // 1/12.96 … 12.96
  const near = clamp((rel - 0.22) / 0.5, 0, 1);   // fade in as it grows
  const far  = 1 - clamp((rel - 2.0) / 2.4, 0, 1); // fade out as it outgrows the frame
  const envelope = near * far;                     // peaks at rel = 1
  if (envelope <= 0.03) continue;
  drawBodyAtScale(rel, envelope);
}
```

At `zoom = 1` the middle octave is full and its neighbours are dim; as `zoom → OCTAVE` the middle fades and
the inner one takes over. **The hand-off is the effect.** Without envelopes you get pops and a repeated ring.

Cheap way to carry the envelope into an existing renderer: keep a `life`/`alpha` multiplier that every
sprite and stroke already multiplies by, save the base before the loop and set `life = base * envelope`
per octave (`ctx.globalAlpha` is *not* enough — inner draw code assigns it per object).

## 3. True renormalisation (the reference implementation)

The reference also re-anchors the camera when crossing an octave boundary, so zooming in travels *into a
specific child* instead of nesting concentrically:

1. Keep `logZoom` fractional in `[0, 1)` plus an integer `octave`.
2. When `logZoom` crosses 1 (zooming in): pick the child node closest to the viewport centre, subtract its
   offset from `pan`, multiply `pan` by `1/OCTAVE`, and increment `octave`.
3. Crossing 0 does the inverse.
4. Because the figure is self-similar at every octave, the frame is continuous and the numbers never
   overflow.

Ours (Massai) implements steps 1–2 only — concentric octaves. Adding step 3 is the remaining difference and
makes the motion feel like falling rather than breathing.

## 4. The projection bug that makes all of it look wrong

**A canvas bitmap sized in device pixels with coordinates in CSS pixels renders at `1/DPR` scale, anchored
to the top-left.** Symptoms: the scene is "off centre, up and to the left", and everything is too small.
It looks like a centring bug; it is a transform bug.

```js
canvas.width  = Math.floor(VW * DPR);
canvas.height = Math.floor(VH * DPR);
canvas.style.width  = VW + 'px';
canvas.style.height = VH + 'px';
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // ← the line that decides whether it is centred
```

Then **remove** any `DPR *` multipliers in line widths / sprite radii — they were compensating for the
missing transform and will double-scale once it exists (we removed 24 of them).

## 5. Measure the visual viewport, not the layout viewport

On iOS the layout viewport is taller than the glass by the address bar, and wider under pinch-zoom, so
`innerWidth/2, innerHeight/2` is *not* the visual centre.

```js
let VW = innerWidth, VH = innerHeight;
function measureViewport() {
  const vv = window.visualViewport ?? null;
  VW = vv === null ? innerWidth : vv.width;
  VH = vv === null ? innerHeight : vv.height;
}
// call in resize(), and on visualViewport 'resize' and 'scroll'
```

## 6. Verification without eyes

Headless Chromium can photograph a canvas at a chosen state — no human required:

```bash
chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=430,932 --force-device-scale-factor=2 \
  --virtual-time-budget=8000 --screenshot=/tmp/shot.png \
  "https://example.com/scene?z=0.45"
```

Add a `?z=<log>` parameter to preset the camera depth so a specific octave can be captured deterministically.
Then measure the result: the body's pixel centre should be ~50% of the width and height, and its radius
should match `FIT * min(VW, VH)`.

## Tunable lattice (Massai's two line dials)

The circle lattice does two different jobs and is tuned separately:
- `LINES.far` — the voyage: the vast web seen while travelling (default 1.0)
- `LINES.near` — attention: the web around a star being held (default 0.55)

Both are multiplied into the stroke alpha of every lattice pass (`lineScale()`), persisted in
`localStorage` as `massai_lines_far` / `massai_lines_near`, adjustable live with `[` and `]`, and
overridable by URL (`?linesFar=0.8&linesNear=0.4`). `?lines=0` disables the lattice entirely, `L`
toggles it. When the owner reports a number, bake it into the defaults rather than re-guessing.

## Pitfalls
- `ctx.globalAlpha` inside draw code overrides an outer multiplier — use a shared `life`/`alpha` variable.
- Envelope thresholds tuned for one `OCTAVE` value do not transfer to another; keep `near/far` in terms of `rel`.
- Additive (`'lighter'`) drawing plus 5 octaves blooms fast: check `globalAlpha` per pass, and shed octaves
  under load (frame-time EMA) before shedding anything structural.
- Never nest backticks inside a template-literal shader/render script — it terminates the literal.

## Where this is applied
- `packages/experimental/hosted-signin/src/flower-page.ts` (Massai `/flower`) — octave model, five-octave
  pass, visual-viewport geometry, DPR transform.
- Reference implementation notes: `reference/gemini-screensaver.md` beside this file.
