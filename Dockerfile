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

# Build the client modules + web frontend (`dsh web` serves prebuilt client bundles).
# Targeted build — not the full `pnpm run build`, which also wants the Rust toolchain.
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm run build:lib:client && pnpm run build:web

ENV PORT=3080
EXPOSE 3080

# Resolve the container's first non-internal IPv4 with Node, then boot the web app.
# Shell-form CMD (not exec-form): Render's docker runtime mishandles exec-form arrays.
CMD exec node --import tsx/esm apps/cli/src/bin.ts web --host "$(node -e 'const n=require("os").networkInterfaces();const c=Object.values(n).flat().find(x=>x.family==="IPv4"&&!x.internal);process.stdout.write(c?c.address:"127.0.0.1")')" --port "${PORT:-3080}"
