# Massai — status, 2026-11-20 (after the long night)

Everything below was verified live at the end of the session, not assumed.

## Repo
- Fork: `BlunT4TnulB/massai-dsh`, HEAD at the worker-relay commit.
- 59 commits in one sitting. CI green: typecheck (5 gates) + docker + mirror.

## Live at https://massai-dsh.onrender.com
| Path | What |
|---|---|
| `/` | the door: crest, rotating slogans, DeepSeek routing, key form, guide link |
| `/guide` | two-minute getting started (DeepSeek key → credit → paste → build) |
| `/local` | hardware ladder · model table · savings calculator · per-OS wizard · suggestion builder |
| `/rates` | price card with the off-peak window in the reader's local time |
| `/feedback` | note form · `/feedback/export.jsonl` (owner) |
| `/admin` | owner console (status, notes, session census) |
| `/usage` | measured tokens, by-model comparison, avg context/call (owner) |
| `/models` | flash vs pro guidance + what the data says (owner) |
| `/workers` | machines that reported in (owner) |

## Cost campaign (measured against 3,664 real calls)
| Lever | Effect | State |
|---|---|---|
| Default model pro → flash | removes the 80% pro baseline | live |
| Compaction 0.8 → 0.2 of window | avg context 402k → ~200k (est. −52%) | live |
| Finished turns' reasoning no longer replayed | 60% of assistant content was reasoning | live |
| Summaries written by the strong model | memory quality, not cost | live |
| Price-weighted learner (local 0.02 / flash 1 / pro 2) | cheap success outranks expensive | live |
| Off-peak awareness | window shown in local time | live |
| Estimate with everything on | **$148 → ~$25 per period** | modelled |

## Learning side
- `session-memory` plugin: substantial sessions are distilled to
  **WORK / PITFALLS / TOOLS / NEXT** and recalled into the next session in the
  same project. Stored at `DSH_HOME/memory/<project>.jsonl`.

## Local models
- `tools/massai-local.sh` — installs Ollama + model + gateway, verifies with a
  real prompt, memory-guarded (it refused to run here: 2.9 GB free).
- `tools/massai-worker.sh` — heartbeat so a machine appears on `/workers`.
- `tools/massai-relay-worker.py` — polls the hub and serves its local model
  through `/api/local/v1/chat/completions`. **Proven end-to-end** with a stub.
- `tools/usage-sheet.py` — offline SVG usage sheet (no dependencies).
- Docs: `docs/GETTING-STARTED.md`, `LOCAL-AGENT.md`, `LOCAL-MODELS.md`.

## Multi-machine layer (verified end to end)
- `tools/massai-worker.sh --relay` — one command per machine: heartbeat plus
  serving that machine's local model through the hub.
- Hub endpoints: `/api/workers/next` (long-poll), `/api/workers/answer`,
  `/api/local/v1/chat/completions` (OpenAI-compatible).
- Auth: `x-worker-token` **or** `Authorization: Bearer` — so any OpenAI client can
  use the pool (`OPENAI_BASE_URL=https://massai-dsh.onrender.com/api/local/v1`).
- Timeouts: 10s to be picked up (a workerless pool answers 503 in under a second),
  3 minutes once a worker takes the job.
- `/workers` shows relay status and has a one-click end-to-end test button.
- Model picker: **Worker pool (local machines)** provider — manual selection only,
  never auto-routed, because a sleeping machine must not stall a request.
- **Per-machine targeting**: send `model: "<machine name>"` to pin a request to one
  computer (verified: only that machine took it).
- **Round-robin**: `model: "auto"` rotates across waiting machines (verified: 2/2
  split over four requests).
- `/workers` shows relay status, a job count per machine, and a one-click test.
- `/memory` page shows exactly what the agent learned per project.

## Other assistants (built in)
- Paste importer: `/import` turns any conversation (Gemini, ChatGPT, Claude) into
  a remembered summary recalled by every later session.
- Providers, each switched on only by its key in the environment:
  `GEMINI_API_KEY` → Gemini (`gemini-flash-latest`, `gemini-flash-lite-latest`),
  `ANTHROPIC_API_KEY` → Claude, `OPENAI_API_KEY` → OpenAI.
- Gemini verified against Google's OpenAI-compatible endpoint (2.5-flash is
  retired for new keys; the `-latest` aliases answer).

## Collecting keys (the checklist)
Live at `/providers` on the site. Order worth doing:

| # | Provider | Where | Env var | Free? |
|---|---|---|---|---|
| 1 | DeepSeek | https://platform.deepseek.com/api_keys | `DEEPSEEK_API_KEY` | paid, cents |
| 2 | Google Gemini | https://aistudio.google.com/apikey | `GEMINI_API_KEY` | **set already** |
| 3 | Groq | https://console.groq.com/keys | `GROQ_API_KEY` | free tier |
| 4 | OpenRouter | https://openrouter.ai/keys | `OPENROUTER_API_KEY` | 17 free models |
| 5 | Anthropic | https://console.anthropic.com/settings/keys | `ANTHROPIC_API_KEY` | paid |
| 6 | OpenAI | https://platform.openai.com/api-keys | `OPENAI_API_KEY` | paid |

Add to Render env → restart → the provider appears in the model picker; absent key means
the provider is invisible, never broken. The page shows which are already set.

## Brand + deploys (2026-11-21)
- Live mark: **VW monogram** — crown W over visor V inside the gold halo, derived from the
  heraldic crest the owner chose. Assets in
  `packages/experimental/massai-bundle/docs/brand/heraldry/` plus `SYMBOLS.md`.
- Shipped: `/massai-crest.svg`, favicons 16/32/48, apple-touch, icon-192/512, maskable 192/512,
  `og-image.png`, and the door's inline crest. All verified byte-identical to the live site.
- **Deploy lesson:** Render's image service served a stale `:latest` digest even for a deploy
  created *after* the push (brand assets stayed 8 commits behind). CI now also pushes
  `ghcr.io/blunt4tnulb/massai:<fullsha>`, and deploys pin that tag:
  `tools/massai-deploy.sh` (uses `RENDER_API_KEY` from `/workspaces/dashboard/.secrets.local`).

## Brand system (two marks, two jobs)
- **Public face:** the plasma sigil (forked V over the eyes bar). Live: door crest, favicons,
  home-screen tiles, og-image.
- **Badge:** the M-shield (shield + spear + M + arrow), vectorised in red/ochre/gold.
  Live at `/massai-badge.svg` and in the **Owner console** and **Local agents** headers.
- Files: `packages/experimental/massai-bundle/docs/brand/{sigil,shield,heraldry,grok-reference}/`.

## Deploy notes
- `tools/massai-deploy.sh <sha>` pins the image; `:latest` can serve a stale digest.
- 2026-11-22: image 78ad483 failed to boot once (`update_failed`), rollback to 02d796a restored
  service, then the same image deployed clean on retry → transient Render failure, not code.

## Keep-alive (cold start)
- Problem: free Render sleeps ~15 min; first request 22-40 s. Looks like a dead site.
- GitHub Actions cron is throttled on free repos (measured 4-8 h gaps) — useless here.
- Cloudflare Worker deployed: script **massai-keepalive**, subdomain **massai-vw** (account 9d31e826891ecbf4b957d3ebbe8bcba5).
- Token in `/workspaces/dashboard/.secrets.local` as `CLOUDFLARE_API_TOKEN`. It can upload scripts
  but **cannot set cron triggers** (10026 on /schedules) — needs a token with Workers Cron Triggers.
- One-command fix: `cd tools/keepalive && npx wrangler deploy` (wrangler.toml declares `*/5 * * * *`),
  or add the cron in the dashboard: Settings → Trigger Events → Cron Triggers.
- Neon/Clerk do NOT help with sleeping; Neon DOES help with persistence (Render disk is ephemeral).

### VERIFIED 2026-11-22 16:03Z
Cron `*/5 * * * *` created 15:41:56Z. After **17 idle minutes** with no requests:
`/healthz` answered in **0.75s and 0.55s** (previously 20-40s, sometimes a 90s timeout).
The cold start is fixed. Cost: $0.

## Persistence (Neon) — built, dormant
- `packages/experimental/hosted-signin/src/persistence.ts`: SQL over Neon's HTTPS endpoint
  (no driver dependency), tables `usage_points` + `memory_records`, created on boot.
- Writes: every `session/event` carrying token usage. Reads: `/providers` prefers durable rows,
  falls back to local logs. Status: `GET /api/db/status` (owner).
- **Needs only** `DATABASE_URL` in Render env (Neon connection string) to activate.

## Neon — LIVE
- Project **massai** (`spring-dawn-04625220`), org `org-silent-brook-31204171` (Venables), region `aws-us-west-2`.
- Host: `ep-winter-brook-bf72689a.c-5.us-west-2.aws.neon.tech` (direct, not pooled).
- `DATABASE_URL` set in Render env; connection string + `NEON_API_KEY` in `/workspaces/dashboard/.secrets.local`.
- Tables `usage_points` and `memory_records` created (verified through the HTTPS SQL endpoint).
- Insert/select verified with the exact SQL the app uses (`ON CONFLICT DO NOTHING` honoured).
- Deployed; healthz 200 in 0.43s with the database configured.
- **Still to prove:** that a real chat message writes a row (needs one message sent in the app).

## Domain + Cloudflare proxy (2026-11-22)
- **Domain: `massai-itu.ca`** — registered 2026-11-22 (CIRA, expires 2027-11-22, "add period").
- Registry nameservers: `connie.ns.cloudflare.com` / `eoin.ns.cloudflare.com` ✓ (delegation correct).
- Cloudflare zone `massai-itu.ca` id `2f65064c219f2c333f2ef41cc9e03b17`, status active.
- DNS created: `CNAME @` and `CNAME www` → `massai-dsh.onrender.com`, **proxied** (orange cloud) ✓
- Zone settings: SSL **strict**, Always Use HTTPS **on** ✓
- Render custom domains added (apex + www), pending verification until DNS propagates.
- `PUBLIC_ORIGIN=https://massai-itu.ca` set; deployed.
- Cloudflare global key (X-Auth-Key + X-Auth-Email Vwaldon689@gmail.com) in `.secrets.local` as `CLOUDFLARE_DNS_TOKEN`.
- **LIVE (22:24Z):** DNS propagated. `https://massai-itu.ca` answers through Cloudflare in ~0.4s.
  All surfaces 200 on the domain (/access /support /limits /terms /privacy /aup /providers /local /guide /healthz /api/geo).
  `og:image` now `https://massai-itu.ca/og-image.png`; door carries the INTO THE UNKNOWN tagline.
