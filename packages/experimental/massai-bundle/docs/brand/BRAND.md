# Massai brand sheet

**The Crest** — a warrior's shield charged with a pixel whale. The whale is
the engine; the shield is the craft. Spears crossed behind it carry the heraldry
of the name.

## Design review — the three crests (2026-11-20)

Rendered for real and tested at 16/24/32/48/64px (`compare.png`, `small-sizes.png`).

| Variant | Large | Small (≤32px) | Verdict |
|---|---|---|---|
| **Current** (`crest.svg`) | strong, bold | **reads** | keep as the **icon/favicon** |
| **Gemini** (`crest-gemini.svg`) | richest heraldry | mush — rectangle + blob | keep as **art direction**, not an icon |
| **Fusion v2** (`crest-v2.svg`) | distinctive whale-tail point + bead halo | reads from 24px | keep as the **large mark** |

**Decision:** two lockups, one identity.
- **Icon** (favicon, app icon, 16–64px): current crest — shield, spears, gold halo, pixel whale. No beads, no motto.
- **Large mark** (splash, stickers, og art): Fusion v2 — Gemini's whale-tail shield point and beaded Maasai halo, on our ochre/whale-blue palette.
- **Adopt from Gemini:** the motto **"Deep waters, higher order"** (*Aquae profundae, ordo altior*) and the bead-dot halo for large sizes only.
- **Decline from Gemini:** the lion crest, the supporters, and the navy field — three more elements would make the mark unreadable at icon size, and navy fights our near-black canvas.

## Files
- [`crest.svg`](./crest.svg) — the mark, vectors, transparent (dark-canvas tuned)
- [`crest-v2.svg`](./crest-v2.svg) — Fusion v2 (large mark, whale-tail point + beaded halo)
- [`crest-gemini.svg`](./crest-gemini.svg) — Gemini's original brief rendered as SVG
- [`compare.png`](./compare.png) · [`small-sizes.png`](./small-sizes.png) — the tests behind the decision
- [`lockup.svg`](./lockup.svg) — crest + `MASSAI` wordmark + `OPEN BY DEFAULT` + tagline

## Palette
| Role | Hex | Use |
|---|---|---|
| Canvas | `#151517` | Backgrounds, app chrome |
| Maasai ochre | `#C1440E` | Shield, spears, primary accent |
| Acacia gold | `#D9822B` | Sub-labels, highlights |
| Bone | `#F2F2F4` | Wordmark, primary text |
| Whale blue | `#4D6BFE` | **Only** the whale — a nod to DeepSeek, our engine and first among the commons |

## Icons (Android/Pixel rules that actually matter)

- **Maskable art is separate art.** Android masks the launcher icon to a circle/squircle. A padded
  "any" icon gets shrunk to a stamp; declare `"purpose": "maskable"` with full-bleed `#151517` and
  artwork inside the 80% safe circle so the mask crops background, never the shield.
- Ship **four** entries: `any` 192/512 + `maskable` 192/512. Keep `apple-touch-icon` at 180
  (iOS never masks) and let it fill ~86%.
- After any icon change, Android caches the shortcut: remove and re-add it to see the new mark.
- Renderer: `sharp` from `/opt/dsh/node_modules` (the workspace copy is a broken partial install);
  run generator scripts from `/opt/dsh` and write output into the repo.

## Rules
1. The whale is the only element allowed in whale blue. It never gets recoloured.
2. The shield keeps its stroke weight at every size; below 24px drop the spears.
3. On light surfaces, the shield fills bone and the strokes go canvas.
4. Never place the crest on a busy photo without the dark-canvas plate behind it.

## Openness (the flag we plant)
We do **not** brand ourselves as a DeepSeek product. We brand as **open by default**:
built with open-source software, shared the same way, made to be forked and branched.
DeepSeek's engine is credited with thanks — as the runner-up engine that makes this
cheap, not as the owner of the name.

Credit line used on the door:
> Massai stands on open-source shoulders — DeepSeek's engine first among them, with
> thanks. Fork it, branch it, build on it: that is the point.

## Voice
Warrior-calm. No hype. Short, concrete, generous — *"a few dollars goes a long way."*

Taglines: **Describe it. It gets built.** · *The unknown is possible.* ·
*Aim. Throw. Ship.* · *Your ideas, mass-produced.* · *The spear and the whale.*

**Headline:** the door rotates ten one-liners at random per visit — *Into the unknown.* ·
Point at it. It gets built. · Describe it. It exists. · Say it. Ship it. · From sentence to
software. · Ideas in. Software out. · Build the thing that doesn't exist. · Unknown in.
Running out. · You think it. It runs. · Bring a wish. Leave with it running.

Bench warmers (unused): *No plan required.* · *Start with nothing. End with something running.*

**Brand line:** limitless by default — no templates, no ceiling.

**Motto (large mark only):** *Deep waters, higher order* · *Aquae profundae, ordo altior*

**Proof line:** *Not a mockup. Not a draft. Running software.*

**Accessibility promise (top priority):** *You don't need to know a thing.*
A toddler could use it — prior knowledge is irrelevant. Every surface must survive
that test: no code, no setup, no vocabulary. If a step needs explaining, the step is wrong.

**Invitation (positioning):** *Bring the idea. We'll learn the rest together.*
— flips "you don't need to know anything" from a confession into a welcome.

## Persistence note

Visitor notes (`/feedback`) and conversation logs live in the container filesystem: they survive
redeploys **only** with a Render persistent disk (mount `/var/data`, set `DSH_HOME=/var/data/dsh`).
Disk creation via API returns **402 Payment information required** — it needs a card on the Render
account, so it is a one-click owner action in the dashboard.

## Live preview
`https://massai-dsh.onrender.com/logo-preview` (concept sheet, anonymous)
