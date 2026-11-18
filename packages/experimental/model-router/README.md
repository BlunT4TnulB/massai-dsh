# @deepseek-ai/dsh-model-router

Cost-aware DeepSeek model router — the routing *policy* for Massai.

- `route(task)` → `{ model, reason }`: `deepseek-flash` for simple/fast work,
  `deepseek-v4-pro` for complex/quality-critical work (keyword + length heuristics).
- Model-facing `route_model` tool so the agent can pick the cheapest suitable model.

## Config
- `cheapModel` — default `deepseek-flash`
- `qualityModel` — default `deepseek-v4-pro`
- `escalateKeywords` — keywords that escalate to the quality model

## Status
This is the decision engine. Automatic per-request routing + failover inside the
LLM resolution seam is the Phase 3 adapter build (see `SUPERIOR.md` Tier B/C).
