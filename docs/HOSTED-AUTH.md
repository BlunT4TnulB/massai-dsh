# Hosted auth — per-user DeepSeek keys

Goal: the Massai hosted link lets each visitor sign in with their **own DeepSeek
API key** (or DeepSeek OAuth) — their key, their cost, their sessions — with no
cross-user bleed.

## What already exists (reuse, don't rebuild)

- `packages/account/deepseek-auth` — has **both** flows:
  - `authorize` (DeepSeek OAuth login)
  - `api-key` (paste your DeepSeek API key at sign-in) ← the MVP uses this
- `packages/credentials/credentials` — the credential seam:
  - `CredentialRef` = env-var name (e.g. `DEEPSEEK_API_KEY`)
  - `CredentialKey` = `<scope>/<id>` (the per-owner record space)
- `llm-deepseek-api-key` — resolves the key for the LLM adapter

So "sign in with your DeepSeek API key" already exists locally. The missing piece
is **multi-tenant scoping** on a shared host.

## The problem (why local-first DSH isn't multi-tenant yet)

DSH stores credentials per *installation* (`~/.dsh/.credentials.yaml`). A hosted
instance is ONE install serving MANY users — so a naive build would use the
server's single key for everyone, or bleed users into each other.

## Architecture (per-user scoping)

1. **Sign-in page** (web) — reuse the `api-key` flow; the visitor pastes their key.
2. **Per-user credential scope** — key the credential by the signed-in user:
   `CredentialKey = '<userId>/deepseek-api-key'`, written through the existing
   `credentials` service (`modifyRecord`).
3. **Per-session resolution** — the LLM adapter resolves the key for the *requesting
   user's* session, not a global default. The `llm-deepseek-api-key` plugin must
   read `scope: <user>`.
4. **Per-user data isolation** — sessions/workspace/attachments keyed by user id
   (DSH already scopes sessions per `~/.dsh`; a hosted build must scope per user
   on the server).

## MVP path (simplest correct first)

- **Paste-key sign-in** (no OAuth server needed): visitor pastes `sk-…` → stored
  per-user in the vault → every request uses that user's key.
- OAuth (`authorize`) comes second — it's nicer UX but needs DeepSeek OAuth
  client credentials on the server.

## Integration points to touch

| Piece | Change |
| --- | --- |
| `apps/web` | add a sign-in view (paste key) + call the api-key auth |
| `deepseek-auth` / account platform | accept a per-user scope, write `CredentialKey('<user>/deepseek-api-key')` |
| `llm-deepseek-api-key` | resolve the key per-session (user-scoped) |
| host/session | scope sessions + workspace per user id |
| `render.yaml` | wire `DEEPSEEK_*`/OAuth env for the server side |

## Exact mechanism (verified against source)

- `deepseek-auth` (`ctx.deepseekAuth`) resolves the key via **`credentialRef('DEEPSEEK_API_KEY')`** — the *CredentialRef* space (a global env-var-style name), ordered `'account'` → `'api-key'`.
- `llm-deepseek-api-key/src/config.ts` → `apiKeyEnv: z.string().role('credential-ref').default('DEEPSEEK_API_KEY')` — the same ref, resolved **per request** via `resolveCredentialRef`.
- The credentials seam has **two key spaces**:
  - `CredentialRef` (`resolve(ref)`) — global, env-var-shaped
  - `CredentialKey` (`<scope>/<id>`, via `readRecord`/`modifyRecord`) — the per-owner record space

**The per-user change:** the DeepSeek key must move from the global `CredentialRef`
to a per-user `CredentialKey('<userId>/deepseek-api-key')` — write it in the
`api-key` flow (`modifyRecord`), read it in `deepseek-auth`/`llm-deepseek-api-key`
(`readRecord`). The open seam is plumbing the **session's user id** into those
resolution points.

## Exact injection point (the last seam)

`packages/llm/llm-deepseek-api-key/src/index.ts` builds the request and calls auth:

```ts
return await ctx.deepseekAuth.authorize({
  consumer: settingsNs, accepts: ['api-key'], billing: 'api-key', destination: { url: endpoint },
  apiKeyHeaders: ['x-api-key'],
})
```

Add `userId` here once a per-session user id is available. The remaining plumbing is
the **source of that userId** (the host must know "this request is user X") — the
session/account boundary — plus the sign-in UI in `apps/web`.

## Status

⏳ This is the flagship Phase 5 build. The auth *flow* exists; the per-user
*scoping* is the real work, and it needs a running instance to implement and test
(the phone can author, CI can typecheck, but per-user auth must be exercised live).

## Honest sequencing

1. ✅ Deploy scaffold (Dockerfile + render.yaml) — done
2. ⏳ Paste-key sign-in + per-user credential scoping (the MVP above)
3. ⏳ Per-user data isolation
4. ⏳ OAuth login (nicer UX, later)
5. ⏳ Public launch (store, onboarding, privacy)
