# Massai — how to try it

Massai is a fork of DSH (the DeepSeek Harness) plus the `massai-bundle` — cost-aware
model routing, custom presets, and the `cai` / `sync` / `model-router` / `account-connect`
plugins.

## Prereqs
- Node 24, pnpm 11 (`corepack enable` then the repo's `packageManager` pins it)
- A dev machine (the monorepo build is heavy; CI also works via GitHub Actions)

## Build
```bash
git clone https://github.com/BlunT4TnulB/massai-dsh.git
cd massai-dsh
pnpm install            # regenerates the lockfile (Massai adds packages)
pnpm run typecheck      # fast gate — what Massai CI runs
pnpm run verify-cordis-config   # validates the massai-bundle patches + presets
pnpm run build          # full build (web GUI, CLI, native)
```

## Activate the Massai bundle
The `massai-bundle` lives at `packages/experimental/massai-bundle` (built to `lib/`).
Install it into a DSH profile via the plugin manager, or list it in a profile's
bundle set, then restart DSH. It adds:
- `massai` (default) + `cheap` agent presets
- `cai`, `sync`, `route_model`, `connect_account`, `list_accounts`, `db_exec`, `db_query`, `http_request` tools
- DeepSeek-V4-Pro default (Flash variant documented)

## Full Massai setup (recommended bundle set)
For the complete experience, install `massai-bundle` **plus** the experimental bundles it
complements (all official, installable via the plugin manager):

| Bundle | What it adds |
| --- | --- |
| `@deepseek-ai/dsh-experimental-agent-team-profile` | multi-agent teams |
| `@deepseek-ai/dsh-experimental-forge-bundle` | git worktrees + change requests |
| `@deepseek-ai/dsh-experimental-session-search` | search past sessions |
| `@deepseek-ai/dsh-experimental-terminal-bundle` | persistent shells |
| `@deepseek-ai/dsh-experimental-plugin-market-bundle` | discover/install plugins |
| `@deepseek-ai/dsh-experimental-inspector-profile` | raw session-log inspection |
| `@deepseek-ai/dsh-subagent-claude-code` | Claude Code as a subagent (optional) |

## What CI already verifies
`.github/workflows/revamp-ci.yml` runs `pnpm install` + `typecheck` +
`verify-cordis-config` on every push/PR — so the fork is known to compile and its
bundle config is known-valid before you build it locally.

## Notes
- The model router ships the routing *policy* (`route_model` tool + `route()`).
  Automatic per-request routing + failover inside the LLM seam is the Phase 3
  adapter build (see `SUPERIOR.md` Tier B/C).
- Secrets never go in the repo — connect accounts at runtime via `connect_account`
  (stored in DSH's credential vault).
