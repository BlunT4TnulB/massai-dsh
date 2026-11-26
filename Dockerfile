# Massai — hosted-link deployment.
#
# `dsh web` = `dsh --profile web`, which takes:
#   --host <ip>    one concrete IPv4/IPv6 literal (0.0.0.0 is rejected)
#   --port <port>  listen port (0 = OS-assigned)
# The container's own address is resolved with Node (slim images have no
# `hostname` binary).

FROM node:24-slim

# pnpm directly (corepack's download prompt fails in non-interactive builds)
RUN npm install -g pnpm@11.28.5

# Build tools for native postinstall scripts (node-pty via node-gyp)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole workspace (the pnpm workspace spans packages/apps/native/vendor/
# benchmarks/website/python/patches); .dockerignore excludes git + node_modules.
COPY . .

# Throwaway git repo: lefthook's postinstall needs one (harmless in the image)
RUN git init -q

RUN pnpm install --no-frozen-lockfile

# Client build environment (the build orchestrator normally computes these; the
# tsdown client config embeds them and skips packages without them).
ENV DSH_CLIENT_BUILD_PROFILE=official \
    DSH_CLIENT_TITLE=Massai \
    DSH_CLIENT_VERSION=0.2.2-rc.4 \
    DSH_CLIENT_COMMIT_HASH=0000000

# Build everything the web host serves, minus the native addon it does not need.
# Order is the orchestrator's: host libs (incl. Typert codegen) → client libs +
# bundles → web app. `build:lib:host` manages its own TypeScript heap sizes.
RUN pnpm run build:lib:host \
    && pnpm run build:lib:client \
    && pnpm run build:web

ENV DSH_ALLOW_WILDCARD_HOST=1
EXPOSE 10000

# Bind 0.0.0.0 for the hosted link (Render's port detection requires it).
# DSH rejects the wildcard address by default; DSH_ALLOW_WILDCARD_HOST opts in.
# Run the PRE-BUILT CLI (lib/bin.js), not `tsx apps/cli/src/bin.ts`: tsx compiles
# hundreds of plugins at boot, which exceeds Render's startup timeout.
# Port 10000 is hardcoded to match EXPOSE (Render's image-service port scan reads
# EXPOSE, not $PORT — the leftover $PORT=3080 was the mismatch).
# The workspace the hosted mind works in. When a repository and a token are
# configured, the container clones the project here at boot — so Massai has the
# whole codebase to read, change and push, and the clone refreshes on every deploy.
ENV MASSAA_WORKSPACE_DIR=/app/Massai
ENV MASSAA_PROJECTS_DIR=/app/Projects

RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    'if [ -n "${MASSAA_GIT_REPO:-}" ]; then' \
    '  DIR="${MASSAA_WORKSPACE_DIR:-/app/Massai}"' \
    '  echo "massai workspace: ${DIR} from ${MASSAA_GIT_REPO}"' \
    '  if [ -n "${MASSAA_GIT_PAT:-}" ]; then' \
    '    API="$(printf %s "${MASSAA_GIT_REPO}" | sed -e "s#https://github.com/#https://x-access-token:${MASSAA_GIT_PAT}@github.com/#")"' \
    '  else' \
    '    API="${MASSAA_GIT_REPO}"' \
    '  fi' \
    '  CLEAN="$(printf %s "${MASSAA_GIT_REPO}" | sed -e "s#https://[^@/]*@#https://#")"' \
    '  if [ -d "${DIR}/.git" ]; then' \
    '    git -C "${DIR}" remote set-url origin "${API}" || true' \
    '    git -C "${DIR}" fetch --depth 1 origin HEAD || true' \
    '    git -C "${DIR}" reset --hard FETCH_HEAD || true' \
    '  else' \
    '    mkdir -p "$(dirname "${DIR}")"' \
    '    git clone --depth 1 "${API}" "${DIR}" || echo "massai workspace: clone failed (non-fatal)"' \
    '  fi' \
    '  if [ -n "${CLEAN}" ]; then git -C "${DIR}" remote set-url origin "${CLEAN}" || true; fi' \
    '  echo "massai workspace: ready ($(git -C "${DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown))"' \
    'fi' \
    'PROJECTS_DIR="${MASSAA_PROJECTS_DIR:-/app/Projects}"' \
    'mkdir -p "${PROJECTS_DIR}"' \
    'if [ -n "${MASSAA_PROJECTS:-}" ]; then' \
    '  OLD_IFS="$IFS"; IFS=","' \
    '  for name in ${MASSAA_PROJECTS}; do' \
    '    IFS="$OLD_IFS"' \
    '    [ -n "${name}" ] || continue' \
    '    massai-clone "${name}" >/dev/null 2>&1 || echo "massai project: ${name} not cloned"' \
    '    IFS=","' \
    '  done' \
    '  IFS="$OLD_IFS"' \
    '  echo "massai projects: $(ls -1 "${PROJECTS_DIR}" | wc -l) folders in ${PROJECTS_DIR}"' \
    'fi' \
    'if [ "${MASSAA_SEED_WORKSPACES:-1}" != "0" ]; then' \
    '  node /usr/local/lib/massai-seed-workspaces.mjs || echo "massai: workspace seeding skipped"' \
    'fi' \
    'exec "$@"' \
    > /usr/local/bin/massai-boot \
    && chmod +x /usr/local/bin/massai-boot

