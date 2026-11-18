# Massai — hosted-link deployment.
#
# `dsh web` = `dsh --profile web`, which takes:
#   --host <ip>    one concrete IPv4/IPv6 literal (0.0.0.0 is rejected)
#   --port <port>  listen port (0 = OS-assigned)
# We bind the container's own address (`hostname -i`) and $PORT.

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

ENV PORT=3080
EXPOSE 3080

CMD ["sh", "-c", 'exec node --import tsx/esm apps/cli/src/bin.ts web --host "$(hostname -i)" --port "${PORT:-3080}"']
