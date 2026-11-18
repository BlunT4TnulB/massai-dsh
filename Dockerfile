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

# Build the client modules + web frontend (`dsh web` serves prebuilt client bundles).
# Order matters: Typert codegen → client compile → client bundles → web app.
RUN node --import tsx/esm scripts/generate-typert.ts \
    && NODE_OPTIONS=--max-old-space-size=4096 pnpm run build:lib:client \
    && pnpm run build:web

ENV PORT=3080
EXPOSE 3080

# Resolve the container's first non-internal IPv4 with Node, then boot the web app.
# Shell-form CMD (not exec-form): Render's docker runtime mishandles exec-form arrays.
CMD exec node --import tsx/esm apps/cli/src/bin.ts web --host "$(node -e 'const n=require("os").networkInterfaces();const c=Object.values(n).flat().find(x=>x.family==="IPv4"&&!x.internal);process.stdout.write(c?c.address:"127.0.0.1")')" --port "${PORT:-3080}"