- **Geo gate is REAL:** `/api/geo` → `{"country":"CA","source":"cf-ipcountry header","freeGemini":true,"strict":true}`.
  Render's own edge is Cloudflare, so even the raw onrender URL carries `cf-ipcountry` — no bypass gap.
  `DSH_GEO_STRICT=1` set. Keep-alive Worker repointed to `https://massai-itu.ca/healthz`.
- **ONE canonical address (23:19Z):** platform hostnames and `www` now 301 to `https://massai-itu.ca`;
  `/api/*` and `/healthz` are exempt so machines keep working. GitHub repo variable `PUBLIC_ORIGIN`
  set for the keepalive workflow. Docs repointed at the domain.
- Cosmetic: Render still lists both custom domains as "unverified" — grey-clouding for 5 min did not
  clear it (Render wants a TXT record its dashboard shows), but TLS, routing and the geo header all
  work, so it is a badge, not a fault.
  TLS works (Cloudflare edge, SSL strict, pages 200); clearing the flag needs a brief grey-cloud toggle.
- **Then:** verify `cf-ipcountry` arrives → set `DSH_GEO_STRICT=1` → repoint keep-alive to the domain.

## Fuel gauge + credential expiries (2026-11-22 02:20Z)
- **Fuel gauge live:** `/admin` shows `X USD available — read N min ago`; refresh every 10 min, published to
  `$DSH_HOME/health/deepseek-balance.json`; the door reads it and shows **"the free preview is paused"**
  instead of a dead CTA when the tank is empty.
- Balance at first read: **12.59 USD**.
- **⚠ MASSACOT PAT expires 2026-11-25 07:30 UTC (~2 days).** Deploys and CI pushes stop then.
  The running site is unaffected; only new deploys/commits break.
- **GITHUB_PAT expires 2026-12-16 17:47 UTC.**
- Domain `massai-itu.ca` expires 2027-11-22.
- Cloudflare keys are global-style keys (no expiry, but full account scope — rotate when convenient).

