# Handoff

Everything a future session needs that is not in the code.

- [`STATUS.md`](STATUS.md) — the living record: what was built, what broke, why each decision was
  made, and what is deliberately parked. Read this first.
- `../../packages/experimental/massai-bundle/docs/skills/` — the techniques worth keeping
  (`infinite-zoom-canvas` in particular: log-scale octave renormalisation, multi-octave envelopes,
  the DPR transform that decides whether any of it is centred).
- `../../packages/experimental/massai-mind` — not present here; the Android wrapper lives in its own
  repository, `BlunT4TnulB/massai-mind`, and is parked with its four remaining steps written down.

## On the hosted instance

The container clones this repository to `MASSAA_WORKSPACE_DIR` (default `/app/Massai`) at boot when
`MASSAA_GIT_REPO` is set, so the mind works with the whole project in front of it. The clone refreshes
on every deploy; git — not the container filesystem — is what persists.
