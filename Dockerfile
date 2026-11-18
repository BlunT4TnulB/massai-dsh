# Massai — hosted-link deployment (Phase 5 foundation)
#
# Runs the DSH web surface from source (tsx), matching the repo's `start:web`
# script. NOTE: the web-server port is passed via $PORT (default 3080); verify
# it on first deploy and adjust EXPOSE/health-check accordingly.

FROM node:24-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.host.json tsconfig.client.json ./
COPY vendor ./vendor
COPY packages ./packages
COPY apps ./apps
COPY native ./native
COPY scripts ./scripts

RUN corepack pnpm install --frozen-lockfile

ENV PORT=3080
EXPOSE 3080

CMD ["node", "--import", "tsx/esm", "apps/cli/src/bin.ts", "web"]
