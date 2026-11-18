# massai-bundle

**Massai** — the revamped, self-owned, DeepSeek-backed fork of DSH.

This bundle carries the Massai customization:
- **Cost-aware defaults** — `deepseek-v4-pro` as the main-agent default, Flash variant documented.
- **Agent presets** — `massai` (default coding preset) and `cheap` (minimal tools + concise persona).
- **`cai` tool** — delegate a task to the DeepSeek coding agent (via `dsh-tool-cai`).

## Trademark note
"Massai" is the product name. Describe the lineage as "built on DSH" / "a fork of
DSH" (per `BRAND_GUIDELINES.md`, avoid the full "DeepSeek Harness" trademark in
project names).

## Build
From the repo root: `pnpm install && pnpm build`. Installs as a bundle in any DSH
profile via the plugin manager.