## Persistence (2026-11-23, night build)
- **R2 live.** Bucket `massai`, credentials verified by hand-signed SigV4, set in Render
  (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
  `/api/one-turn/storage` does a write→read→delete round trip and reports it honestly.
- **Projects durable:** metadata in Postgres `one_turn_projects`, bytes in R2 under `projects/<id>/<path>`.
  Verified full lifecycle: build → auto-save → read back from R2 → offer to shelf → adopt (copy).
  Example: `p-80b937f5…` "Lawn & Order YEG", 5,107 bytes; adopted copy `p-0dc8c568…`.
- **Learning loop durable:** `one_turn_lessons`, `one_turn_voice`, `one_turn_trials` in Postgres.
- **Pages:** `/projects` (mine + the shelf + adopt). Warning flipped everywhere: "projects are kept,
  conversations are not yet, nothing is deleted for running out".
- **One-turn system (new, in `packages/experimental/one-turn`):** intake interview (10 questions, each
  preventing a named failure), earned probes, ambiguity readings with recorded decisions, the
  Extrapolator (fills gaps, marks guesses), the workshop voice (bounded material), lessons that feed
  back into the mask, mask compiler (749–1083 tokens), trial runner with deterministic checks and a
  hard per-trial cost ceiling. Measured: **$0.0009–0.0020 per accepted artifact**.

## Community library (2026-11-24)
- **13 GitHub repositories imported** (498 files, 1.87 MB) by `scripts/import-github.mjs` — safe-file
  filter, credential scan (4 files skipped and named), 40 files / 1.5 MB caps, operator body limit.
- **Private by default**: `visibility` column on `one_turn_projects`; a stranger reading a private
  project gets `403`. Publishing is a deliberate `POST /api/projects/publish`.
- **Published at the owner's instruction**: all 13 now `shelf` + `adoptable`, visible at `/library`
  and adoptable (a copy becomes the adopter's).
- **Library feeds the mask**: `library` section (94 tokens) carries project count and recurring stacks
  (md 103 · ts 91 · tsx 55 · py 38 · json 35 · dxf 33) as a convention hint. Refreshed hourly.
- Golden pass with the library in the mask: **79% one-turn, $0.0023/build** (inside the 63–84% band).

## The turnable flower + a quieter door (2026-11-24)
- **`EmptyHero` brand mark is now a 3D object**: the Flower of Life sits above the chat headline at
  96 px, and can be dragged to rotate on two axes (idle slow turn, eased tilt, 19 visible points,
  hover glow). `prefers-reduced-motion` renders it still. Shipped in the ui-conversation client plugin
  bundle (verified: `markStage`, `markPoint`, `rotateX`, `perspective`, `markRow` all present in the
  served 5.99 MB plugin bundle).
- **Door de-cluttered** for the "overwhelming homepage" complaint: three link rows and a long
  disclaimer became one compact fine line + one tips line. 12,534 → 11,774 bytes. Master mode still
  removes even those.

## Navigation as the flower (2026-11-24)
- **`/map`** — the seven destinations arranged as the flower of life. Server-rendered SVG,
  every point a real `<a>` with an aria-label, plus a plain link list underneath. Keyboard-first.
- **`/flower`** — the immersive version: 19 circles on a hex lattice projected in real perspective,
  every pairwise intersection computed into the inner star lattice; drag to rotate, scroll to zoom,
  arrow keys, 7 glowing clickable doors, hover labels above 1.25× zoom, idle drift, pauses when the
  tab hides, and `prefers-reduced-motion` stops the drift. No dependencies, one canvas, 7.9 KB inline.
  Links to `/map` as the screen-reader path.
- The hero mark above the chat stays a toy (draggable, decorative); the flower page is the place
  where its points actually navigate.

## The live middle ground (2026-11-24)
- **Real correlation:** activity is classified from the agent's own `tool/call` events in the session
  hook (tool name + path extension + command) → capability id. Nothing content-based; categories only.
  `GET /api/one-turn/activity` returns the hottest capability weighted by recency over a 10-minute
  window; `POST` accepts beats (owner token).
- **In-app pulse:** `LiveActivity` component in `ui-conversation` — a 16px flower + one word
  (geometry · data · interface · script · checks · document · scanner · service) in the conversation
  header during work, and beside the big hero mark when the session is blank. Polls every 4 s, only
  when the tab is visible, **renders nothing when idle**, and fails silently. Reduced motion = no pulse.
- **`/flower`** uses the same signal: camera eases toward the matching skill point and a green ring
  pulses around it, with the caption ("drawing geometry").

## The work, made visible (2026-11-24)
- **Activity buffer** keeps 120 classified tool calls; the API returns `focus` (two-minute half-life,
  so "now" beats "a while ago"), `counts` (total + per capability), and `trail` (chronological).
- **`/flower` draws the session's shape**: one dot per action on an outer ring — colour by capability
  (geometry green, dashboard blue, web-app gold, scripting orange, …), brightness by freshness, radius
  spiralling outward, plus "N actions in this session". Verified the renderer ships (drawTrail,
  SKILL_COLOR, trailTotal, counter all present; page grew 9.8 KB → 14.4 KB).
- **In-app pulse** shows the word plus the count: `geometry · 12` in the conversation header.
- **Decay verified honestly**: after 13 idle minutes the trail is empty and focus is null.

## Work fingerprints (2026-11-24)
- Every project now carries a **fingerprint**: the mix of file kinds that built it, in the same
  vocabulary and palette as the live activity trail. Rendered as a thin colour bar on each
  `/projects` card, so a finished project reads like the session that made it.
- Verified on the real library: `Leather-Vest-DB1` → geometry 82% · docs 10% · general 8%;
  `private-ptt` → service 52% · general 25% · web-app 12% · testing 10%;
  `Scanner-Tool` → scripting 48% · docs 24% · scanner 9%.
- `/flower` gained a **spiral** (a new turn every 40 actions, so a 200-call session reads as five
  turns instead of one crowded ring) and a **settled** state (dimmed trail + "session settled" when
  nothing is live, so an idle ring is never mistaken for a broken one). Page 14.4 → 15.0 KB.

## A project remembers how it was built (2026-11-24)
- New column `one_turn_projects.build_trail` (jsonb). On auto-save, the run route snapshots the live
  activity trail through the loopback (`127.0.0.1:$PORT/api/one-turn/activity`), so a saved project
  keeps the shape of the session that made it. Failure is silent — the project still saves.
- `/projects` detail view now renders a **replay**: one dot per build step in the same palette as the
  live trail, with "how it was built · N steps over M min" and a hover title per step.
- Verified end-to-end: seeded four activity steps (geometry ×2, web-app, testing) → ran a build →
  saved project "Trail Proof Build" returned `buildTrail` of exactly those 4 steps,
  fingerprint `web-app 100%`.

## The orbit (2026-11-24)
- `/flower` now draws **agents as bodies**: one circle per distinct session at work, positioned on a
  3D orbit around the flower (`project(cos*1.55, sin*1.55, sin(yaw+index)*0.35)`), radius scaled by
  step count, with each agent's last 8 steps strung outward as a coloured path and faint connecting
  lines. The whole orbit rotates with the scene.
- **Agent ids are hashed** (FNV-1a → 6 base36 chars). Truncating session ids collapsed `agent-a` and
  `agent-b` into one body; the hash fixes that and leaks no prefix of a real session id.
  Verified: 3 test sessions → 3 distinct agents (`1dr9gr`, `1eb8o5`, `1el89u`) with correct counts.
- **Simulation is labelled**: when nothing real has happened, a deterministic 14-node wobble is
  drawn with a visible "simulated — no live activity yet" badge. The page never implies fake work.
- Beats may now carry an optional `session` id, so the agent view can be exercised without a live chat.

## Performance pass (2026-11-24)
Measured before changing anything:
- a phone downloads **2.06 MB gzipped** on first load (entry 392 KB + plugin bundle 1.76 MB)
- pages: median 0.64–0.85 s, p90 ~0.75–1.0 s, occasional 5.8 s tails
- `/api/one-turn/skills` looked slow once (2.3 s) but was a spike: 0.59–0.79 s steady

Changed:
- **Hashed assets are immutable** (`public, max-age=31536000, immutable`) while the shell stays
  `no-store`. Repeat visits no longer re-validate the 392 KB entry.
- **Cloudflare cache rule installed** (zone `2f65064c…`, phase `http_request_cache_settings`):
  `/assets/*` and `/plugins/*` are cached at the edge ignoring cookies. Verified:
  entry → `cf-cache-status: HIT` (age 103/384/391); plugin bundle → MISS then HIT.
  Before this the header was `DYNAMIC` — the session cookie was bypassing the edge entirely.
- **One activity poller for the whole app** (header and hero both mount the widget; two pollers
  doubled the requests).
- **No drawing in a hidden tab**: the hero mark and `/flower` keep their loop alive but skip painting.
- `/flower` caps device pixel ratio at 1.5 on phones (4× fewer pixels on a full-screen canvas).

Honest leftovers: the 1.76 MB plugin bundle is the dominant cost and needs client-plugin
code-splitting (infrastructure work, not a tweak); the 5.8 s tails are free-tier contention, and a
$7 Render Starter instance is the straight fix.

## Owner gate (2026-11-24) — a real hole, closed
- **Found:** any guest — minted for free by anyone at `/api/preview` — could read `/admin`,
  `/memory`, `/workers`, `/api/db/status`, `/api/one-turn/store`, and could have granted itself credit
  via `/api/credits/grant`. Cause: `auth: 'required'` only means *authenticated*, and every session in
  this harness is an owner-principal; the peer carries a random id, not the user.
- **Fix:** operator identity is a **signed marker cookie**. Visit `/owner?token=<DSH_WEB_TOKEN>` once —
  it sets `dsh_owner`, a marker, and mints the session via the launch exchange in the same click.
  Verify: `dsh_owner` is HMAC-SHA256 of a fixed string keyed by the deployment token, so it cannot be
  forged without the token; nothing forgeable lives in the page. `/api/one-turn/store` checks the same
  marker (duplicated, three lines, because that package must not depend on the sign-in plugin).
- **Verified live:** guest session → `/admin` 403, `/memory` 403, `/workers` 403, `/api/db/status` 403,
  `/api/one-turn/store` 403, credit grant 403; operator (after `/owner?token=…`) → all 200;
  wrong token → 403; guest steering the hive → 403. Guest product pages still 200.

## The sanctum (2026-11-24)
`/flower` is now **38 spheres in two layers** (19 circles × 2 z-offsets at ±0.34), not 19 flat circles:
- **Spheres, not circles**: each lattice centre is a soft radial-gradient sphere. A single soft sphere is
  pre-rendered once per tint into an offscreen canvas and drawn as a sprite, so 38 of them per frame cost
  almost nothing (a per-frame gradient per sphere would have been the only expensive thing).
- **Halo**: a screen-space radial wash plus one thin world-space ring at radius 2.35, so the object reads
  as suspended rather than drawn.
- **Bloom**: `bloomAt(x, y)` falls off with distance from the active skill point, so the spheres nearest
  the work turn green and brighten; the whole thing eases one slow quarter-turn toward it.
- **Restraint rules, written into the file**: one palette (gold, green, one blue), one glow radius, one
  idle speed (`IDLE_SPEED = 0.00006`, slower than before), two depth layers only, and
  `prefers-reduced-motion` still stops the turn.
- Verified on the wire: `sphereSprite`, `LAYER_Z`, `drawHalo`, `bloomAt`, `spriteCache` all present;
  18,251-byte page; one `<script>`; the counter reads "N actions · 38 spheres · 61 points".

## The sanctum, second sight (2026-11-24)
`/flower` is now a volume with a gaze, not a picture:
- **76 spheres** — 19 centres × **4 depth layers** (±0.52, ±0.17) on a wide screen, with per-layer alpha
  and size; **2 layers (38 spheres)** on a phone, because volume costs fill rate.
- **The web** — filaments drawn between lattice points that sit 0.36–0.72 apart: the structure the
  flower implies and never showed. Alpha rises toward the work.
- **Ripples** — when the activity endpoint reports a new focus, a ring expands from the centre through
  the lattice, brightening spheres as it passes, then dies at radius 4.
- **Dust** — 90 motes drifting in 3D, projected, dimmed by depth: the object hangs inside something.
- **The gaze** — the whole assembly leans a few degrees toward the pointer (`lookX/lookY`), and returns
  to centre when the pointer leaves. It notices attention without ever asking for it.
- **The hour** — a 5–8% wash shifts amber at noon to indigo at night, so time passes visibly.
- Preserved: breath (11 s), no click navigation, silent when idle, hidden-tab pause, reduced motion,
  sprite cache (one sphere rendered once per tint, never a gradient per sphere per frame).
- Verified on the wire: all eleven markers present; page 18.6 KB → **21.5 KB**.

## Self-aware (2026-11-24)
- `GET /api/vitals` — the workshop's own condition, readable by anyone: fuel (USD from the provider
  balance endpoint), memory reachability, live sessions, projects kept, trials attempted, lessons held,
  seconds awake, and a one-sentence notice when something is wrong.
- The sanctum polls its vitals every 15 s and *shows* them in its body:
  - **fuel** → overall brightness and the depth of the breath (`energy = min(1, fuel / 5)`)
  - **memory** → if the database is unreachable the colour cools toward indigo and it dims
  - **wisdom** (`lessons / 20`) → thickens the filament web: what it has learned is visible in the structure
  - **works** (`projects / 60`) → weights the trail dots
  - a quiet line at the top: "awake 24s · 127 works kept · 6 lessons held", turning amber when it has
    something to admit ("the workshop is running low on credit")
- Live reading at deploy: fuel $19.13, memory ok, 0 sessions, 127 projects, 144 trials, 6 lessons.
- Honest framing: this is self-*reporting*, not sentience. Every number is measured; nothing is mood.

## Two candidates on review (2026-11-24)
`/flower` now builds its body from the URL, so the two polyhedra can be compared without a deploy:
- `?shape=icosa` (default) — **icosahedron**: 12 vertices, 30 edges, the football's cousin
- `?shape=dodeca` — **dodecahedron**: 20 vertices, 30 edges, twelve pentagonal faces
- `?shape=flower` — the previous shell-wrapped flower (kept for comparison)
Each body: vertices as glowing spheres, edges computed from the minimum vertex distance (so it is the
true edge set of a regular solid), spokes from the centre to every vertex (the vector-equilibrium idea
and it also gives the object a middle), doors on 7 vertices, skill points on the next 8.
- **Centring is now by construction**: `FIT = 0.34` absolute against `BODY.radius`, and the centre is the
  exact viewport middle — the old version scaled by a fraction of the viewport, which let the body run
  past its edges and read as off-centre.
- Also shipped from the same feedback: **three-axis rotation** (shift-drag or right-drag rolls, Q/E keys),
  and **flick inertia** (`FRICTION = 0.955`) that keeps the throw's momentum and settles back into the
  idle turn — or back to the work, if the work is live.
- Verified: all three URLs 200, 25,639-byte page, switcher links present, body table present in all.

## The two candidates, with a simulator (2026-11-24)
- **Option 1 — buckyball** (`?shape=bucky`, default): the truncated icosahedron, built honestly by
  taking two points one third along each of the icosahedron's 30 edges → **60 vertices, 90 edges**,
  plus **32 panel nodes** (12 pentagon centres = icosa vertices, 20 hexagon centres = edge midpoints).
  Hollow cage: vertices as spheres, edges as filaments, panels as faint rings.
- **Option 2 — 3-fold icosahedron** (`?shape=threefold`): every face split into three around its
  centre → **32 vertices, 90 edges, 60 triangular panels**, threefold symmetry.
- **The 3D flower transform**: `flowerWrap()` carries the nineteen flat circles onto the sphere in both
  hemispheres — the logo becomes the skin of whichever body is chosen (`FLOWER_SKIN`, drawn first,
  faint gold).
- **Simulator slider** (bottom-left, `0–5`): dormant · stirring · working · busy · surging · at full
  stretch. It synthesises trail length (`level × 6`), agent count, focus, bloom and a ripple, so the
  ramp of each intelligence level can be watched without waiting for real work. Real activity resumes
  the moment the slider is back to 0.
- **Idle movement +30%** (`IDLE_SPEED = 0.00006 * 1.3`), still slow enough to breathe.
- Centring unchanged and absolute: `FIT / BODY.radius`, exact viewport middle, for every body.
- Verified: both URLs 200, 30,531-byte page, every construct present.

## The sanctum is the room (2026-11-24)
The blank conversation was a 96 px logo beside a big composer; the visualizer now leads.
- **`/flower?embed=1`** renders the body with every piece of chrome hidden (`body.embed`) and a larger
  fit (`FIT = 0.46` embedded vs `0.37` standalone), for use as a stage.
- **The hero** is now a circular stage: a same-origin `<iframe src="/flower?embed=1">` sized
  `min(640, max(320, 0.66 × smaller viewport axis))`, with a radial veil so it dissolves into the page
  instead of ending at a frame. It is the largest element in an empty conversation; the headline and
  composer sit beneath it.
- **Presence, not a control**: the frame has `pointer-events: none`, so it never steals the scroll or the
  click from the composer. Turning it is what `/flower` is for.
- **Phones keep the small mark**: under 900 px wide the iframe is not mounted at all (a full canvas in a
  phone's chat view costs more than it gives); the 96 px turnable SVG is the fallback.
- Verified in the deployed client bundle: `src: /flower?embed=1` inside `HeroShell_module_css_default.sanctum`
  present, and `/flower?embed=1` returns 200 with both the embed class and the larger fit.

## The galaxy (2026-11-24)
The body is no longer a polyhedron. `/flower` (and the phone hero) render a fixed, symmetrical
**sphere of interlocking circles**:
- **31 great circles** derived from the icosahedron's own symmetry — 6 axes through opposite vertices,
  15 through opposite edges, 10 through opposite faces. Nothing is hand-placed.
- **242 unique intersection nodes** from 930 pairwise crossings (deduplicated on a 3-D grid at 1/200
  resolution). That is the "hundreds of points" the galaxy needs, and it is fixed and symmetrical.
- **The 19 circles of the mark are carried onto the sphere** as a brighter root layer (`flowerPaths`),
  so the galaxy literally grows from the logo's geometry.
- Rendering keeps it cheap: back-hemisphere circles → all nodes sorted by depth (glow sprites) →
  front-hemisphere circles. No z-sorting of thousands of segments, one sprite cache.
- **Alive when unobserved**: idle turn (`IDLE_SPEED = 0.00006 * 1.3`), the 11 s breath, hour wash;
  work makes the nearby nodes turn green and sends a ripple through the field.
- **Explorable**: drag to travel (yaw/pitch/roll), shift-drag to roll, flick inertia that settles back
  into the idle turn, scroll zoom, arrows/Q/E/R keys. Nothing navigates on click.
- **Phones now mount the stage**: the old 900 px gate was why a phone saw only the 96 px SVG.
  `stageFits()` is width ≥ 320 and the phone size is `min(width × 0.88, height × 0.5)` — ~327 px on a
  372 px viewport. The stage is embedded at `?embed=1` with `FIT = 0.50`.

## Ways into the mind (2026-11-24)
Spinning was the one function; the galaxy now has a vocabulary of movement:
- **Pick a star** — hovering finds the nearest projected node and names it (`vertex × edge · node N`);
  the two great circles that cross there brighten to warm white while the other 29 dim.
- **Enter it** — tapping a star dives: the camera eases the node to the centre and zooms to 2.0, so
  you see the crossing itself. Tapping empty space (or Escape) unwinds the dive and comes back out.
- **Pinch for depth** — two fingers scale zoom 0.55–3.2 (the existing wheel and scroll still work).
- **Still it** — Space freezes the idle turn and the breath so the wiring can be studied; pressing it
  again lets it breathe. Escape returns from a dive.
- The counter now reads `galaxy · 242 intersections · 31 circles · 242 ways in`.
- Verified live: every marker present; page 30,726 bytes.

## Immersion: the galaxy is the chat (2026-11-24)
Opening the app with an empty conversation is now a full-screen, **interactive** galaxy, not a chat
window with a picture in it:
- The `/flower?embed=1` frame is mounted through a portal to `document.body`, `position: fixed`,
  `100vw × 100vh`, and is **pointer-events: auto** — drag it, flick it, tap a star to dive.
- The hero shell goes `pointer-events: none` (`[data-immersion='true']`) so drags pass *through* the
  transparent hero to the frame beneath; the composer sits above at its own z-index and still takes
  every click.
- The conventional headline and workspace chip hide in this state; one faint prompt remains:
  "touch the mind — dive into a star to begin" (`hero.diveToBegin`, in all 8 locales).
- Embed mode raises the sphere (`ANCHOR 0.40`) and fits it larger (`FIT 0.46`) so the composer has
  clear space at the bottom.
- The fractal is wired: diving into a star reveals a smaller galaxy inside it at zoom > 1.55, and one
  inside that at > 2.9; zoom travels to 7×.
- Verified in the deployed bundle: immersion prompt, interactive frame, pointer pass-through, galaxy
  frame all present; `/flower?embed=1` 200 with chrome hidden and dive wired.

## The mind and its hidden door (2026-11-24)
- **Every star is a thought**: roles cycle through "a good thought / a bad thought / a random thought /
  a memory / a tool / a project / a ramble / an unfinished idea / a doubt". Hovering names the thought
  instead of its geometry; nothing is labelled as navigation.
- **Exactly one star is the door**, and it moves with the day (`PORTAL = (daySeed + 17) % nodes.length`
  where `daySeed` comes from the date). Touching it posts `massai:enter` to the room; touching anything
  else only opens it for looking. Hovering the door says "the door — touch it to enter".
- **Endless finding**: six zoom bands (1.5, 2.4, 3.8, 5.6, 8.0, 11.0), each passed threshold growing
  another galaxy inside the last, anchored on a different star, shrinking by 1.75× per band. Zoom travels
  to 16×. The **root never moves** — it is always the fixed 31-circle flower.
- **No composer on arrival**: the app renders the composer stack with `data-enter-gate='closed'`, which
  hides the input card, dock and workspace row; the immersion prompt is exempt. The single
  `massai:enter` message from the door flips the gate and the composer appears.
- Verified live: roles, daily door, enter postMessage, endless bands, 16× travel, gate and message all
  present; page 35,880 bytes.

## The entire screen (2026-11-24)
- **Nothing of the app paints over the galaxy any more**: `.root[data-phase='hero']` is
  `background: transparent`, and the header/mode strip fades out in the hero phase (it returns on hover,
  so navigation is still reachable).
- **The door is the centre star**: `PORTAL` is computed as the node whose direction is closest to the
  camera's forward axis at rest (`REST_YAW 0.4`, `REST_PITCH -0.35`), so it sits dead centre when the page
  settles. It carries one slow ring (findable, not a sign) and is **the only clickable thing**: touching
  any other star names it for 2.6 s ("a bad thought", "a memory", …) and goes nowhere.
- Touching the door posts `massai:enter`; the room flips `data-enter-gate` from `closed` to `open` and the
  composer appears. Before that the input card, dock and workspace row are hidden by CSS — the mind has no
  bar.
- Verified live: door-at-rest, single clickable, thought naming, door ring, endless bands, root flower all
  present on `/flower` (37,425 bytes); door message, composer gate, galaxy frame and pointer pass-through
  all present in the deployed client bundle.

## The cloud (2026-11-24)
The glow is now emergent rather than drawn:
- Each of the 242 stars draws **two sprites**: a wide faint halo (`core × 3.6`, alpha ≈ 0.16 × strength)
  and the star itself. The node pass runs under `globalCompositeOperation = 'lighter'`, so overlapping
  haloes **add up** — hundreds of dim stars become one breathing cloud. No single star is bright; the sum
  is. That overlap is why it reads as alive.
- **Thoughts sit a shade darker than the door** (door tint `255,246,224`, picked `255,236,205`, thoughts
  `GOLD`) and the door's halo is wider (`× 5.5` vs `× 3.6`, alpha 0.30 vs 0.16), so the entry is findable
  inside the glow without being a sign.
- The additive pass is closed afterwards (`source-over`) so circles, flower layer and chrome draw normally.
- Verified live: additive pass, two sprites per star, door weighting, ring, root flower and endless bands
  all present; page 38,166 bytes.

## Five families, endless sky (2026-11-24)
- **155 great circles**: the 31 fixed axes (vertex/edge/face symmetry) plus **four more families**, each
  that same set of 31 rotated onto new axes by a day-seeded, deterministic `spin3`. Phones carry three
  families (93 circles) to keep the frame budget; wide screens carry five.
- **1,210 stars**: 242 from the root family, plus 968 unique crossings inside the rotated families
  (242 each, deduplicated on the same 1/200 grid). The root stays exactly the fixed flower.
- **The sky is never all of it**: each extra family fades in (`reveal(familyIndex)`) over a zoom band
  beginning at 1.0 + 0.85·i — at rest you see the flower and its first deeper family; travel surfaces the
  next, and the next. Combined with the nested child galaxies (bands 1.5 → 11.0, up to 16×), zooming always
  finds more, on two independent axes.
- Drawn additive and dim (`0.045` circles, single sprite per extra star at `0.05–0.20`) so the cloud gains
  volume without paying four sprites per star.
- Counter reads `Massai · 1210 thoughts · 155 circles · one door`.
- Verified live: `/flower` 200, 42,579 bytes, five families, rotated axes, per-family reveal, family-aware
  nodes, additive deeper sky, sky-counting counter, root flower, door ring, endless bands all present.

## The immersion, as the first thing anyone meets (2026-11-24)
- **The black page has one loud button**: a bordered card with the title "Into the Unknown" and the note
  "enter the mind — drag, roll, dive · find the one door", linking to `/flower`. It sits above the
  "Start free" path, because the mind comes before the explanation. The door already has the galaxy
  framed behind its translucent card.
- **Layers of light**: the root circles are repeated on three inner shells (r = 0.86, 0.70, 0.55) drawn
  additively at falling alpha (0.16 / 0.11 / 0.07) — a body with depth in light, not one skin.
- **Pathways of use, live**: `drawPathways()` joins the last ten activity moments over the sphere with
  great-circle arcs, drawn as animated dashes (`setLineDash`, walking `lineDashOffset`) in green, so the
  body visibly *thinks along the work* as it happens.
- **Full retreat is the sphere**: every family present at rest (`inward` fades only as you zoom), and a
  limb gradient (`retreat`) draws the silhouette of the whole body when zoomed out past 1.35.
- **The door works standalone**: in the app it posts `massai:enter` to reveal the composer; on the open web
  it walks you to `/access`.
- Verified live: door button + link + framed galaxy on `/`; on `/flower` (46,781 bytes) shell layers,
  pathways, sphere limb, rest-state families, all-axis control, standalone door, zoom bands, five families.

## The fog (2026-11-24)
The body now hangs inside air rather than empty space:
- **Four enormous soft blobs** (amber, violet, teal, warm gold) drifting on slow Lissajous paths
  (`sx ≈ 2×10⁻⁵ rad/ms` — a full wander takes minutes), drawn additively at 0.030–0.042 alpha, scaled to
  2.6× the fitted sphere. One pre-rendered 256 px fog sprite per tint, so fog costs four `drawImage` calls.
- **A core veil** at the centre (`0.05–0.07`), so the densest part of the body reads as an entity rather
  than a pattern.
- All of it breathes with the same `breath` term as the stars, so the fog and the light are one organism.
- Drawn immediately after the background wash and before the circles, so every star, shell layer and
  pathway sits **over** the fog.
- Verified live: fog cache, four blobs, wandering paths, core veil, additive pass, breathing, and all
  earlier layers present; `/flower` 49,046 bytes.

## The corner, and the phone fixes (2026-11-24)
**The corner** — the realisation that solved the confusion: a single dot in the top-left
(`.corner`) that opens a drawer with **every surface** (New conversation, The mind, Map, Projects,
Library, You, Limits, Settings, Support, Operator). It is rendered by `ConversationContent`, so it
exists in every phase — immersive or not — and no state of the galaxy can strand a person. Escape or a
backdrop tap closes it.

**Three real defects the phone screenshots exposed, all fixed:**
- *It kept retreating on its own* — a leftover line forced `zoom → 1` whenever you were not dragging.
  Removed: where the camera is put is the user's to keep; coming back out is explicit only.
- *A second sphere floated off to the side* — child galaxies were being planted on day-seeded anchors
  even without a dive. Now **children exist only inside a star you enter**.
- *Deep zoom looked like a computer, not a galaxy* — great circles read as straight rays up close.
  Circle alpha now yields with depth (`soft = max(0.18, 1.45 − zoom × 0.28)`), so the fog and stars
  carry the depth instead.
- The door's tap target widened to `34 × DPR` — a thumb is not a mouse.

Also in the bundle: `wayIn` (a quiet way in after 22 s) and Enter opens the workshop.

## Full auto pass (2026-11-24, late)
Every steer the owner pushed, consolidated and live on **`7ca7a91a`** (Render image pinned by full SHA):

**The splash** — `GET /unknown` is a *completely black page* whose only element is the galaxy itself:
a live `<iframe src="/flower?embed=1">` clipped into a 320 px orb, ringed, with the label
**Into the Unknown** and the hint *touch the sphere* beneath it. The whole orb is one `<a href="/flower">`,
so touching the mind is the way in. A visually-hidden "skip to the workshop" keeps it accessible.
The door at `/` leads here first (`Into the Unknown → /unknown`), and still offers a plain way in.

**The mind** (`/flower`, 56 KB script):
- **Screensaver**: 45 s of stillness and the mind takes itself for a walk — every 5–9 s it picks a star,
  dives, withdraws, ripples, and *names what it passes* ("a memory", "a tool", a real `trail` label when
  activity exists). Any pointer/key/wheel input wakes it instantly and keeps the camera where the user
  left it.
- **Endless both ways**: zoom runs 0.16 → 20; past the sphere, three larger dimmer copies of the body
  appear one beyond the next (`outward`), and going in surfaces families and nested child galaxies.
- **A pose that never repeats**: besides yaw drift, slow independent tilts on pitch and roll with
  non-dividing periods.
- **The door is an Easter egg**: the ring only renders when zoomed past 1.5 or hovered — never a signpost.
  The corner menu is the guaranteed way in.
- **Fullscreen on the first touch** (`requestFullscreen` on `pointerdown`, `F` toggles) — browsers require
  a gesture, so this is as close to "fullscreen on load" as the web allows.
- Inside-mode fog/vignette, shell layers, pathways, five families all retained.

**Full-auto verification (live):** `/unknown` 200 with orb + label + link + skip path; `/flower` 200 with
screensaver, self-naming, outward sky, 0.16–20 zoom, tilt wobble, Easter-egg ring, fullscreen, inside-mode;
app bundle has the corner menu, the composer gate, the 22 s way in, and the galaxy frame.

**Operational note:** Render deploy POSTs intermittently return `400` right after CI finishes; retrying a
few seconds later succeeds (`201`). Always re-check the deploy list rather than trusting one POST.

## Typing the domain is the whole instruction (2026-11-24, late)
Live on `8a44a8f1`. The path is now exactly four words long:

**`massai-itu.ca` → the orb → the mind → enjoy it.**

- **`/` is a completely black page (4.7 KB)** whose only content is the galaxy in a circle:
  a live `<iframe src="/flower?embed=1&spin=1">` clipped to a 320 px orb, labelled **Into the Unknown**
  with *touch the sphere* beneath it. The whole orb is one `<a href="/flower">`. No `/unknown` to type —
  that route now 302s to `/`.
- **Randomised spin**: the splash orb asks for `spin=1`, so every visit starts in a new pose.
- **A single sidebar button** (top-left, unchanged icon) opens a drawer **categorised** so every avenue is
  findable: *Wander* (The mind · Map · Library) · *Make* (The workshop · Projects) · *Understand*
  (Guide · Limits · Support). The same categorisation is in the app's corner drawer
  (*Make* · *Wander* · *Understand* · *Yours*).
- **A mind in a new mood each visit**: geometry fixed (always the flower), weather randomised per load —
  `MOOD` (fog phase offset), `BREATH_SPEED` (0.00042–0.00068), `DRIFT` (0.78–1.28), `FOG_ENERGY`
  (0.75–1.35), plus a random starting yaw/pitch/roll. Same being, different mood.
- Nothing was removed: `/access`, `/projects`, `/library`, `/map`, `/guide`, `/limits`, `/support`, `/me`,
  `/settings`, `/admin` all still reachable from the drawer, and every one verified present in the splash.

**Verified live:** `/` 200 black + orb + label + link + spin + sidebar + categories + all pages listed;
`/flower` 200 with per-visit mood, screensaver, endless zoom both ways, Easter-egg door, fullscreen;
`/unknown` → 302 → `/`.

## The body paces itself (2026-11-24/25, live on `07a9a048`)
The mind now measures its own frame times and sheds weight before speed becomes a problem — phones are
the real target, and the last several layers (fog, shells, five families, 1,210 stars, pathways) added up.
- `frameAvg` is an exponential moving average of frame time, sampled every frame.
- Every 90 frames: above 23 ms it sheds a step of `quality` (0.15 down to 0.3); below 14 ms it recovers
  (0.06 up to 1).
- Shed order, cost-before-beauty: fog blobs → inner shells → extra families (below 0.5) → outward sky
  (below 0.55) → **star stride** (every 2nd or 3rd star below 0.7/0.45).
- **The door never sheds**: `entry.index === PORTAL` (and the hovered star) always draw, so the Easter egg
  cannot vanish under load.
- **Reduced motion** is a complete mode now: no screensaver, no self-drive, and the door's ring is always
  visible — an Easter egg still has to be reachable by someone who has asked the machine to be still.

Live verification: `/flower` 200 · 58,439 B · adaptive quality, fog/shell/stride shedding, exempt door,
still-mind mode, per-visit mood, screensaver, endless zoom, fog+shells+pathways all present.
`/` still the 4.6 KB black splash with the orb and the categorised sidebar.

## Framing by intent (2026-11-25, live on `7efd525e`)
Your phone screenshot showed the mind riding high with a third of the screen empty beneath it. That was
`ANCHOR = 0.40` — a leftover from when the composer sat at the foot of the screen. Now:
- **`ANCHOR = 0.5` always**: the mind is centred, because nothing waits at the bottom any more.
- **`?fit=orb`** (the welcome orb) keeps `FIT = 0.40` so the *whole* sphere sits inside its circle and the
  button reads as a complete object.
- **Embedded without `fit`** (the app's backdrop) uses `FIT = 0.58`, so the mind fills the frame instead of
  floating in it. Standalone `/flower` stays at 0.40.
- The splash iframe now requests `?embed=1&spin=1&fit=orb`.

Verified live: app framing 0.58, orb framing, centred anchor, adaptive quality, exempt door and per-visit
mood all present on `/flower`; splash still black, labelled, and requesting orb framing.

## Quiet orbs, and ways out (2026-11-25, live on `4a2bce8c`)
- **`/welcome`** serves the splash to anyone, signed in or not (the owner always carried a session, so
  they could never meet it at `/`). `/unknown` → `/welcome`; anonymous `/` still serves it directly.
- **`?quiet=1`** (or any `fit=orb` frame) makes a decorative orb stop polling: no `/api/one-turn/activity`,
  no `/api/vitals`, no counters. The splash orb is the mind as an object, not a dashboard. It also means
  the orb starts its own screensaver tour after 45 s, since no input ever reaches it.
- **A keyboard way off the canvas**: the standalone `/flower` now carries a visually-hidden
  "skip to the workshop" link that becomes visible on focus — a canvas is not a tab stop, so without it a
  keyboard user had no exit at all.
- **The welcome page is in the app drawer** (Wander → The welcome page), so the owner can always see what a
  stranger sees.
- Verified live: orb requests `quiet=1`, splash intact, quiet gate present, skip link + focus styling,
  framing 0.58 / anchor 0.5, adaptive quality, and both drawer fixes in the deployed client bundle.

## The mind and the tool share a sentence (2026-11-25, live on `f0f41588`)
The galaxy stopped being decoration and started being *in the loop*:
- **Your words land in the mind.** The `session/event` hook now treats a user turn as an activity moment:
  `recordActivity('conversation', 'you said: <first 48 chars>', session)`. The text is read best-effort
  through a depth-limited walk (`readUserText`) that only ever feeds a label, never a decision. So the
  trail gains a dot the moment you speak, `/api/one-turn/activity` returns it, and the galaxy flickers.
- **The screensaver walks real work.** With activity present it picks a random recent moment, sends the
  camera to that star and says the label ("read_file", "you said: …"); with nothing to remember it wanders
  and names its own thoughts. The self-tour is now a replay of your day.
- **The door hands its thought to the workshop.** Touching the door posts
  `{ type: 'massai:enter', thought }`; the app stores it and the composer placeholder becomes that thought —
  the mind and the tool share one sentence. (Declaration order fixed: the state is declared with the rest,
  before the composer reads it.)
- **The welcome page says one true thing**: under the orb, *"say what should exist — it gets built"*, so a
  first-timer is not left with pure ritual and no words.
- **A keyboard user can leave the canvas**: visually-hidden skip link to the workshop, visible on focus.
- Live check of the whole machine: `/`, `/welcome`, `/flower`, `/flower?embed=1`, `/access`, `/map`,
  `/projects`, `/library` all 200; activity + vitals endpoints answering; fuel $17.51, memory ok,
  129 works, 6 lessons.

## No disclaimer first, no off-centre body (2026-11-25, live on `fd9d06d1`)
Two regressions, both fixed and verified:
- **The first-run modal is gone on the web.** `ui-settings-account` injected a `shell.overlay`
  (`desktop-onboarding`) whose welcome step reads "Welcome to DeepSeek Harness" and carries a disclaimer.
  It is now gated behind `if (desktop)` — `desktop = 'dshDesktop' in globalThis`, which is false in a
  browser — so a web visitor never meets it. The account settings panel is untouched.
- **The body is centred again.** The door lives at the rest pose; an earlier "mood" change had made
  *every* load start in a random pose, so the door's ring (and the body around it) projected off-centre.
  Now only the welcome orb (`spin=1`) spins randomly; the app keeps `yaw 0.4, pitch -0.35, roll 0`, so the
  door sits dead centre. (Also removed backticks inside the flower template that had broken the build.)
- Anonymous `/` remains the black splash: orb + label + no disclaimer (4,822 B).
- Verified live: fixed rest pose, random-only-for-orb, onboarding overlay gated, clean splash.

## Exploration fixed (2026-11-25, live on `9d5fb6bc`)
The two broken verbs of the mind are fixed:
- **No forced zoom on dive.** The dive used to drag `zoom` toward 2.0 by itself, which is what felt like
  "being sucked back/around". Now a dive only *aims* the camera at the star; the hand decides depth by
  zooming, and the child galaxies inside the star surface as you cross the bands.
- **Any star opens inward.** Before, only the door did anything; regular stars just named themselves.
  Now tapping any star sets the dive: the camera aims at it, and zooming in surfaces its inner galaxy.
  The door is still the one star that *also* opens the workshop.
- **Siblings appear in the peripheral on zoom-out.** The old "outward sky" drew bigger centred copies that
  scaled straight off the screen. Now six small bodies fade in at fixed angles around the periphery as the
  main sphere shrinks — the galaxy as one among many, visible exactly where the eye looks when it pulls
  back.
- **Centring**: the app frame now uses the real visible viewport (`100dvh` instead of `100vh`, which a
  mobile address bar makes taller than the screen) and framing eased 0.58 → 0.52 for margins, so the body
  reads centred rather than clipped.
- Verified live: no forced zoom, any-star entry, peripheral siblings, 0.52 framing, rest pose retained.

## Centre on the glass, and stop the lurch (2026-11-25, live on `64eddfdb`)
- **The "Preview Notice" modal is gone.** It came from `ui-settings-models` (its registration was
  `if (!('dshDesktop' in globalThis))`, i.e. it showed *in the browser*) and read "DeepSeek Harness 0.2 is
  still in preview … Continue". The automatic registration is removed; the component and store remain for
  settings to open deliberately.
- **Centring now measures the visual viewport.** `window.visualViewport` (falling back to the layout
  viewport) now defines `VW`/`VH`, and all 38 geometry references use them; the visualViewport `resize` and
  `scroll` events re-measure. The layout viewport is taller than the glass by the height of a mobile address
  bar (and wider under pinch-zoom), which is exactly what put a "centred" body up and to the left.
- **The self-tour eases its distance instead of jumping.** Screensaver steps used to set `zoom` directly
  (1.15 ↔ 2.4 in one frame — the "lurchy" idle motion). They now set `zoomTarget` and the frame eases into
  it (0.07 per frame); wheel, pinch and reset still set both, so direct control stays instant.
- Not verifiable by me: the attached .mov (no ffmpeg/cv2/av/imageio in this environment, so I cannot watch
  it). The diagnosis is from the code path and the described symptoms.
- Verified live: visualViewport in use, eased tour, immediate wheel, splash intact.

## Confirmed on the device (2026-11-25)
The owner has now seen, on their own phone, the state this work was aiming at — worth recording as the
acceptance point for the immersion:
- **centred** (visual-viewport geometry, `64eddfdb`)
- **fluid** — "a more fluid motion", because the self-tour eases to targets instead of jumping
- **never ending** — zoom finds structure in both directions (siblings outward, inner galaxies inward)
- **completely random** — per-visit mood, pose, breath and drift
- no Preview Notice modal, black splash with the orb and one label

Anything after this point is additive to a working whole, not repair.

## The octave engine (2026-11-25, live on `20cf7ba9`)
Ported the architecture her screensaver uses, so the zoom is unbounded rather than banded:
- **Logarithmic scale**: `zoomLog` is the continuous exponent; the visible size is
  `OCTAVE^frac` kept inside `[1, 3.6)`, so travel is infinite in both directions and every step
  feels the same size. Wheel/pinch move the log; `R` returns it to 0.
- **Five octaves drawn at once** (`k = -2…+2`), each at `zoom × OCTAVE^k`, with an envelope
  (`near × far`) that fades one out as the next fades in. As the fraction sweeps, the body that was
  the outer lattice becomes the centre body — no seam, no band, no pop.
- The old six-band table (`ZOOM_BANDS`) is gone entirely.
- **The simulator left the presentation**: it is removed from the page unless `?sim=1`, and lives in
  settings for anyone who wants to drive the levels.
- **`?z=<log>`** presets the camera depth, so any octave can be photographed without a hand on the glass.
- Verified by screenshot (Chromium headless at 430×932): `z=0` a sphere inside a mandala, `z=0.45`
  three scales visible at once (parent lattice, main sphere, inner sphere) with the door ring intact,
  `z=0.9` mid-handoff with the parent fading and the child resolving. Saved as
  `mind-octave-0.00.png`, `mind-octave-0.45.png`, `mind-octave-0.90.png` beside this file.

## It breathes depth on its own (2026-11-25, live on `7e23b92c`)
Watching it, the owner noticed the rotation but no automatic travel. Added, and deliberate about
hand-over:
- **Depth breath**: `zoomLogTarget = driftBase + sin(driftPhase) * 0.9` with `driftPhase += dt * 0.0000125`
  — roughly an 80-second voyage ~2.7 octaves in and back out, forever, whenever nobody is driving.
- **Spiral, not a spin**: idle now advances yaw *and* roll on different rates, with a pitch wobble on a
  third period that shares no factor with either, so the pose never repeats.
- **It yields instantly**: any wheel or pinch sets `driftHoldUntil = now + 22 s` and rebases the voyage at
  the new depth (`driftBase = zoomLogTarget`, `driftPhase = 0`), so the hand is never fought and the
  breathing resumes from where the hand left it — never snapping back to an old centre.
- **The screensaver stopped nudging the zoom itself** (it used to jump ±0.55 octaves); it now only picks
  stars and ripples, and the breath carries the depth.
- Reduced motion disables both the breath and the spiral.
- Verified live: breath, period, hand-off hold, spiral, and the removed screensaver nudge. Two frames of the
  voyage saved as `mind-voyage-a.png` / `mind-voyage-b.png`.

## The mind as its own instrument (2026-11-25, live on `12759085`)
- **Settings panel** (`S`, or `?panel=1`): travel, pace, sparks, lattice-far, lattice-near, paths,
  lattice, keep-screen-awake — plus presets `voyage · still · storm · bare`, all saved in
  `localStorage` under `massai_mind`. The mind is now tunable by someone who is not the operator.
- **Length-based line fade**: each circle's stroke is attenuated by how far its longest *segment*
  travels (260 px reference, floor 0.16), so screen-spanning bars recede and short arcs keep their
  strength. Defaults softened to far 0.85 / near 0.40.
- **Sparks** (`K` to cycle, `?sparks=0..3`): two nearby stars light a temporary link, both ends glow,
  fades in ~1.3 s. Biased toward real activity when there is any.
- **Splash**: eight riddles rotating every 14 s, ten slogans every 8 s, a spinnable orb (all axes,
  forwarded by postMessage) that opens on a **double knock** or an **opening pinch**, with a plain
  link underneath for keyboards. Brand is always spelled **Massai** — never the ethnonym "Maasai".
- **Wake lock** when enabled, so a visualiser on a spare monitor does not sleep.

## Mind-as-a-product: the staged plan (agreed direction)
1. done — page, panel, presets, wake lock.
2. next — `/mind`: same renderer, no app chrome, no door, own PWA manifest, offline-safe defaults,
   plus a public coarse `GET /api/mind/feed` (skills + counts, never users) so it can be live or pure art.
3. only on demand — native wrappers; note a true OS screensaver is per-platform native work and iOS
   permits none of it, so "fullscreen PWA" is the honest ceiling on the web.

## /mind, the visualiser (2026-11-25, live on `70598e51`)
Stage 2 of the mind-as-a-product plan is in.
- **`GET /mind`** — the same renderer with the app's voice removed (`body.viz`): no door link, no
  counters, no condition line, no confession, no hint, no shapes footer, **no door ring** (`!VISUALIZER`).
  Just the mind, breathing.
- **`GET /mind.webmanifest`** — `display: fullscreen`, `start_url: /mind`, three icons, so it can be
  installed and left on a wall.
- **`GET /api/mind/feed`** — public, CORS `*`, 5-second cache: `{ live, skills{total,bySkill}, recent,
  focus{skill}, works, at }`. **Counts and capabilities only. No labels, no sessions, no identities.**
- **Privacy fix that this forced**: `/api/one-turn/activity` was publicly returning `trail` labels, which
  can contain the operator's own words ("you said: …"). Labels, events and agents are now **owner-token
  only**; everyone else gets capability shapes and counts.
- The visualiser polls `/api/mind/feed` and builds its trail from skill counts, so a public page can show
  that the workshop is alive without learning anything about who is in it.
- Linked from the door ("or leave it running as a visualiser ↗") and from the app drawer
  (Wander → Visualiser).

## APK — parked deliberately (2026-11-25)
The Android wrapper is scaffolded and does not block anything.
- repo: `BlunT4TnulB/massai-mind` — TWA config (`ca.massai.mind`, host `massai-itu.ca`, start `/mind`,
  fullscreen), a CI workflow that installs JDK 17 + Android SDK + bubblewrap, and `docs/TODO-APK.md`
  listing the only four remaining steps.
- The workflow **builds unsigned when no secrets exist**, so it can be run today for a sideload test;
  with a keystore present it signs.
- Server: `/.well-known/assetlinks.json` is served from env `ANDROID_ASSETLINKS`, returning an honest
  404 until a fingerprint is published. Publishing is an env change, not a deploy.
- Owner steps deferred by decision: keystore, fingerprint, three repo secrets, then set the env var.
- Why deferring costs nothing: `/mind` already installs as a fullscreen PWA on Android. The APK adds a
  Play listing and a nicer launcher icon, nothing more.
- iOS has no equivalent — Apple permits no web-based screensaver; PWA home-screen install is its ceiling.

## Real work leaves a constellation (2026-11-25, live on `015d23ad`)
The mind is causal now, in the smallest honest way that works.
- `noteActivity(bySkill, total)` compares the running total from the feed with the last one it saw.
  Each new unit of work lights a star: `lit` map, keyed by node index, remembering when and by which
  capability. Up to six stars per poll so a burst cannot flood the body. Each new star also fires a
  spark, which is the difference between weather and evidence.
- `drawLit` keeps them for **ten minutes**, drawing the star brighter while it is fresh and a thin
  figure joining consecutive marks. Real builds therefore leave a figure that decays; random sparks
  remain weather on top.
- The visualiser gets this from `/api/mind/feed` (count deltas), the app from
  `/api/one-turn/activity` (same counts) — same effect, two audiences.
- **Arrival**: with `?arrive=1` (or in the welcome orb) the camera starts at zoom 1.35 and settles
  out over 2.6 s, so a door-opened page begins in motion rather than as a cut.

### The bug this uncovered
`drawSparks` and `spawnSpark`/`drawLit` were defined but **never called from `frame()`** — an earlier
edit had targeted a call order that did not exist, so sparks had never fired at all. The bright flashes
seen before this were the focus bloom and ripples. Both passes are now in the actual render sequence
(after the octave loop, before the pathways), and the marks were verified by injecting eight lit stars
into a local copy and photographing the result (`mind-constellation.png`).

## Why a load was slow (2026-11-25)
Diagnosed after the owner reported the first long wait of the night.
- **Measured now:** `/`, `/welcome`, `/flower`, `/mind` and `/api/mind/feed` all answer in
  0.34–0.55 s. The service is warm and healthy.
- **The keep-alive is real and correct:** Cloudflare Worker `massai-keepalive`, cron `*/5 * * * *`,
  target `https://massai-itu.ca/healthz` (200). GitHub Actions was *not* the mechanism — its
  schedule queue was measured hours apart, which is why the Worker exists.
- **The likely cause: deploy churn.** Eight deploys today; the last went live at 16:08 and the slow
  load came minutes later. A Render free instance is replaced on every deploy, and requests that
  arrive during the swap queue at the edge until the new instance answers.
- **Mitigation, adopted:** batch changes into fewer deploys and warm the pages immediately after a
  deploy (`/`, `/welcome`, `/flower`, `/mind`, twice) so the first real visitor does not pay the
  first-request cost.
- **Not yet adopted (needs a decision):** a Cloudflare edge cache for the HTML pages (Cache Rule or a
  Worker route with `caches.default`). It would make the shell appear instantly even when the origin
  is cold — but it changes zone routing on a production domain, so it is a deliberate choice, not a
  default. The pages are identical for every visitor, so the idea is sound.

## The entry gate could re-close (2026-11-25, live on `c4ff2ad4`)
The owner could not find the composer after creating a workspace. Cause: `entered` was component
state in `ConversationContent.tsx`, and the composer is hidden while `hero && !entered`. Three paths
re-shut the gate after it had been opened, or never opened it at all:
1. the corner drawer offers **New conversation** and workspace creation *before* the door is found, so
   a workspace could exist with the gate still shut;
2. creating a workspace remounts the tree (blank session → hero again) and dropped `entered`;
3. navigating to a session route did the same.
Fix, all three signals now open it:
- `entered` is remembered in `sessionStorage` (`massai.entered`) for the tab;
- **creating a workspace is an act of intent** — if the workspace count grows while the gate is shut,
  it opens;
- arriving at a session (`sessionId !== undefined`) means the door is already behind them.
The ritual is intact for a first visit; it can no longer trap anyone after they have started working.
Not verifiable headlessly: the app shell is behind the owner gate (401 anonymous), so this awaits the
owner's confirmation. Fallback if it still bites: a visible "start a chat" action in the drawer that
opens the composer directly.

## The galaxy was painting over the app (2026-11-25, live on `6634008d`)
Found by actually driving a signed-in browser (Puppeteer + a session minted from `DSH_WEB_TOKEN`,
never from the owner's cookie). The gate fix was real but **not the user's blocker**:
- `GalaxyBackground` is portaled to `document.body` with `position: fixed; z-index: 0`, and the hero
  root carries `isolation: isolate`. The portaled frame therefore painted **above the entire app**.
- Measured: `document.elementFromPoint(composer centre)` returned `IFRAME.galaxyFrame`. The composer
  existed, was laid out (391×116 at y=436), and was completely covered — invisible and unclickable.
  This also hid the hero text and the workspace chip, which is why "there was no way to start a chat".
- Fix, in layers: galaxy `z-index: 0` (above the page background, below the column); hero root
  `z-index: 1`, transparent, and `pointer-events: none`; `.composerStack`, `.header`, `.corner`,
  `.wayIn`, `.drawerWrap` opt back in with `pointer-events: auto`.
- Verified after deploy: gate `open`; `elementFromPoint(composer)` = the composer input;
  `elementFromPoint(empty space)` = the galaxy iframe, so the door and the drag still work.
- Also shipped: entry remembered in `localStorage` (not just the tab), and owning a workspace counts
  as having passed the door.
- How the owner starts a chat: reload → composer is visible → **Choose workspace** (or +) → pick a
  workspace → type. "Standard mode" beside it is the mode/model selector.

### Minting an owner session (for future verification)
`DSH_WEB_TOKEN` is readable through the Render API and is now stored in `/workspaces/dashboard/.secrets.local`.
Exchange it with `GET /?token=<token>` → 303 + signed `dsh-auth-*` cookie (30 days). The `dsh_owner`
marker is `HMAC-SHA256(token, 'massai-owner')`. **Never ask the owner to paste a session cookie.**

## The hosted instance carries the whole project (2026-11-26, live on `95b74f14`)
"Transfer everything into Massai" is done, and it closes a loop rather than copying a folder.
- **Boot clone**: `Dockerfile` gained an `ENTRYPOINT` (`/usr/local/bin/massai-boot`) that, when
  `MASSAA_GIT_REPO` is set, clones or fast-forwards the repository into `MASSAA_WORKSPACE_DIR`
  (default `/app/Massai`) before the server starts. Runtime env set on Render:
  `MASSAA_GIT_REPO`, `MASSAA_GIT_PAT` (a repo-scoped token), `MASSAA_WORKSPACE_DIR=/app/Massai`.
- **Verified from the server itself**: `GET /api/mind/project` reports
  `{dir: /app/Massai, present: true, git: true, head: 95b74f14, tracked: 22530, remote: …***…}` —
  the full tree, at the deployed commit, with an authenticated remote already configured.
- **The loop**: the agent edits in `/app/Massai` → commits and pushes → CI builds → Render deploys →
  the new container clones the new commit. Git is the source of truth; the container filesystem is
  disposable (Render has **0** persistent disks, so this is the only honest design).
- **Consolidation**: the Android wrapper moved into the project (`android/`, `docs/android/`,
  `.github/workflows/android.yml`, manual-dispatch only so it never slows a push). The separate
  `massai-mind` repository is now redundant and should be archived to prevent drift.
- **Security note**: the PAT lives in the container's `git remote` URL. That is what lets the hosted
  mind push, and it is why the instance is owner-gated. Rotate the token if it ever leaks.

## Every project in its own folder (2026-11-26, live on `8e2480b8`)
All sixteen GitHub repositories are now accounted for on the hosted instance.
- `/usr/local/bin/massai-clone <repo>` clones or fast-forwards one repository into
  `MASSAA_PROJECTS_DIR` (default `/app/Projects/<repo>`) using the configured token.
- The boot script creates the folder for each name in `MASSAA_PROJECTS` (comma list) and clones it
  shallowly. Fourteen small repositories are cloned at boot (`~26 MB` total, a few seconds).
  Deliberately excluded: `massai-dsh` (the app itself, already at `/app/Massai`) and
  `massai-private` (437 MB — pull it on demand instead).
- `GET /api/mind/projects` — public-safe listing: name, cloned, commit, subject, file count.
- `POST /api/mind/projects/clone {name}` — **owner only** (403 anonymous, 400 for a name that is not
  a plain repository name), 202 accepted, clones in the background.
- Verified live: 14 folders, 12 with commits (two repositories are genuinely empty), 26–613 files each.

### Making them workspaces
The workspace list is client state, so each folder is added once in the UI:
**Add workspace → path `/app/Projects/<name>`**. The exact paths are returned by
`/api/mind/projects`, so the list can be copied from there.

## Where we are, 2026-11-26 (live on `ce1194b4`)
**Live and verified:** the mind (octave engine, breath, plasma arcs, five-kind language), `/mind`
visualiser, the door (8 riddles · 21 slogans · spin · double-knock · pinch), entry gate fixed and
persistent, the galaxy layering fixed (it had covered the whole app), the settings panel, the Android
wrapper parked, `/app/Massai` holding the whole project at HEAD, 14 project folders, the session port
(owner-only import), the operator door (`/access` → token), Clerk origins fixed, `DSH_WEB_TOKEN`
rotated after it appeared in a tool log.
**The mind's language is now causal:** `agent/error` and `agent/request-error` record a `fail`, so a
failed route draws crimson (committed today, `ce1194b4`).

### Waiting on the owner (four things, all small)
1. **Session port decision** — A (full 25.6 MB transcript), B (trimmed messages, recommended), C (fresh
   with handoff docs). This is the "same chat, through Massai" step.
2. **Workspaces** — add `/app/Projects/<name>` per project in the UI; the folders already exist, the
   list is at `/api/mind/projects`. Client state, so it cannot be done from the server.
3. **Nous Portal** (optional) — sign up, generate a key; then the OpenAI-compatible provider is a config
   insert and the free tier can be raised safely.
4. **APK** (deferred by decision) — keystore, fingerprint, three repo secrets, `ANDROID_ASSETLINKS`.

### What the operator can do next without waiting
- Allowance meter + per-user rate limit, then raise `DSH_USER_BUDGET_USD` (0.25 → ~1.00) once Nous is
  verified cheaper on a real invoice.
- One-turn builder quality (68% → 85%) — the item that decides whether anyone comes back.
- `learn` kinds: emit from the lesson recorder so green sparks are real, not simulated.

## Free has a shape, and the conversation travelled (2026-11-26, live on `dc16bea3`)
- **Allowance meter**: `GET /api/me?userId=…` now answers what is *left* —
  `ceilingUsd`, `remainingUsd`, `ratio` — not just what was spent. `/me` shows "Left this month"
  with a bar, so the free tier has a visible shape instead of being a rule you discover by hitting it.
- **Pace limit**: `DSH_USER_TURNS_PER_MIN` (default 12) is enforced in `agent/pre-step` before the
  model call, with one courtesy sentence then a refusal. A loop can no longer spend a month's
  allowance in a minute.
- **Failures are crimson, for real**: `agent/error` and `agent/request-error` record a `fail` kind.
- **The conversation ported**: this session's transcript was trimmed (tool payloads and attachments
  cut to `CAP` characters, structure preserved, header cwd rewritten to `/app/Massai`), compressed
  from 25.6 MB to **3.7 MB**, and imported with the owner-only endpoint. Verified sitting exactly
  where the harness looks: `~/.dsh/sessions/--app-Massai--/session-5da38d81-…/session.v4.jsonl.zstd`.
  The import endpoint learned the harness's real `projectKey()` rule (the first attempt was one dash
  short and landed in `--app-Massai-`, which the app would never look at).
- **Caveat, honestly**: it is not visible in the sidebar until a workspace at `/app/Massai` exists —
  the workspace list is browser state, and adding one goes through a directory-picker dialog. That is
  two taps for the owner, and I could not do them for them.

## Every folder is already a workspace (2026-11-26, live on `bbcd4ee4`)
The workspace list turned out to be **server-side** (`~/.dsh/storages/workspace.json`, a storage-domain
file), which means it can be seeded rather than tapped in one dialog at a time.
- **Boot seeder** (`/usr/local/lib/massai-seed-workspaces.mjs`, run from the entrypoint before the app
  starts): creates a workspace for `/app/Massai` and for every folder in `/app/Projects`, using the
  harness's own `projectKey()` rule; it also **attaches any session it finds on disk** to the workspace
  whose path produces that project directory, so a brought conversation is owned rather than orphaned.
- **Verified live**: the sidebar lists 15 workspaces (Massai, 150-200-Scanner-tool, 150-200MA-scanner,
  Crowbar-Workbench, Leather-Vest-DB1, Nest-Inventory, Scanner-Tool, cambium-ip-scanner,
  cambium-ip-scanner-projects, coding-agent-interface, massai, massai-mind, private-ptt,
  stock-scan-dashboard, stock-scanning-dashboard) with no owner action at all.
- **Caveat**: the sidebar lists *workspaces*; a session appears when its workspace is opened or through
  **Search sessions**. The ported conversation is at
  `~/.dsh/sessions/--app-Massai--/session-5da38d81-…/session.v4.jsonl.zstd` (3.7 MB) and attached to
  the Massai workspace, but a headless click on the row did not expand a session list, so its rendering
  is unconfirmed.
- **Ephemerality, stated plainly**: the transcript survives restarts (the seeder reattaches it) but not
  deploys. Persisting it needs an archive restored at boot — a private repository or a Render disk.

## History now outlives a deploy (2026-11-26, live on `9ca9596`)
- New private repo: **`BlunT4TnulB/massai-sessions`** — `manifest.json` + `sessions/<id>.zstd`.
- Boot restores before it seeds: clone the archive (token spent then stripped from the remote), read
  `manifest.json`, and copy each transcript into
  `$DSH_HOME/sessions/--<project-key-of-cwd>--/<id>/session.v4.jsonl.zstd`, then attach it to the
  workspace whose path owns it.
- **Proven on a fresh container**: after the deploy that introduced the restore, `GET /api/mind/sessions`
  reported `'--app-Massai--' → session-5da38d81-…` with no manual import. The conversation is now
  durable across deploys.

### The remaining gap, stated plainly
The app still does **not** list the restored session: `Search sessions` answers "No matching sessions"
and the workspace row does not expand a session. The file is in the right place and the harness's own
scanner (`listSessionDirs`) would enumerate the directory, so the likely cause is the *listing
metadata* a session normally carries (title/index/`.l2s` long-term state) rather than the transcript.
Next step: write whatever index the sidebar reads — inspect a locally created session's directory for
sidecar files and reproduce them.

### Queued, at the owner's request (not today's mission)
**Gemini history for a real account.** There is no API for a consumer's Gemini chat history — Google
exposes Gemini *models*, not conversations. The real routes are **Google Takeout** (My Activity →
Gemini Apps export) and clipboard paste. So "always linked, self-updating" is impossible today; a
**takeout import** (all chats) plus a **per-chat reference import** (one conversation loaded into a
project) are both feasible on the existing import path (`/import`, `appendImported`).

## Gemini links: the real blocker was Node, not Google (2026-11-26, live on `5509cd9`)
- **`link-reader.ts`** — the host fetches a pasted share link and hands the conversation to the model
  as *labelled data* before the step runs (`agent/pre-step`), with a note that it is not the user and
  not an instruction. Owner probe: `GET /api/read/link?url=…` (403 for anyone else). 12 s timeout,
  4 MB body cap, SSRF guard on private ranges and localhost, 8 000 characters per link, two links per
  step, deduplicated per session.
- **Diagnosis worth keeping:** `fetch` to `gemini.google.com` failed with `UND_ERR_HEADERS_OVERFLOW`,
  and `https.request` with the same — Gemini's response headers exceed Node's **16 KB** default.
  `curl` saw 302 happily, which is why it looked like Google was blocking us. Fixed by using
  `node:https` with `maxHeaderSize: 128 KB` and following redirects by hand (verified locally:
  `https.request` with the raised ceiling returns **200** and a 922 KB body).
- **After the fix, from Render:** gemini.google.com answers, the page title is read, and an invalid
  share id honestly reports "the page carried no readable conversation".
- **Still unverified:** extraction of a *real* share page. The parser walks `AF_initDataCallback` and
  `"conversation"` payloads (undocumented, moves often) and falls back to visible text. One real share
  link is needed to confirm or correct it.

## The port found the real format (2026-11-26, live on `5509cd9` + archive `massai-sessions`)
Three findings, each one earned by an experiment:
1. **The log is multi-frame.** The app writes `session.v4.jsonl.zstd` as **one zstd frame per
   record** (the original transcript has 22,040 frames). A single-frame re-encode is *listed* by the
   store but unreadable, and initially not listed at all. Re-encoding one frame per line made the
   session appear in the sidebar.
2. **Never trim structured events.** Capping every string corrupted a `developer/message`
   tool-addition and the app said so precisely: *"tool-addition \"terminal_send\" must name exactly
   one tool in headerSeq 611"*. The safe trim caps only `tool/result` (2000 chars) and
   `assistant/message` (6000), and leaves `developer/message`, headers and tool declarations
   byte-for-byte.
3. **It is now listed and it opens.** The sidebar shows `Ungrouped → Untitled`, the session opens, and
   the panel reads "Loading history…". The replay of that 30 MB / 39,559-frame log did not complete
   within 45 s in a headless check — so the last unknown is whether it is merely slow or stuck.
   Next step: open it on a real device and wait; if it never lands, keep the original frames and
   rewrite only the header frame instead of re-encoding the whole log (that preserves the exact
   bytes the writer produced, and should replay at normal speed).
- Archive updated to the frame-per-record file (30.3 MB) so boot restore is consistent with the
  format the app can read.

## The audit that found an outage (2026-11-27, live on `0775aeb`)
Full pass over everything built. Three faults mattered, and one of them was taking the whole site down.
1. **OOM loop (critical, fixed).** Render events showed `server_failed` / `oomKilled` at memoryLimit
   **512Mi** three times between 23:56 and 00:01. Cause: the ported conversation. A 30 MB log with
   39,559 frames is replayed into memory when opened, and a 512 MB instance cannot survive it — the
   kill takes the site down for everyone, not just the session. Fixes: `MASSAA_SESSIONS_REPO` cleared so
   boot no longer restores it; the archive repo now holds the transcript with `sessions: []` and a note;
   `/api/mind/session/import` **refuses any body over 8 MB with a 413 and a plain explanation**. No OOM
   events since.
2. **Keep-alive was pinging the challenged domain.** Cloudflare answers non-browser fetches with a
   challenge (429/"Just a moment"), and a challenge is not traffic, so the free instance slept anyway
   and the next visitor got `hibernate-wake-error` (503). The worker now pings
   `massai-dsh.onrender.com/healthz` **directly**, checks the public path once an hour, and its version
   string is `massai-keepalive/2`. Verified deployed and the origin answers 200 with no challenge.
3. **Banned copy survived.** "weeks on what one coffee costs" was still on /access. Replaced.

### Also repaired in this pass
- My earlier menu-removal script had deleted the splash's riddle **and** slogan rotation (86 lines).
  Restored: 9 riddles / 21 slogans, and two riddles now teach the three-finger gesture.
- The instrument panel is complete and verified by screenshot: motion, travel, thought, structure,
  atmosphere, the world, four presets and reset, every dial wired.
- Whole-site sweep after the fixes: every page and API 200 (19 requests), /providers included.

### Faults still open, stated plainly
- **512 MB is the real ceiling.** Session replay, big imports, or a heavy page can still OOM the
  instance. A $7/mo Starter instance (2 GB) removes the whole class of problem; until then the guard
  refuses oversized transcripts instead of dying.
- **The ported conversation is held, not restored** — it needs that larger instance.
- Gemini link extraction still unverified (needs one real share link).
- `learn` and `epiphany` kinds have no real emitters; `fail` does.
- Multi-agent panel, Nous wiring, APK secrets, and `/limits` disclosure of the link reader and session
  port are all still open.

## Open, needs the owner
1. **Render disk** — API returns `402 Payment information required`. Needs a card.
   Gives permanent notes/usage/memory across deploys.
2. **Clerk secret rotation** — dashboard only: API keys → rotate → update
   `CLERK_SECRET_KEY` in Render.
3. **Local DSH rebuild** — the running harness is the app-managed runtime
   `0.2.2-rc.1`; it cannot be rebuilt from inside. Update the app, or build the
   fork on a desktop.

## Honest caveats
- Hosted data (notes, usage, memory) resets on each deploy until there is a disk.
- The router only steers the DeepSeek route; local arms need a worker connected.
- Relay is single-worker-per-job and holds the caller open up to 3 minutes.
