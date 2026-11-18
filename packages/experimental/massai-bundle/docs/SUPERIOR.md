# Making the fork SUPERIOR — implementation spec

Concrete plans for the "everything DSH does, plus more" features, grounded in the
actual repo internals (paths, service names, patterns verified against source).

## 1. Cost-aware model router (highest impact)

**Reality:** the only LLM adapters are DeepSeek (`packages/llm/llm-deepseek`,
`llm-pi-ai` twin). There is no generic OpenAI-compatible provider. The model catalog
is `packages/llm/llm-deepseek/src/models.ts` (`DEFAULT_MODELS`), configurable via the
provider's `models` array (`config.ts`, volatile).

**Plan (two tiers):**
- **Tier A — catalog + presets (done):** flash surfaced + `massai`/`cheap` presets.
- **Tier B — router adapter:** author `packages/llm/llm-router` as a new provider
  adapter that multiplexes `deepseek-flash` / `deepseek-v4-pro` / the local gateway
  (`coding-agent-interface`, OpenAI-compatible) / Ollama, with failover. Model it on
  `llm-deepseek/src/adapter.ts`. This is the real "superior" differentiator.
- **Tier C — "auto" model:** register a virtual `auto` model id that resolves to
  flash for simple tasks and v4-pro for complex ones (cost-aware heuristics).

## 2. Secrets & account connectors

**Reality:** DSH already has a full credentials system — `dsh-credentials` (service
contract) + `credentials-local` (file-backed, `~/.dsh/.credentials.yaml`, hot-reload,
cross-process locking). Do NOT build a new vault.

**Plan:** a `dsh-account-sync` plugin that:
- registers Drive/GitHub/Postgres tokens in the existing credentials service;
- exposes connector tools (list/read/write Drive, push GitHub, query Postgres);
- reuses the age-guarded, one-way semantics from `coding-agent-interface`
  (never let a stale cloud source overwrite fresh DB state).

## 3. Sync sources

**Reality:** DSH has `dsh-schedule` + `tool-schedule` (recurring jobs) and `dsh-jobs`.

**Plan:** a `dsh-sync` plugin that registers scheduled, age-guarded sync jobs
(Drive snapshot export, GitHub mirror, Postgres backup) using `dsh-schedule`, with
credentials resolved from `dsh-credentials`.

## 4. cai integration (bridge to the self-owned agent)

**Plan:** a `dsh-tool-cai` plugin exposing the `cai` CLI as a DSH tool (delegate a
sub-task to the DeepSeek coding agent), using `dsh-tools` + `dsh-subprocess`. Ports
the working `cai` loop (streaming, resume, MCP, planning) into the harness toolset.

## 5. Core revamp (Phase 3)

- DeepSeek-only defaults (Anthropic/OpenAI optional, never required).
- The web UI "could be improved" list (collect specifics from the user).
- `native/system` mobile rebuild once a dev machine/CI-with-Android-SDK is available.

## Working conventions (verified)

- Plugin package: `type: module`, `main: lib/index.js`, `exports` map,
  `peerDependencies` `@deepseek-ai/cordis: workspace:~`, `dependencies: workspace:*`.
- Plugin class: `import { Context, Service } from '@deepseek-ai/cordis'`,
  `static inject`, `static Config = z.object({...})`, `constructor(ctx, config)`.
- Bundle: `dsh.bundle.patch` → `cordis.patch.yml` (array of rows: `insert`/`id`/`name`/`config`).
- Preset: a row of `@deepseek-ai/dsh-agent-preset` with `{ id, order, plugins: [...] }`.
- Build: `pnpm install --frozen-lockfile` + `pnpm run typecheck` (CI: `revamp-ci.yml`).

## Immediate next actions
1. Implement Tier B router adapter (`packages/llm/llm-router`) — iterate via CI.
2. Implement `dsh-account-sync` + `dsh-sync`.
3. Implement `dsh-tool-cai`.
