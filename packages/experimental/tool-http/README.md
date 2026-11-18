# @deepseek-ai/dsh-tool-http

Generic HTTP request tool. Optionally authenticates with a vault credential
(injected as a Bearer token), so secrets never enter the model's context.

## Config
- `timeoutMs` — request timeout (default 30000)

## Requires
`@deepseek-ai/dsh-credentials` (the `credentials` service) for credential-based auth.
