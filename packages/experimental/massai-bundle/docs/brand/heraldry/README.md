# The heraldic crest — and the icon distilled from it

The reference art (`massai-heraldry.jpg`) is the **master**: knight's helm with a squared
**V** visor, gold halo, shield bearing a haloed whale, a lion and a Maasai warrior as
supporters, and the MASSAI name on a scroll. It carries the whole idea — the V for the
name, the halo for the messiah shadow, the whale for the engine, the warrior for the people.

It cannot be an app icon. At 16–48px a painting becomes mud. So the brand runs on **three
tiers**, each doing a different job:

| Tier | File | Use |
|---|---|---|
| **Artwork** | `massai-heraldry.jpg`, `og-image.jpg` | share cards, the door, splash, anything large |
| **Crest** | `h-a-crest.svg`, `crest-512.png` | app header, about page, engraved/large marks |
| **Icon** | `hv-icon.svg` (≥24px), `hv-icon-small.svg` (≤32px), `icon-*.png`, `icon-maskable-512.png` | favicon, home-screen icon, tab |

## The icon's elements, in priority order

1. **The V** — ochre, squared like the helm's visor. Survives any downscale.
2. **The halo** — a gold ring above the V. Dropped only below 16px.
3. **The whale tail** — two blue flukes below the V. Dropped below 24px, where it smears.

`hv-icon-small.svg` is the ≤32px artwork: V and halo only. `hv-icon-maskable.svg` scales the
mark into the 80% safe circle Android crops to.

## Colour rules (unchanged)

Canvas `#151517`, ochre `#C1440E`, halo gold `#C9A227`, bone `#F2F2F4`. DeepSeek blue
`#4D6BFE` appears **only** on the whale — never on type, borders or chrome.

## Why not the painting as the icon

- A JPEG cannot be scaled to 16px without turning into a smudge.
- It has no single silhouette, so a tab strip of six icons would not pick it out.
- The crest and the icon must be recognisably the same family — shield/V/halo/tail is that
  family, at every size.

## The monogram: the initials are in the crest

Look at the top of the artwork and the letters are already there:

- the **crown** — its points and valleys spell a **W**
- the **helm's visor** — squares off into a **V**
- the **halo** behind them — the ring that encloses both

So the icon is not an abstraction, it is a transcription: `vw-icon.svg` is the halo ring
(gold) around the W crown (bone) above the V visor (ochre). `proof-wv.png` crops the crest
so the correspondence is visible side by side; `mono-refined.png` and `vw-tiny2.png` are the
proofs at large and icon sizes.

Two artworks, same rule as the icon:

| Size | File | What is drawn |
|---|---|---|
| ≥24px | `vw-icon.svg` | halo ring + W + V |
| ≤20px | `vw-icon-small.svg` | no ring, thicker letters, filling the tile |

`vw-ligature.svg` is an alternative for large display: one continuous shape whose two valleys
are the W and whose point is the V. It is stronger as a mark, but at 16px the two letters stop
being separable, so it is not the app icon.
