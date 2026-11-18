# DSH Revamp — The Plan

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
- ✅ `packages/experimental/revamp-bundle` created — cost-aware `agent-default-model` patch.
- ✅ `dsh-revamp` + `model-routing` skills added (5 skills live).
- ⏳ Custom agent presets, branding/theme, and a bundle-of-7-bundles wrapper.

### Phase 2 — Custom plugins (own packages)
- `dsh-plugin-secrets-vault` — encrypted secrets + account connectors (Drive/GitHub/Postgres).
- `dsh-plugin-model-router` — cost-aware routing + failover as a first-class plugin.
- `dsh-plugin-sync` — scheduled one-way/age-guarded sync sources.

### Phase 3 — Core changes (fork real value)
- Repurpose/revamp the agent loop and tooling toward the `cai` autonomy model.
- Improve the web UI (the user's "could be improved" list — collect specifics).
- DeepSeek-only defaults; make Anthropic/OpenAI optional adapters, never required.

### Phase 4 — Mobile
- Rebuild the native Android shell from `native/system` with the revamp baked in.
- Branded APK; iOS parity via `apps/*` where Apple tooling allows.

### Phase 5 — Distribute
- Private first (me + my buddy), then public (store accounts, onboarding, ToS/privacy).

## Building (to verify on first real build)

```bash
cd /workspaces/deepseek-harness
pnpm install
# see Makefile / README for the exact build targets (web, cli, native)
```

⚠️ The native mobile build needs Android SDK/JDK (use GitHub Actions or a dev machine);
this phone environment has neither.

## Ground rules

- Never break the fork's ability to pull `upstream` updates (prefer additive packages over
  editing core where possible).
- Secrets never into the repo — vault + env only.
- Test every change; keep DeepSeek as the only required paid dependency.