# Clone one project on demand: massai-clone <name> [dir]
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    'name="${1:-}"' \
    '[ -n "${name}" ] || { echo "usage: massai-clone <repo-name>"; exit 2; }' \
    'DIR="${2:-${MASSAA_PROJECTS_DIR:-/app/Projects}/${name}}"' \
    'BASE="${MASSAA_GIT_OWNER:-BlunT4TnulB}"' \
    'if [ -n "${MASSAA_GIT_PAT:-}" ]; then' \
    '  API="https://x-access-token:${MASSAA_GIT_PAT}@github.com/${BASE}/${name}.git"' \
    'else' \
    '  API="https://github.com/${BASE}/${name}.git"' \
    'fi' \
    'mkdir -p "$(dirname "${DIR}")"' \
    'if [ -d "${DIR}/.git" ]; then' \
    '  git -C "${DIR}" remote set-url origin "${API}"' \
    '  git -C "${DIR}" fetch --depth 1 origin HEAD' \
    '  git -C "${DIR}" reset --hard FETCH_HEAD' \
    'else' \
    '  rmdir "${DIR}" 2>/dev/null || true' \
    '  git clone --depth 1 "${API}" "${DIR}"' \
    'fi' \
    '  git -C "${DIR}" remote set-url origin "https://github.com/${BASE}/${name}.git" || true' \
    'echo "${name}: $(git -C "${DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"' \
    > /usr/local/bin/massai-clone \
    && chmod +x /usr/local/bin/massai-clone

# Push deliberately: massai-push [repo-name]. The token is spent on this one command
# and is not written into any git config.
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    '[ -n "${MASSAA_GIT_PAT:-}" ] || { echo "massai-push: MASSAA_GIT_PAT is not set"; exit 2; }' \
    'BASE="${MASSAA_GIT_OWNER:-BlunT4TnulB}"' \
    'NAME="${1:-}"' \
    'if [ -n "${NAME}" ]; then' \
    '  DIR="${MASSAA_PROJECTS_DIR:-/app/Projects}/${NAME}"' \
    'else' \
    '  DIR="$(git rev-parse --show-toplevel)"' \
    '  NAME="$(basename "${DIR}")"' \
    'fi' \
    '[ -d "${DIR}/.git" ] || { echo "massai-push: ${DIR} is not a repository"; exit 2; }' \
    'BRANCH="$(git -C "${DIR}" rev-parse --abbrev-ref HEAD)"' \
    'if [ "${BRANCH}" = "HEAD" ]; then BRANCH=master; fi' \
    'git -C "${DIR}" push "https://x-access-token:${MASSAA_GIT_PAT}@github.com/${BASE}/${NAME}.git" "HEAD:${BRANCH}"' \
    > /usr/local/bin/massai-push \
    && chmod +x /usr/local/bin/massai-push

