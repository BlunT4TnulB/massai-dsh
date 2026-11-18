# revamp-bundle

BlunT4TnulB's customization bundle for the forked DeepSeek Harness.

## Purpose
Carries the cost-aware defaults and presets that turn the upstream DSH into the
"better DSH": DeepSeek-only backbone, Flash for cheap work, V4-Pro for quality,
plus skills and presets as they're added.

## What it does today
- Pins the main-agent default to `deepseek-v4-pro` (reasoning `high`).
- Documents the flip to `deepseek-flash` (`reasoning low`) for a cheaper default.

## Roadmap (see /REVAMP.md)
- Custom agent presets (a "cheap/auto" preset + a "scanner-desk" preset)
- Skills bundled as plugin packages
- Model-router + secrets-vault plugins (Phase 2)

## Build
From the repo root: `pnpm install && pnpm build`. Installs as a bundle in any
DSH profile via the plugin manager (or by listing it in the profile's bundles).
