# Keeping the free instance awake

The hosted link sleeps after ~15 minutes idle. The first request then takes **22–40 seconds**,
which reads as a broken site.

## What does NOT work

| Option | Why not |
|---|---|
| **GitHub Actions cron** | free-repo schedules are throttled: measured gaps of 4–8 hours against a `*/10` cron |
| **Paying GitHub** | Pro/Team does not guarantee cron timing either — schedules stay best-effort and 5-minute minimum |
| **Neon** | it is a Postgres host; keeping it warm does nothing for a Render web service |
| **Clerk** | identity only; no scheduler will keep the app process alive |

## What does work

| Option | Cost | Reliability |
|---|---|---|
| **Cloudflare Worker cron** (this folder) | free | every minute, genuinely reliable |
| **cron-job.org** | free | 1-minute HTTP pings |
| **UptimeRobot** | free | 5-minute checks, plus downtime alerts |
| **Render paid instance** | $7/mo | never sleeps — the only real fix |

## Deploy the Worker

1. dash.cloudflare.com → **Workers & Pages** → *Create* → *Worker*
2. paste `worker.js`, **Deploy**
3. **Settings → Trigger Events → Cron Triggers → Add** `*/5 * * * *`

288 pings/day against a free allowance of 100,000 requests.

## Caveat

A permanently warm instance uses the whole free **750 instance-hours/month**. One service is fine;
two would need this disabled or a paid plan.
