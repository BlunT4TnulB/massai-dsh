# Massai Local — a free AI that runs on your own computer

This is the "easy mode" for having an agent that works **without the cloud**.

No account. No credit card. No per-word bill. The model runs on your machine, so
once it is installed your everyday building costs **nothing** — and it keeps
working with the internet off.

When a job is genuinely too big for the small model, the gateway it installs can
hand that job to DeepSeek instead, so you still get the strong model when you
need it.

---

## The one command

```bash
./tools/massai-local.sh
```

It will:

1. **Check your machine** and tell you what is already there.
2. **Ask before changing anything** — nothing happens until you say yes.
3. Install **Ollama** (the program that runs AI models locally).
4. Download a small model — `qwen2.5-coder:7b` by default, or `3b` on lighter
   machines with `./tools/massai-local.sh --small`.
5. Start a small **gateway** that prefers the local model and falls back to
   DeepSeek only when it needs to.
6. **Test the whole chain with a real prompt** and only say "done" when an
   answer actually comes back.

Then:

```bash
./tools/massai-local.sh --wire-dsh   # adds "Massai Local (free)" to the agent
```

## Prefer clicking to typing?

The same instructions live on the site, with a button per kind of machine
(macOS / Windows / Linux / Android) and a copy button on every command:
**`/local`** on the Massai address. Each step ends with a one-line check — if it
prints a reply containing "ready", the model is on the machine and working.

## Show the machine up inside Massai

```bash
./tools/massai-worker.sh --hub https://massai-dsh.onrender.com \
  --token <DSH_WORKER_TOKEN> --name workshop-pc
```

The machine then appears on the hub's **Local agents** page with its model, its
measured reply speed, and a green dot while it is alive. Only that is sent —
never prompts, files, or history.

Restart the agent and the model picker will list **Massai Local (free)**.

---

## What to expect

| | |
|---|---|
| **Download** | about 4.5 GB for the 7B model, 2 GB for the 3B |
| **Speed** | a few second per reply on CPU; much faster on a Mac with Apple silicon or a GPU |
| **Disk** | model lives in `~/.ollama`, safe to delete later |
| **Privacy** | prompts stay on your machine — nothing leaves unless the gateway escalates |
| **Offline** | works with the network unplugged (only escalation needs internet) |

## If something goes wrong

```bash
./tools/massai-local.sh --check       # report what is installed, change nothing
./tools/massai-local.sh --stop        # stop the gateway
./tools/massai-local.sh --unwire-dsh  # remove the model from the agent, restore the profile backup
```

Logs live in `artifacts/massai-local.log.gateway` and `artifacts/massai-local.log.ollama`.

## Why this matters

Cloud models are cheap per word but not free, and a big project runs to
thousands of calls. A local model costs **zero per call**: no meter running
while you iterate, no surprise at the end of the month. The gateway keeps the
strong model as a deliberate escalation rather than the default.

That is the whole idea: **the small model does the lifting, the big model gets
called in.** You should not have to know which one answered.

---

## Where this goes: local agents as a network

The first step is one computer running one small model. The shape it grows into is
**Massai as the hub and local agents as the workers** — several machines, each
running a local model, connected to the same Massai so work lands on whichever
machine has capacity. DeepSeek stays the reliable default and the escalation path;
local agents are added capacity, not a replacement.

Design notes for that future, so today's work does not paint us into a corner:

- **The gateway is the seam.** Every local model is reached through one
  OpenAI-compatible endpoint, so a machine's model is just a `baseURL` —
  localhost today, `http://workstation.local:8000/v1` tomorrow.
- **Routing is per step, not per session.** The router already decides step by
  step, which is what a multi-machine pool needs: send this step to any worker
  that can answer it, keep the conversation in one place.
- **Identity is the user, not the machine.** Clerk/user ids key the credentials,
  so a person can move between machines without re-authenticating.
- **Failure is expected.** A worker that goes offline is just a provider that
  fails and falls back — the retry/fallback path already exists.
