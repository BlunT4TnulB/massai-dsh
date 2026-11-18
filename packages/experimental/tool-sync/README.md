# @deepseek-ai/dsh-tool-sync

Model-facing `sync` tool: one-way, age-guarded `rclone copy` from a local path to a
cloud remote. Never pulls remote data back — a stale remote can't overwrite fresh
local state.

## Config
- `rclone` — executable (default `rclone`)
- `timeoutMs` — per-call timeout (default 300000)

## Requires
- `rclone` installed and a remote configured (`rclone config`).
