# Massai — hosted-link deployment (Phase 5 foundation)
#
# TODO(finalize after `dsh web --help`): DSH's webserver takes an explicit
# --host (0.0.0.0 is rejected) and --port; wire them below once the exact flags
# are confirmed from the CI "Dump web server flags" step.

FROM node:24-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.host.json tsconfig.client.json ./
COPY vendor ./vendor
COPY packages ./packages
COPY apps ./apps
COPY native ./native
COPY scripts ./scripts

RUN corepack pnpm install --no-frozen-lockfile

# Placeholder: finalize with `--host "$(hostname -i)" --port "$PORT"`.
ENV PORT=3080
EXPOSE 3080

CMD ["node", "--import", "tsx/esm", "apps/cli/src/bin.ts", "web"]
