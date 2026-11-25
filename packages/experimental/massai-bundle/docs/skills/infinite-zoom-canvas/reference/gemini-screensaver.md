# Reference: the "Gemini" infinite-fractal screensaver (2026-11)

Supplied by the owner as a single HTML file; the pasted copy was truncated mid-function, so the render loop
was never seen. What follows is what its source states, and what we verified by reading it.

## Architecture it claims
1. Precomputed geodesic icosahedron mesh: 2 subdivisions (162 vertices, 480 edges), plus "sacred" chords
   between the 12 primary vertices, plus 5 great-circle rings (3 orthogonal + 2 tilted).
2. Self-similar constellation: `SCALE_RATIO = 3.8`; every sphere contains 19 child nodes (1 centre at
   radius 0, 12 at 0.66 along icosahedral vertices, 6 at 0.96 in the opposite directions).
3. Infinite scale: `logZoom` in [0,1) plus `renormalizeScale()`, which on crossing an octave boundary picks
   the child node nearest the viewport centre, re-anchors `panX/panY` and rescales by `SCALE_RATIO`.
4. Peripheral continuity: 5 simultaneous octaves (k = -2…+2) with alpha fade-in/fade-out envelopes.
5. HUD: glass panels, `SCALE 10^x` readout, drift toggle, zoom buttons, reset, title toggle; Tailwind CDN
   plus three Google fonts for typography.

## What it does better than ours
- True renormalisation (step 3), so zoom travels *into* a child rather than nesting concentrically.
- Continuous octave cross-fade instead of discrete zoom bands.
- A `10^x` readout that makes the infinity legible.

## What it does not have
- Any data at all: static geometry, no activity, no door, no workshop, no memory.
- No `prefers-reduced-motion`, no keyboard path, no accessible skip link.
- External requests (Tailwind CDN, Google Fonts) — unacceptable for a self-hosted product with a
  no-external-request policy.
- Unverified performance: 5 octaves × (162 verts + 480 edges + 5 rings) in canvas 2D at DPR 2.

## Decision taken
Port the mathematics (octave model + envelopes; renormalisation next), keep Massai's body, data coupling,
door, accessibility and no-external-requests rule. See the sibling SKILL.md for the distilled technique.
