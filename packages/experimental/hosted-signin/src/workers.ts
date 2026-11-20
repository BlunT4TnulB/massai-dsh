/**
 * Local-agent worker registry (phase 1: presence and health).
 *
 * A machine running a local model POSTs a heartbeat here every minute. The hub
 * keeps the last known state per machine and shows it to the owner, so "which of
 * my computers is online, what model does it have, how fast is it" stops being a
 * guessing game. Routing work *to* a worker is phase 2 and needs a tunnel; this
 * deliberately does not pretend otherwise.
 *
 * Authentication: every heartbeat must present the shared worker token from
 * `DSH_WORKER_TOKEN`. Without it the endpoint answers 404 (not 401) so a scanner
 * cannot even confirm the route exists.
 *
 * @module @deepseek-ai/dsh-hosted-signin/workers
 */

/** One machine's last report. */
export interface WorkerStatus {
  /** Human name for the machine. */
  name: string
  /** Local model id it serves. */
  model: string
  /** Where its gateway listens, as the machine sees itself. */
  endpoint: string
  /** Last measured reply latency in milliseconds, when the worker measured one. */
  latencyMs?: number
  /** Free-form note (OS, cpu, whatever the worker wants recorded). */
  note?: string
  /** Last heartbeat (ms since epoch). */
  seenAt: number
  /** Number of prompts it has answered since start, when reported. */
  served?: number
}

/** How long a worker is considered online without a fresh heartbeat. */
const STALE_MS = 5 * 60 * 1000

/** Registered workers, keyed by machine name. */
const workers = new Map<string, WorkerStatus>()

/**
 * Record or refresh one worker's state.
 * @param report - the machine's report.
 * @returns the stored status.
 */
export function recordWorker(report: Omit<WorkerStatus, 'seenAt'>): WorkerStatus {
  const status: WorkerStatus = { ...report, seenAt: Date.now() }
  workers.set(report.name, status)
  return status
}

/**
 * Every known worker, newest heartbeat first, with liveness resolved.
 * @returns workers and whether each is currently online.
 */
export function listWorkers(): Array<WorkerStatus & { online: boolean }> {
  const now = Date.now()
  return [...workers.values()]
    .map(worker => ({ ...worker, online: now - worker.seenAt < STALE_MS }))
    .sort((a, b) => b.seenAt - a.seenAt)
}

/**
 * Whether a presented token matches the configured worker token.
 * @param presented - token from the request.
 * @returns true when worker heartbeats are configured and the token matches.
 */
export function workerTokenAccepted(presented: string | undefined): boolean {
  const expected = process.env.DSH_WORKER_TOKEN
  if (expected === undefined || expected === '') return false
  return presented !== undefined && presented === expected
}

/**
 * Render the owner's view of every registered machine.
 * @returns the page HTML.
 */
export function workersPageHtml(): string {
  const list = listWorkers()
  const configured = (process.env.DSH_WORKER_TOKEN ?? '') !== ''
  const rows = list.map((worker) => {
    const age = Math.round((Date.now() - worker.seenAt) / 1000)
    const tone = worker.online ? '#7ee2a8' : '#f0b46a'
    const latency = worker.latencyMs === undefined ? '—' : `${String(Math.round(worker.latencyMs / 100) / 10)}s`
    return `<tr>
      <td><span style="color:${tone}">●</span> ${escapeText(worker.name)}</td>
      <td class="mono">${escapeText(worker.model)}</td>
      <td class="mono">${escapeText(worker.endpoint)}</td>
      <td>${latency}</td>
      <td>${age < 90 ? `${String(age)}s ago` : `${String(Math.round(age / 60))}m ago`}</td>
      <td class="muted">${escapeText(worker.note ?? '')}</td>
    </tr>`
  }).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massai — local agents</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="theme-color" content="#151517">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 3rem;background:#0e0e10;color:#F2F2F4;
    font-family:system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(60rem 40rem at 15% 0%,rgba(193,68,14,.13),transparent 70%)}
  main{max-width:56rem;margin:0 auto}
  header{display:flex;align-items:center;gap:.6rem;margin-bottom:1.3rem}
  h1{margin:0;font-size:1.1rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700}
  .flag{margin-left:auto;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#D9822B;font-weight:600}
  section{border:1px solid #2a2a31;border-radius:.8rem;background:#17171c;padding:1.1rem 1.2rem;margin-bottom:1rem}
  h2{margin:0 0 .8rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#8a8a93;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:.84rem}
  th{text-align:left;color:#82828b;font-weight:600;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;padding:.35rem .4rem;border-bottom:1px solid #26262d}
  td{padding:.4rem;border-bottom:1px solid #1f1f26;color:#d6d6de}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem}
  .muted{color:#7d7d86}
  .note{margin:.7rem 0 0;font-size:.78rem;color:#6f6f78;line-height:1.6}
  code{background:#0d0d11;border:1px solid #26262d;padding:.35rem .5rem;border-radius:.4rem;font-size:.78rem;
    color:#d8d8e0;overflow-wrap:anywhere;display:inline-block}
  .howto{margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:.55rem;font-size:.86rem;color:#c2c2cb}
  .var{color:#D9822B}
  a{color:#7ee2a8;text-decoration:none}
</style></head><body><main>
<header><h1>Local agents</h1><span class="flag">open by default</span></header>
<section><h2>Machines reporting in</h2>
  ${configured ? '' : '<p class="note" style="color:#f0b46a;margin-top:0">Worker heartbeats are not configured: set <code>DSH_WORKER_TOKEN</code> on this service and on each machine.</p>'}
  <table><thead><tr><th>machine</th><th>model</th><th>endpoint</th><th>latency</th><th>last seen</th><th>note</th></tr></thead>
  <tbody>${rows === '' ? '<tr><td colspan="6" class="muted">No machines have reported yet.</td></tr>' : rows}</tbody></table>
  <p class="note">A machine is online while its heartbeat is younger than 5 minutes.
  On each computer run <code>./tools/massai-worker.sh</code> — it reports the local
  model, its speed, and stays out of the way.</p>
</section>
<section><h2>Add a machine</h2>
  <p class="note" style="margin-top:0">On the computer that runs the local model, run these two commands.
  The first makes the model answer; the second makes this page show it.</p>
  <ol class="howto">
    <li><code>./tools/massai-local.sh</code> <span class="muted">— install and verify a local model</span></li>
    <li><code>./tools/massai-worker.sh --hub <span class="var">&lt;this site's address&gt;</span> --token <span class="var">&lt;DSH_WORKER_TOKEN&gt;</span> --name <span class="var">&lt;a name you'll recognise&gt;</span></code></li>
  </ol>
  <p class="note">The token is the value of <code>DSH_WORKER_TOKEN</code> set on this service.
  Nothing about your prompts, files, or conversations is sent — only the machine name, model, address, and measured speed.</p>
</section>
<section><h2>What this is, and is not</h2>
  <p class="note">Phase 1 is presence: which machines are alive, with what model, and how fast.
  Routing work <em>to</em> those machines is phase 2 and needs a tunnel out of each
  machine's network — it is not claimed here.</p>
  <p class="note"><a href="/admin">Back to the owner console →</a></p>
</section>
</main></body></html>`
}

/**
 * Escape one user-supplied string for HTML text.
 * @param value - raw text.
 * @returns escaped text.
 */
function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
