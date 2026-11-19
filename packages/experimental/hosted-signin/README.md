# @deepseek-ai/dsh-hosted-signin

Hosted-link BYOK sign-in route. `POST /api/signin` (authenticated) stores a
visitor's DeepSeek API key under their session peer id via the credentials vault
(`CredentialKey("massai-user", <peer.id>)`).

- Body: `{ "apiKey": "sk-..." }`
- Returns: `{ "ok": true }`
