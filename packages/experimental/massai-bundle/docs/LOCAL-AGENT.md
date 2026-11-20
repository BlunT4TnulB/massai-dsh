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
