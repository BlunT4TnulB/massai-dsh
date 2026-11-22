/**
 * Massai keep-alive — a Cloudflare Worker on a cron trigger.
 *
 * Why not GitHub Actions: scheduled workflows on free repos are throttled hard
 * (measured gaps of 4–8 hours against a 10-minute cron), so the free Render
 * instance slept anyway and the first visitor waited ~22–40 s.
 *
 * Cloudflare Workers' free plan runs cron triggers reliably every minute.
 *
 * Deploy (once, free):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker
 *   2. paste this file, Deploy
 *   3. Settings → Trigger Events → Cron Triggers → Add: `*/5 * * * *`
 *
 * That is 288 pings a day against a free allowance of 100,000 requests.
 */

const TARGET = 'https://massai-dsh.onrender.com/healthz'

export default {
  /** @param {ScheduledController} controller */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      // Two attempts: a cold instance can exceed a single request's patience.
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const started = Date.now()
        try {
          const response = await fetch(TARGET, { cf: { cacheTtl: 0 } })
          console.log(`ping ${attempt}: ${response.status} in ${Date.now() - started}ms`)
          if (response.ok) return
        } catch (error) {
          console.log(`ping ${attempt} failed: ${String(error)}`)
        }
      }
      console.error('keep-alive: the service did not answer twice')
    })())
  },

  /** Manual hit in a browser: https://<worker>.workers.dev */
  async fetch() {
    const response = await fetch(TARGET)
    return new Response(`keep-alive ${response.status}\n`, { status: 200 })
  },
}
