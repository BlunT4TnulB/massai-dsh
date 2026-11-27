---
title: Massai
emoji: 🌀
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: An owned AI coder with a mind you can fall into
---

# Massai

The hosted Massai, running on a free Hugging Face Space: the same image CI builds and deploys, pulled
by tag rather than rebuilt here.

- **The mind** — /flower and /mind
- **The door** — / (riddles, gestures, no door shown)
- **The workshop** — /access when signed in
- **The operator** — /access → "I am the operator" → `DSH_WEB_TOKEN`

## Notes for whoever maintains this Space

- The base image tag is pinned to a commit. Bump it when CI publishes a new one.
- Repository cloning is **off** here (`MASSAA_GIT_REPO` unset): a Space wakes from sleep faster without a
  git fetch, and its disk is ephemeral anyway.
- Secrets belong in *Settings → Variables and secrets*, never in this file.
- `DEEPSEEK_API_KEY` and `DSH_WEB_TOKEN` are the minimum for a working instance; `DATABASE_URL` enables
  budgets, the spend ledger and workspaces.
