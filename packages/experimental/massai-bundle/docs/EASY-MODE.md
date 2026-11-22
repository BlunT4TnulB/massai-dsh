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

# Nothing is lost: paused, not deleted

The owner's requirement: running out of free balance must never lose a project. Not "archived",
not "expired", not "contact support". Saved, visible, and resumable by three equally easy doors.

## What a project actually is

A project is three things, and all three have to survive a deploy:

| Part | Where it lives today | Must live |
|---|---|---|
| the record (name, owner, status, spend) | — (does not exist yet) | **Neon** (`projects`) |
| the files the agent wrote | container disk — **wiped on every deploy** | **R2**, one prefix per project |
| the conversation | container disk — **wiped on every deploy** | **R2** (or Neon, as JSONL) |

Two of those three are missing. That is the honest state: today a guest's work dies at the next
deploy, no matter what the UI says. Building the shelf before the storage would be a lie with a
nice page on it.

## The status machine

```
active ──budget out──▶ paused ──owner opts in──▶ adoptable ──someone adopts──▶ forked
   │                     │                          │
   │                     └──owner returns───────────┘ (back to active)
   └──owner deletes──▶ deleted  (the only destructive transition, explicit, typed)
```

- **paused** is the default landing place when money runs out. Nothing is removed.
- **adoptable** is opt-in: the owner says "someone else may carry this". Default is **private**.
- **forked** keeps the original owner's copy. Adoption copies, never moves.
- **deleted** is only ever the owner's own action, and it never touches Massai's credentials.

## The budget-out screen: three doors, equal weight

1. **Keep going on your own key** — paste one at `/access`, resume the same project, same files.
2. **Buy Massai a coffee** — a donation becomes credit on that account (e.g. $5 → an allowance
   for that user for the month). This is the path that keeps the shared budget honest.
3. **Take it with me** — download the project as a zip, or push it to your own GitHub. Leaves with
   you; nothing is held hostage.

Plus, quietly underneath: **it stays saved either way**, and there is a link to the shelf.

## The shelf

- Only **adoptable** projects appear. Nothing is published by default, ever.
- Each card shows: name, one-line summary, what was built so far, the original author's handle,
  and what it would need to continue (a key, a domain, time).
- Adopting documents the fork: `forked_from`, original author credited on the project page.
- A "finished" project can be offered to the shelf as a **template** — the community growth path
  the owner wants, without giving away anyone's credentials or private work.

## What has to be enabled first

1. **R2 bucket** — Cloudflare → R2 → *Enable* (one click; the free tier covers 10 GB and this is
   the difference between "saved" and "gone").
2. Then: `projects` table in Neon, a mirror-on-change hook for the workspace, and the three-door
   screen where the budget message currently is.
