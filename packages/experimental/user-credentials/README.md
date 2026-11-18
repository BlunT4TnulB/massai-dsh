# @deepseek-ai/dsh-user-credentials

Per-user credential service for the Massai hosted link. Stores each visitor's
DeepSeek API key as a `CredentialKey("massai-user", <userId>)` record in DSH's
credential vault.

- `signIn(userId, apiKey)` — store a key
- `resolveFor(userId)` — read a key
- `signOut(userId)` — remove a key

## Status
Credential-side foundation for per-user auth. The integration step — resolving the
key per-session in `deepseek-auth` / `llm-deepseek-api-key` — is documented in
`docs/HOSTED-AUTH.md`.
