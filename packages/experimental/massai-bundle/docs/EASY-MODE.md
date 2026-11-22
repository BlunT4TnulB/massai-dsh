# Easy mode: the user never sees a dashboard

## The goal, in one paragraph

A person should be able to go from "I want a thing" to "my thing is running at a URL that I own"
without creating accounts, copying keys, opening four dashboards or understanding any of it.
Massai's own long-lived platform credentials absorb every wall; agents do the work; and at the end
the *artifact* is handed over — never the credentials.

## The walls we actually hit, and who should hold them

| Wall | Who holds it in easy mode | What "graduation" looks like |
|---|---|---|
| Model API key (DeepSeek/Gemini/Groq) | Massai's platform accounts, metered per user | user adds their own key later, or keeps using Massai's metered tier |
| Source control | Massai's GitHub org, a private repo per project | one click: push to *their* GitHub via OAuth |
| Hosting | Massai's Render (or a shared host), one service per project | transfer service or redeploy to their account |
| Database | one Neon project, one schema per workspace | export the schema to their own Neon project |
| Edge / cron | Massai's Cloudflare account | stays with Massai; graduates get their own if they want |
| Identity | Massai's Clerk app | user keeps their Massai identity; the project can be moved |

## The three rules that make it safe

1. **Agents never see secrets.** Every outbound call to a platform goes through a
   credential-injecting proxy. The agent asks for "a GitHub repo named X"; the proxy holds the token
   and adds it. Nothing sensitive enters the model's context, the transcript, the logs, or a
   tool result — so prompt injection cannot exfiltrate it, because it was never there.
2. **Nothing long-lived is minted into user space.** Per-task tokens are short-lived (minutes) and
   scoped to the one resource being touched. The durable secret lives in one place, encrypted at
   rest, readable only by the proxy.
3. **Deleting a project cannot delete a credential.** Projects and credentials live in different
   stores with no cascade between them. "Delete my project" is a genuinely complete deletion of the
   artifact; Massai's secrets are not part of that graph.

## The part that is a trap

> "Credentials that never expire but can never be used or stolen"

That combination does not exist. A credential that cannot be used grants nothing; one that can be
used can be stolen *if it is exposed*. What you can actually have — and what the proxy pattern
gives you — is **never exposed**. That is the property worth engineering, and it is achievable.

Two further honest limits:

- **One shared credential for everyone is a single point of failure.** A leak exposes every user at
  once, and one abusive user burns the shared quota. Minimum viable protection: per-user quotas,
  anomaly detection, and rotating tokens at the proxy, not shared keys handed around.
- **Automating sign-ups breaks platform terms.** We cannot script account creation on DeepSeek,
  Google, Render or Neon on a user's behalf — that is ToS-violating and gets accounts banned.
  Easy mode therefore means *Massai's accounts absorb the work*, and the user is a guest on them
  until they choose to own their own.

## Proposed phases

1. **Vault + proxy** (the foundation). Secrets encrypted in Postgres, a proxy endpoint the agents
   call, per-user quotas and an audit row per use. No secret ever reaches the model.
2. **Workspace that survives** — one schema per user, projects persisted, usage attributed.
3. **Graduation** — one-click: push repo to the user's GitHub, deploy to their host, print the env
   vars they now own. The artifact leaves; the credentials stay.
4. **Community shelf** — publish a finished build to a gallery with a licence and no credentials.
   Deleting it is always allowed; the shelf copy carries no access.
5. **Metered tier** — the free allowance is cheap because it is quota-limited and routed to flash
   off-peak; anyone who outgrows it either pays Massai or brings their own key.

## What easy mode is *not*

- Not infinite free compute: quotas are the only thing that keeps a shared deployment solvent.
- Not a way to avoid terms of service: Massai's accounts are for Massai's users, within each
  platform's rules.
- Not a promise that a shared secret is unstealable: it is a promise that it is never in the room.
