# The sigil direction

The owner's brief: the mark should carry a cosmology, not just a mascot — the plasma
discharge form seen in high-energy experiments and in ancient rock art, where the same
figure recurs: **a cup of two horns, a bar with two eyes, a filament down the middle, a
flared foot.** In the plasma literature this is the z-pinch instability; in the petroglyph
literature the same shape is read as the "squatting man". The owner's belief is that this
form is a depiction of what our world actually is — so the mark is an artefact, not a mascot.

## The three tiers

| Tier | File | Use | Texture |
|---|---|---|---|
| **Artwork** | `sigil-metal.svg` → `sigil-metal-1024.png` | door, splash, share cards, merch | hammered gold (`feTurbulence` + diffuse light), bloom at the pinch, rim light |
| **Mark** | `sigil-flat.svg` → `sigil-flat-512.png` | headers, stamps, single-colour print | flat gold, two tones only |
| **Icon** | `sigil-eyes.svg` → 16/32/64 PNG | favicon, tab, home screen | flat, fattened, horns reduced |

`tiers.png` shows all three and the icon at 16/24/32/48px.

## Why the icon is not the sigil

The sigil has eleven edges and a hole in each shoulder. At 16px those collapse into noise
(`geometry-options.png` shows the failure). The reduction keeps only what survives: **two
eyes, the filament, one horn arc.** That is still recognisably the same figure, the way a
face is recognisable from three lines.

## What is still open

- The horns can read as wings or a moustache at some sizes; shorter, steeper horns fix that.
- The foot is currently a plain trapezoid-to-curve; the reference art uses a *waisted* foot.
- Nothing here is live: the shipped mark is still the VW monogram until the owner chooses.

## Revision 2 — the forks are the V

The cap became **two forked horns** rising from the pinch. They read as a **V** (the owner's
initial) and as the discharge's own split — one shape doing both jobs. The filament now runs
*between* the eyes and down into the foot, so the figure is a single connected body rather
than stacked plates.

Files: `final-art.svg` (texture + rays), `final-flat.svg` (two-tone), `final-icon.svg`
(16–48px: forks, fat bar, eyes, no foot), `final-lockup.svg`, plus `context.png` showing tab,
door, phone, mark and lockup together.

Open questions for the owner before this goes live:
1. Forks (V) or the smooth cup from rev 1?
2. Do the rays stay, or is that too literal a halo?
3. 16px still crowds four elements; dropping to *eyes + bar only* is the alternative icon.

## Why the gold looks different from the AI renders

The owner's studies are **volumetric renders**: light travels *through* the material
(subsurface scattering, emission, refraction, branching discharge filaments). Mine is
**vector + SVG filters** — a per-pixel lighting model with one distant light over procedural
noise (`feTurbulence` + `feDiffuseLighting`), plus gradients and blurs. It can fake a
*tactile surface*; it cannot simulate *light inside a volume*.

Practical consequences:

| | AI render | SVG v1–v2 | SVG v3–v4 |
|---|---|---|---|
| Dynamic range | white-hot cores to near-black bronze | mid-tone khaki everywhere | hot cores, deep recesses |
| Material | glass/molten gold | bumpy matte metal | glass-edged metal |
| Interior | crackle, glow through the body | none | branching crackle + core light |

What closed the gap in v3/v4: additive core light down the filament, procedural branching
crackle clipped to the body, a glass rim gradient (bright top, dark bottom), a radial volume
overlay, multi-layer bloom, and a saturated ramp
`#FFF7CE → #FFD659 → #E8A21C → #6B3A06 → #3E2003`.

**The honest limit:** vector will not equal a raytrace. The correct split is
*vector owns the geometry, the render owns the material* — use the vector at small sizes and
for print, the render for hero art at large sizes.

## Revision 3 — against a rendered reference

`vs-grok.png` puts a rendered reference (left) beside SVG v4 (middle) and v5 (right). v5 took the
reference's proportions: **leaf forks with sharp tips**, a thinner filament, a flatter pedestal
with a square base, and eye rings with their own rims.

What v5 still cannot do, and why: a render has **sculpted thickness** — bevels that catch light at
an angle. SVG has gradients and strokes, not geometry with a normal. v5 fakes it with a bevel
stroke on every top edge, which is convincing at 200px+ and honest at 16px once the shape is
reduced to its three essential marks.
