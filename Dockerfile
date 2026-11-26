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
    '  if [ -d "${DIR}/.git" ]; then' \
    '    git -C "${DIR}" remote set-url origin "${API}" || true' \
    '    git -C "${DIR}" fetch --depth 1 origin HEAD || true' \
    '    git -C "${DIR}" reset --hard FETCH_HEAD || true' \
    '  else' \
    '    mkdir -p "$(dirname "${DIR}")"' \
    '    git clone --depth 1 "${API}" "${DIR}" || echo "massai workspace: clone failed (non-fatal)"' \
    '    git -C "${DIR}" remote set-url origin "${API}" || true' \
    '  fi' \
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
    'echo "${name}: $(git -C "${DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"' \
    > /usr/local/bin/massai-clone \
    && chmod +x /usr/local/bin/massai-clone

ENTRYPOINT ["/usr/local/bin/massai-boot"]
CMD ["sh", "-c", "echo massai booting on 10000 && exec node apps/cli/lib/bin.js web --no-open --host 0.0.0.0 --port 10000"]
