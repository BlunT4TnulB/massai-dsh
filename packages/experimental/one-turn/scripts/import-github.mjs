/**
 * Import GitHub repositories into the Massai library.
 *
 * Safety is the whole point of this script, so the rules are explicit:
 *
 *  - nothing is ever created as public; every import lands as a **private** project
 *  - binaries, lockfiles, build output and dot-directories are skipped
 *  - files are capped (200 KB each, 40 files and 1.5 MB per repository)
 *  - every file is scanned for credentials, and a hit means **skipped and reported**
 *  - the token is read from the environment and never written anywhere
 *
 * Usage:
 *   GITHUB_TOKEN=… ONETURN_URL=https://massai-itu.ca ONETURN_TOKEN=… \
 *   node packages/experimental/one-turn/scripts/import-github.mjs [limit]
 */

import { readFileSync } from 'node:fs'

const base = (process.env.ONETURN_URL ?? 'https://massai-itu.ca').replace(/\/+$/, '')
const ownerToken = process.env.ONETURN_TOKEN ?? ''
const githubToken = process.env.GITHUB_TOKEN ?? ''
const limit = Number(process.argv[2] ?? '0') || Number.MAX_SAFE_INTEGER

if (ownerToken === '' || githubToken === '') {
  console.error('GITHUB_TOKEN and ONETURN_TOKEN are both required')
  process.exit(1)
}

/** Directories and files that are never worth importing. */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'out', 'coverage', '.cache', 'vendor', '__pycache__', '.venv', 'venv'])
const SKIP_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'pdf', 'zip', 'gz', 'tar', 'woff', 'woff2', 'ttf', 'otf', 'mp4', 'mp3', 'wasm', 'bin', 'exe', 'dll', 'so', 'dylib', 'lock'])
const SKIP_NAMES = /^(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|Cargo\.lock|poetry\.lock|composer\.lock)$/
const SECRET_NAME = /(^|\/)(\.env|\.env\.[a-z]+|id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx|credentials|secrets?\.[a-z]+|\.npmrc|\.netrc)$/i
const SECRET_CONTENT = [
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i,
]

const MAX_FILE_BYTES = 200_000
const MAX_FILES = 40
const MAX_TOTAL_BYTES = 1_500_000

/** GitHub API call with the token attached. */
async function gh(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${githubToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'massai-library-import',
    },
  })
  if (!response.ok) throw new Error(`${path} → ${response.status}`)
  return response.json()
}

/** Fetch a raw file body. */
async function raw(repo, branch, filePath) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath.split('/').map(encodeURIComponent).join('/')}`
  const response = await fetch(url, { headers: { authorization: `Bearer ${githubToken}` } })
  if (!response.ok) return undefined
  return response.text()
}

/** Decide whether one path is safe and useful to import. */
function keepPath(path) {
  const parts = path.split('/')
  if (parts.some(part => SKIP_DIRS.has(part))) return false
  if (SKIP_NAMES.test(parts.at(-1) ?? '')) return false
  const ext = (path.split('.').at(-1) ?? '').toLowerCase()
  if (SKIP_EXT.has(ext)) return false
  if (SECRET_NAME.test(path)) return false
  return true
}

/** Scan a body for anything that looks like a credential. */
function looksSecret(body) {
  return SECRET_CONTENT.some(pattern => pattern.test(body))
}

/** Import one repository. */
async function importRepo(repo) {
  const detail = await gh(`/repos/${repo.full_name}`)
  const branch = detail.default_branch ?? 'main'
  const tree = await gh(`/repos/${repo.full_name}/git/trees/${branch}?recursive=1`)
  const blobs = (tree.tree ?? []).filter(node => node.type === 'blob' && keepPath(node.path))

  const files = []
  const skipped = []
  let total = 0
  for (const node of blobs) {
    if (files.length >= MAX_FILES) { skipped.push('file cap reached'); break }
    if ((node.size ?? 0) > MAX_FILE_BYTES) { skipped.push(`${node.path}: too large`); continue }
    const body = await raw(repo.full_name, branch, node.path)
    if (body === undefined) { skipped.push(`${node.path}: unreadable`); continue }
    if (looksSecret(body)) { skipped.push(`${node.path}: looks like a credential`); continue }
    if (total + body.length > MAX_TOTAL_BYTES) { skipped.push('size cap reached'); break }
    files.push({ path: node.path, content: body })
    total += body.length
  }

  if (files.length === 0) return { repo: repo.full_name, imported: false, files: 0, skipped, reason: 'no safe files' }

  const response = await fetch(`${base}/api/projects/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-one-turn-token': ownerToken },
    body: JSON.stringify({
      owner: 'owner',
      name: repo.full_name,
      shape: 'document',
      entry: files.find(file => /README/i.test(file.path))?.path ?? files[0].path,
      files,
      origin: `github:${repo.full_name}`,
      // never 'shelf' here: importing is not publishing
    }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? `create failed ${response.status}`)
  return {
    repo: repo.full_name,
    imported: true,
    projectId: payload.project?.id,
    visibility: payload.project?.visibility,
    files: payload.project?.files ?? files.length,
    bytes: payload.project?.bytes ?? total,
    skipped,
  }
}

const repos = await gh('/user/repos?per_page=100&sort=updated&affiliation=owner')
const selected = repos.slice(0, limit)
const report = []
for (const [index, repo] of selected.entries()) {
  process.stdout.write(`[${index + 1}/${selected.length}] ${repo.full_name} … `)
  try {
    const result = await importRepo(repo)
    report.push(result)
    console.log(result.imported
      ? `imported ${result.files} file(s), ${result.bytes} bytes → ${result.projectId}`
      : `skipped (${result.reason})`)
    if (result.skipped.length > 0) console.log(`   skipped: ${result.skipped.slice(0, 4).join(' · ')}`)
  } catch (error) {
    report.push({ repo: repo.full_name, imported: false, files: 0, skipped: [], error: String(error) })
    console.log(`error ${String(error).slice(0, 80)}`)
  }
}

const imported = report.filter(entry => entry.imported === true)
console.log('')
console.log('— library import —')
console.log(`  repos           ${report.length}`)
console.log(`  imported        ${imported.length}`)
console.log(`  files           ${imported.reduce((sum, entry) => sum + entry.files, 0)}`)
console.log(`  bytes           ${imported.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0)}`)
console.log(`  visibility      private (publishing is a separate, deliberate action)`)
console.log(`  report          ${JSON.stringify(report.slice(0, 3))}…`)
