# The Flower of Life logo

The owner's final direction: not a face, not a mask — the **Flower of Life**. Nineteen circles,
overlapping in the oldest pattern there is. It is exact, reproducible from a rule, public-domain as
an archetype, and it is literally what the owner believes the world looks like.

## The two forms

| File | What | Where |
|---|---|---|
| `logo-512.svg` → `logo-1024.png` | **double-rim disc** with the nineteen circles in gold hairlines | the app mark: tab, door, tile |
| `medallion-512.svg` → `medallion-1024.png` | gold **disc with the pattern cut out** | stamps, merch, single-colour print |

The rim is what makes it a logo rather than a wallpaper: it gives a silhouette at any size, so the
pattern inside only has to be *sensed*, not counted.

## Optical scaling — the part most logos get wrong

| Size | Artwork | Why |
|---|---|---|
| ≥192px | 19 circles, hairline (viewBox units 1.9) | the lattice can be counted |
| 48–64px | 7 circles (centre + 6), heavier stroke | counting stops, the rosette still reads |
| 32px | 7 circles, stroke 20 | same rosette, fattened |
| **16px** | **rim + solid centre dot** | below 24px the circles *cannot* survive; keeping them is a lie |

`icon-16.svg` is deliberately not the same drawing as `icon-64.svg`. That is the honest choice: a
ring with a lit centre reads at a glance, whereas nineteen thin circles read as grey mush.

## Rules

- Gold `#D9B463` with a light top-left to dark bottom-right ramp; canvas `#050506`.
- Ember `#FF8A00` appears **only** when a single element is being called out (the petal in the
  earlier `c2-petal` study) — never as decoration.
- The geometry must stay exact: 19 centres on a hexagonal lattice at radius r, r√3 and 2r.
  Never hand-place the circles.

## Revision 2 — the umph problem

The owner's note: the flat gold "lost all its umph". Correct diagnosis — a flat fill has no *light* in
it. Two treatments fix that without abandoning vector:

| File | Treatment | Use |
|---|---|---|
| `plasma2.svg` → `plasma-1024.png` | the pattern as **light**: hot core strokes, two bloom layers, bright ring, heavy vignette | app icon, tile, splash — punch at any size |
| `embossed2.svg` → `embossed-1024.png` | the pattern as **metal**: shadow + metal + highlight per circle, hammered band via `feTurbulence`, lit from upper-left | door, hero, print-quality renders |

Both keep the exact nineteen-circle geometry; only the lighting differs. The flat `logo-512.svg`
remains the file to use for one-colour print and for the ≤32px reductions, where light is pointless.

`ladder.png` shows the plasma treatment from 512px down to 16px, so nothing is flattered.
