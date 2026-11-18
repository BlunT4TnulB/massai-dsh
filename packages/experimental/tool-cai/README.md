# @deepseek-ai/dsh-tool-cai

Exposes the `cai` DeepSeek coding agent as a model-facing DSH tool. The agent
delegates a self-contained task to the `cai` CLI (autonomous loop with file /
shell / web tools, planning, streaming, resume, and MCP) and returns its final
answer as tool output.

## Config
- `command` — `cai` executable (default `cai` on PATH)
- `workdir` — default working directory
- `timeoutMs` — per-call timeout (default 300000)

## Requires
- The `cai` CLI installed and on PATH (see `coding-agent-interface`, `pip install -e .`)
- `DEEPSEEK_API_KEY` available to the subprocess (env or DSH credentials)
