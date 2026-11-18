# @deepseek-ai/dsh-account-connect

Account connectors over DSH's credential vault.

- `connect_account` — securely store a token (GitHub / Drive / Postgres / DeepSeek);
  values are never echoed.
- `list_accounts` — report which accounts are connected.

## Config
- `accounts` — the credential refs to track (default: DEEPSEEK_API_KEY, GITHUB_PAT,
  GOOGLE_DRIVE_SA, POSTGRES_URL).

## Requires
`@deepseek-ai/dsh-credentials` (the `credentials` service) mounted in the profile.
