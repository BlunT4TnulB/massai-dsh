# Accounts, keys and what expires

Every credential this project depends on, whether it dies on its own, what breaks when it does,
and which free accounts are worth adding before they become a wall.

Rule for every account: display name **Massai**, one project per provider named `massai`, owner
mailbox the same as GitHub. If a key ever leaks, "which account is it" must be answerable in one look.

## What we hold today

| Credential | Issuer | Expires on its own? | What breaks if it does | Action |
|---|---|---|---|---|
| `MASSACOT`, `GITHUB_PAT` | GitHub fine-grained PAT | **yes, if an expiry was set** | CI's lockfile commit, the mirror job, `tools/massai-deploy.sh` | set **no expiration**, scope: this repo only (contents + workflows) |
| `RENDER_API_KEY` (`rnd_`) | Render | optional expiry at creation | every pinned deploy | create with **no expiry**, keep scope to one service |
| `CLOUDFLARE_API_TOKEN` (`cfat_`) | Cloudflare | optional TTL | keep-alive Worker deploys | set **forever**, scope: Workers Scripts only |
| `CLOUDFLARE_USER_TOKEN` (`cfut_`) | Cloudflare | — | nothing: it cannot reach the account | **revoke** (it was only ever a dead end) |
| `NEON_API_KEY` (`napi_`) | Neon | no | creating projects / fetching URIs | keep; rotate if pasted anywhere |
| `NEON_DATABASE_URL` | Neon | no (password can rotate) | the ledger, attribution | rotate the password if ever exposed, then update Render |
| `DEEPSEEK_API_KEY` | DeepSeek | no — the **balance** runs out instead | the preview and the router | label the key "Massai", keep a small balance, set an alert |
| `GEMINI_API_KEY` | Google AI Studio | no | the Gemini provider | label "Massai"; free tier quotas are the real limit |
| `GROQ_API_KEY` | Groq | no | the Groq provider | label "Massai" |
| `CLERK_*` | Clerk | **test instance** | sign-in; test instances are for development | move to a production instance once a domain exists |
| `DSH_WORKER_TOKEN` | ours | no | local-agent relay | rotate when sharing |

## Walls we have not hit yet

| Wall | Why it matters | Free option |
|---|---|---|
| **Container registry storage** | GHCR gives 500 MB free for *private* packages; our image is large. Make the package **public** — public container images are free. | GitHub settings → Packages → massai → visibility public |
| **A real domain** | Clerk production needs one; email needs one; a link people trust needs one. Also the only way to put Cloudflare's proxy in front. | Cloudflare Registrar (at cost, ~$10-15/yr) — the one thing worth paying for |
| **Cloudflare proxy + WAF** | rate limiting and DDoS protection in front of Render, without a line of code | free plan, once a domain exists |
| **Object storage** | Render's disk is ephemeral: user artifacts and backups vanish on deploy | **Cloudflare R2**, 10 GB free, no egress fees |
| **Email** | password resets, receipts, "your build finished" | **Resend** free 3k/mo (needs a domain), or Cloudflare Email Routing for forwarding |
| **Error tracking** | right now a runtime exception is invisible unless a page renders wrong | **Sentry** free tier |
| **Uptime alerting** | the keep-alive stops sleeping; nobody tells *you* if the site is down | **UptimeRobot** free, 5-minute checks with email alerts |
| **Analytics** | knowing whether anyone came back | **Cloudflare Web Analytics** — free, cookieless |
| **Discoverability** | no index, no sitemap, no robots.txt | Google Search Console + a static sitemap |
| **Donations** | "a couple of coffees" should be one click, no business entity | **Ko-fi** or **Buy Me a Coffee** |
| **Payments** | a paid tier needs a business/bank account | Stripe — defer until it is real |
| **Backups** | Neon free has limited point-in-time recovery | nightly `pg_dump` to R2 from a Worker cron |
| **Legal pages** | privacy, terms, data deletion — needed before strangers arrive | plain pages in the app |
| **Render instance hours** | the keep-alive spends the whole 750 h/month allowance; a second service needs a paid plan | one service only, or $7/mo |

## Order I would do them in

1. **Revoke the two Cloudflare tokens** you pasted into chat, and recreate one clean account token
   with no expiry and Workers-only scope.
2. **Make the container package public** (free, removes a storage wall that would arrive silently).
3. **A domain** — the single unlock: Clerk production, email, Cloudflare proxy/WAF, a link that looks real.
4. **UptimeRobot + Sentry** — you cannot fix what you cannot see.
5. **R2 + a nightly backup** — so the ledger and memory cannot be lost.
6. **Ko-fi** — accept the coffee before someone offers it.
7. **Resend, Cloudflare Web Analytics, Search Console** — as users actually arrive.
