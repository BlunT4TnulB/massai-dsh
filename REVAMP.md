# Massai — The Plan

A fork of `deepseek-ai/deepseek-harness` (MIT) rebuilt into a superior, self-owned
agent environment with **DeepSeek as the backbone** — everything the current DSH does,
plus more.

## Vision

- Own the whole stack: core, web UI, CLI, and mobile (`apps/`, `packages/`, `native/system`).
- DeepSeek stays the cheap, capable backbone (V4-Pro flagship + Flash cheap tier + local Ollama).
- "More than DSH" = the features surfaced in this workspace:
  - cost-aware model routing + automatic failover (the gateway)
  - multi-account sync (Google Drive, GitHub, Postgres) with a secure secrets vault
  - multi-agent orchestration (Agent Teams) + Claude-Code-class autonomy (`cai`-style loop)
  - skills / presets / MCP / commands as first-class customization
- End state: **run the agent (DeepSeek) inside this fork as the daily driver.**

## Repo map

| Path | What |
| --- | --- |
| `packages/` | ~50 plugin packages (core, agent, session, fs, tools, mcp, client-ui, …) |
| `apps/web` | the browser GUI (Vite shell + `window.__DSH_BOOT__` injection) |
| `apps/cli` | the CLI entry (`/usr/local/bin/dsh` launcher) |
| `apps/desktop*` | desktop packaging |
| `native/system` | the mobile runtime (Android/Termux-style shell) |
| `patches/` | upstream patching conventions |

## Phases

### Phase 0 — Foundation ✅
- Fork created (`BlunT4TnulB/deepseek-harness`); `origin` + `upstream` remotes wired.
- Full source cloned to `/workspaces/deepseek-harness` (364 MB).

### Phase 1 — Extension wins (no core changes, survive updates)
- ✅ Flash model surfaced: added the missing `description` to `deepseek-flash` in
  `packages/llm/llm-deepseek/src/models.ts` (it was known but invisible in the picker).
- ✅ `packages/experimental/massai-bundle` created — cost-aware `agent-default-model` patch.
- ✅ `dsh-revamp` + `model-routing` skills added (5 skills live).
- ✅ Custom agent presets in `massai-bundle`: **scanner-desk** (focused project preset)
  and **cheap** (minimal tools + concise persona, pairs with Flash).
- ✅ Trademark note: name the fork using "DSH", not "DeepSeek Harness" (see BRAND_GUIDELINES.md).
- ⏳ Branding/theme + a bundle-of-7-bundles wrapper.

### Phase 2 — Custom plugins (own packages)
- 📐 Implementation spec: `packages/experimental/massai-bundle/docs/SUPERIOR.md`
  (model-router adapter, account-connectors, sync-sources, cai-tool — with exact
  repo paths, service names, and conventions).
- ⏳ `packages/llm/llm-router` — cost-aware provider adapter (flash/v4-pro/gateway/Ollama + failover)
- ⏳ `packages/experimental/dsh-account-sync` + `dsh-sync` — connectors + scheduled sync
- ⏳ `packages/experimental/dsh-tool-cai` — expose `cai` as a harness tool

### Phase 3 — Core changes (fork real value)
- Repurpose/revamp the agent loop and tooling toward the `cai` autonomy model.
- Improve the web UI (the user's "could be improved" list — collect specifics).
- DeepSeek-only defaults; make Anthropic/OpenAI optional adapters, never required.

### Phase 4 — Mobile
- Rebuild the native Android shell from `native/system` with the revamp baked in.
- Branded APK; iOS parity via `apps/*` where Apple tooling allows.

### Phase 5 — Distribute (BOTH paths)

1. **Installable app** — branded APK (Android) + iOS via TestFlight/App Store
   (iOS needs a Mac + Apple Developer account for signing).
2. **Hosted link (for iPhone / anyone)** — self-host the DSH web GUI as a
   multi-tenant service: each visitor signs in with their **own DeepSeek account**
   (own key, own cost), with per-user sessions/workspace isolation. This is the
   "send a link to my iPhone buddies" path and the highest-leverage distribution
   for non-Android users.
3. Private first (me + my buddy), then public (onboarding, data isolation,
   ToS/privacy, store accounts).

⚠️ Note: DSH is local-first today (one profile/home per install). A hosted
multi-tenant instance is a real architecture change — per-user DeepSeek OAuth
routing + per-user storage on the server — but the DeepSeek login pieces are
reusable, and `apps/web` already exposes the browser surface.

## Building (to verify on first real build)

```bash
cd /workspaces/deepseek-harness
pnpm install --frozen-lockfile   # pnpm@11.28.5, Node 24
pnpm run typecheck               # light compile gate
pnpm run build                   # full build (web: build:web, native: build:native-system)
```

- CI: `.github/workflows/revamp-ci.yml` runs `pnpm install` + `typecheck` on push/PR
  (additive; upstream's heavy `check:ci` lanes are untouched).
- ⚠️ The native mobile build needs Android SDK/JDK (use GitHub Actions or a dev machine);
  this phone environment has neither.

## Ground rules

- Never break the fork's ability to pull `upstream` updates (prefer additive packages over
  editing core where possible).
- Secrets never into the repo — vault + env only.
- Test every change; keep DeepSeek as the only required paid dependency.
