/**
 * Run the golden set against a live deployment and write a scorecard.
 *
 * This is the measuring instrument, not the product: it calls the deployed
 * `/api/one-turn/run` once per task, collects the trial records, and reports the
 * numbers the mask is judged by. It is deliberately a script rather than a route
 * so the baseline can be re-run from a laptop without redeploying anything.
 *
 * Usage:
 *   ONETURN_URL=https://massai-itu.ca \
 *   ONETURN_TOKEN=<owner token> \
 *   node packages/experimental/one-turn/scripts/run-golden.mjs [limit]
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const base = (process.env.ONETURN_URL ?? 'https://massai-itu.ca').replace(/\/+$/, '')
const token = process.env.ONETURN_TOKEN ?? ''
const limit = Number(process.argv[2] ?? '0') || Number.MAX_SAFE_INTEGER

if (token === '') {
  console.error('ONETURN_TOKEN is required')
  process.exit(1)
}

const tasks = JSON.parse(await readFile(join(root, 'golden', 'tasks.json'), 'utf8'))
const selected = tasks.slice(0, limit)

/** Post one task and return the trial record. */
async function runOne(task) {
  const body = {
    id: `golden-${task.id}-${Date.now()}`,
    goal: task.goal,
    shape: task.shape,
    details: task.details ?? [],
    mustHave: task.mustHave ?? [],
    neverInvent: task.neverInvent ?? [],
    ...(task.audience === undefined ? {} : { audience: task.audience }),
    name: task.id,
  }
  const response = await fetch(`${base}/api/one-turn/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-one-turn-token': token },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (task.expectRefusal === true) {
    return {
      task: task.id, refused: response.status === 422, status: response.status,
      accepted: false, costUsd: payload.spentUsd ?? 0, checks: [],
      detail: payload.refusal?.reason ?? payload.error ?? '',
    }
  }
  const trial = payload.trial ?? {}
  return {
    task: task.id,
    shape: trial.shape ?? task.shape,
    accepted: trial.accepted === true,
    costUsd: trial.costUsd ?? 0,
    checks: (trial.checks ?? []).map(check => ({ check: check.check, pass: check.pass, detail: check.detail })),
    error: trial.error,
    savedProjectId: payload.savedProject?.id,
  }
}

const results = []
for (const [index, task] of selected.entries()) {
  process.stdout.write(`[${index + 1}/${selected.length}] ${task.id} … `)
  try {
    const result = await runOne(task)
    results.push(result)
    const verdict = result.refused === true ? 'refused correctly' : result.accepted ? 'ACCEPTED' : 'failed'
    console.log(`${verdict}  $${(result.costUsd ?? 0).toFixed(4)}`)
  } catch (error) {
    results.push({ task: task.id, accepted: false, costUsd: 0, error: String(error) })
    console.log(`error ${String(error).slice(0, 60)}`)
  }
}

const graded = results.filter(result => result.refused === undefined)
const refusals = results.filter(result => result.refused !== undefined)
const accepted = graded.filter(result => result.accepted).length
const spent = results.reduce((sum, result) => sum + (result.costUsd ?? 0), 0)
const failuresByCheck = new Map()
for (const result of graded) {
  for (const check of result.checks ?? []) {
    if (check.pass) continue
    failuresByCheck.set(check.check, (failuresByCheck.get(check.check) ?? 0) + 1)
  }
}

const scorecard = {
  at: new Date().toISOString(),
  base,
  tasks: results.length,
  accepted,
  graded: graded.length,
  oneTurnRate: graded.length === 0 ? 0 : Number((accepted / graded.length).toFixed(3)),
  refusalsCorrect: refusals.filter(result => result.refused === true).length,
  spentUsd: Number(spent.toFixed(4)),
  costPerAccepted: accepted === 0 ? 0 : Number((spent / accepted).toFixed(4)),
  failuresByCheck: Object.fromEntries([...failuresByCheck.entries()].sort((a, b) => b[1] - a[1])),
  results,
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(root, 'golden', `results-${stamp}.json`)
await writeFile(out, JSON.stringify(scorecard, null, 2), 'utf8')

console.log('')
console.log('— scorecard —')
console.log(`  tasks            ${scorecard.tasks}`)
console.log(`  accepted         ${scorecard.accepted} / ${scorecard.graded} graded  (${(scorecard.oneTurnRate * 100).toFixed(0)}% one-turn)`)
console.log(`  refusals         ${scorecard.refusalsCorrect} / ${refusals.length} correct`)
console.log(`  spent            $${scorecard.spentUsd.toFixed(4)}`)
console.log(`  cost per build   $${scorecard.costPerAccepted.toFixed(4)}`)
console.log(`  worst checks     ${JSON.stringify(scorecard.failuresByCheck)}`)
console.log(`  written          ${out}`)
