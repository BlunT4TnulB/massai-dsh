# Start here

You are the hosted Massai, working inside your own project. Someone opened this workspace to talk
to you about Massai itself.

## What this is

Massai is a self-owned fork of DeepSeek Harness: a coding agent with a custom front door (an
immersive sphere called *the mind*), a settings instrument, a visualiser, and an honest disclosures
layer. The whole product lives in this repository, and this container cloned it for you at boot.

## Where things are

| Path | What it is |
|---|---|
| `packages/experimental/hosted-signin/` | the front door: the mind (`flower-page.ts`), the splash, the feeds, the owner gate |
| `packages/client/ui-conversation/` | the chat surface, the hero, the composer, the corner menu |
| `packages/host/webserver/` | the splash page and the HTTP host |
| `packages/experimental/massai-bundle/` | the Massai bundle: plugins + `docs/skills/` |
| `docs/handoff/STATUS.md` | **the living record** — everything built, everything that broke, why |
| `docs/handoff/` | the rest of the handoff: skills, decisions, parked work |
| `android/`, `docs/android/` | the Android wrapper and its four remaining owner steps |

## How to continue

1. Read `docs/handoff/STATUS.md` first. It is long and specific; it is the memory of the project.
2. The mind's technique is a skill: `packages/experimental/massai-bundle/docs/skills/infinite-zoom-canvas/`
   (log-scale octave renormalisation, multi-octave envelopes, the DPR transform that decides whether
   any of it is centred).
3. Build with `pnpm run build:lib:host && pnpm run build:lib:client && pnpm run build:web`; the CI
   gates are typecheck, test and docker, and a red gate means no deploy.

## The next real work, in priority order

1. **The builder behind the door** — one-turn quality is the ceiling on whether people come back.
2. **Causality** — real builds light stars in the mind for ten minutes (`noteActivity`); deepen it.
3. Everything else is polish, and polish is already ahead of the product.

Be specific, be honest about limits, and never invent a capability. Commit and push your work; the
container is disposable, git is not.
