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

ENV PORT=3080 \
    DSH_ALLOW_WILDCARD_HOST=1
EXPOSE 3080

# Bind 0.0.0.0 for the hosted link (Render's port detection requires it).
# DSH rejects the wildcard address by default; DSH_ALLOW_WILDCARD_HOST opts in.
# Run the PRE-BUILT CLI (lib/bin.js), not `tsx apps/cli/src/bin.ts`: tsx compiles
# hundreds of plugins at boot, which exceeds Render's startup timeout.
CMD echo "massai booting on ${PORT:-10000}" && exec node apps/cli/lib/bin.js web --no-open --host 0.0.0.0 --port "${PORT:-10000}"