# Seed the workspace list from the folders on disk, so every project and the main
# checkout are already workspaces on first boot instead of one dialog at a time.
RUN mkdir -p /usr/local/lib && printf '%s\n' \
    'import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync } from "node:fs"' \
    'import { join } from "node:path"' \
    'import { homedir } from "node:os"' \
    'import { randomUUID } from "node:crypto"' \
    'const home = process.env.DSH_HOME ?? join(homedir(), ".dsh")' \
    'const dir = join(home, "storages")' \
    'const file = join(dir, "workspace.json")' \
    'mkdirSync(dir, { recursive: true })' \
    'let data = { unit: { name: "workspace", version: 2 }, global: { initialized: true, workspaceIds: [], archivedSessionIds: [], pinnedSessionIds: [] }, tables: { workspaces: {} } }' \
    'if (existsSync(file)) { try { data = JSON.parse(readFileSync(file, "utf8")) } catch { /* keep the fresh shape */ } }' \
    'data.global ??= { initialized: true, workspaceIds: [], archivedSessionIds: [], pinnedSessionIds: [] }' \
    'data.global.workspaceIds ??= []' \
    'data.tables ??= { workspaces: {} }' \
    'data.tables.workspaces ??= {}' \
    'const known = new Set(Object.values(data.tables.workspaces).map(w => w.path))' \
    'const candidates = []' \
    'const main = process.env.MASSAA_WORKSPACE_DIR ?? "/app/Massai"' \
    'if (existsSync(main)) candidates.push(main)' \
    'const projects = process.env.MASSAA_PROJECTS_DIR ?? "/app/Projects"' \
    'if (existsSync(projects)) for (const name of readdirSync(projects)) candidates.push(join(projects, name))' \
    'let added = 0' \
    'for (const path of candidates) { if (known.has(path)) continue' \
    '  const id = randomUUID(); const now = new Date().toISOString()' \
    '  data.tables.workspaces[id] = { path, title: path.split("/").filter(Boolean).pop() ?? path, sessionIds: [], createdAt: now, updatedAt: now }' \
    '  data.global.workspaceIds.push(id); known.add(path); added += 1 }' \
    'if (added > 0) { const tmp = file + ".tmp"; writeFileSync(tmp, JSON.stringify(data, null, 2)); renameSync(tmp, file) }' \
    'const projectKey = (cwd) => { let readable = ""; let run = false' \
    '  for (let i = 0; i < cwd.length; i += 1) { const ch = cwd[i]' \
    '    if (ch === "/" || ch === "\\\\" || ch === ":") { if (!run) readable += "-"; run = true }' \
    '    else if (/^[A-Za-z0-9._-]$/.test(ch)) { readable += ch; run = false }' \
    '    else { readable += "~" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"); run = false } }' \
    '  return "--" + (readable.replace(/^-+/, "") || "root").slice(0, 251) + "--" }' \
    'const sessionsRoot = join(home, "sessions")' \
    'let attached = 0' \
    'if (existsSync(sessionsRoot)) { const byProject = new Map()' \
    '  for (const project of readdirSync(sessionsRoot)) { try { byProject.set(project, readdirSync(join(sessionsRoot, project))) } catch { /* skip */ } }' \
    '  for (const workspace of Object.values(data.tables.workspaces)) {' \
    '    const ids = byProject.get(projectKey(workspace.path)) ?? []' \
    '    workspace.sessionIds ??= []' \
    '    for (const id of ids) { if (!workspace.sessionIds.includes(id)) { workspace.sessionIds.push(id); attached += 1 } }' \
    '    if (ids.length > 0) workspace.updatedAt = new Date().toISOString() } }' \
    'if (attached > 0) { const tmp = file + ".tmp"; writeFileSync(tmp, JSON.stringify(data, null, 2)); renameSync(tmp, file) }' \
    'console.log(`massai workspaces: ${added} added, ${attached} sessions attached, ${Object.keys(data.tables.workspaces).length} total`)' \
    > /usr/local/lib/massai-seed-workspaces.mjs

ENTRYPOINT ["/usr/local/bin/massai-boot"]
CMD ["sh", "-c", "echo massai booting on 10000 && exec node apps/cli/lib/bin.js web --no-open --host 0.0.0.0 --port 10000"]
