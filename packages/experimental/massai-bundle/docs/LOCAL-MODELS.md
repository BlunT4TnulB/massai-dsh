# Local models — the complete guide

Everything about running an AI agent on your own hardware: what it can do, what
it cannot, what to buy, and when it actually saves money.

This is the long version. If you only want to try it, the one command is
`./tools/massai-local.sh`. If you want to *get somewhere* with it, read on.

---

## 1. What a local model is

A local model is an AI that runs on your machine instead of a data centre. Once
the file is on disk:

- **Every message is free** — no meter, no per-token bill.
- **It works offline** — on a plane, in a shed, during an outage.
- **It is private** — prompts never leave the machine.
- **It is slower and less capable** than a frontier model. That is the trade.

The good news: most agent work is not frontier work. Reading a file, renaming
things, writing a small page, fixing a typo — a 7B model does that well. The
skill is knowing which half of your work is which.

---

## 2. Hardware requirements — the honest table

Model size is the main driver. "Parameters" is the number in the name (3B = 3
billion). Rule of thumb: **you need roughly the model size in RAM, plus 2 GB for
the system, plus room for the agent.**

| Model | File size | RAM needed | Works on | Speed (typical) | Good for |
|---|---|---|---|---|---|
| 3B (e.g. Qwen2.5-Coder 3B) | ~2 GB | 6 GB total | any laptop from the last 8 years | ~5–15 tok/s on CPU | chat, small edits, explaining code |
| 7B (e.g. Qwen2.5-Coder 7B) | ~4.7 GB | 10 GB total | 16 GB laptop, mini PC, Apple silicon | ~8–25 tok/s CPU, 30–60 on GPU/Apple | **the sweet spot**: real coding, multi-file edits |
| 14B | ~9 GB | 18 GB total | 32 GB machine or 12 GB+ GPU | 20–50 tok/s on GPU | harder tasks, longer context |
| 32B | ~20 GB | 36 GB total | 64 GB or 24 GB GPU | 15–40 tok/s on a good GPU | near-frontier on routine code |
| Frontier (cloud) | — | — | any | fast | anything genuinely hard |

**Practical notes**

- **Apple silicon** (M1/M2/M3/M4) is the best value per watt: a 16 GB MacBook runs
  a 7B well and a 14B acceptably.
- **GPUs**: 8 GB VRAM runs a 7B comfortably; 12 GB runs 14B; 24 GB runs 32B.
- **CPU-only** works, but a 7B at ~8 tok/s feels slow in a long agent loop. Fine
  for questions, tiring for building.
- **Don't stack it on the machine already running your agent** — a 2.4 GB model
  plus the harness on an 8 GB box will swap or crash. Use a second machine if you
  can, or close everything else.
- **Disk**: models live in `~/.ollama` (or the gateway's cache). Removing an
  unused model frees the space instantly.

---

## 3. Setup walkthrough (any of your machines)

1. Copy the repo (or just the `tools/` folder) to the machine.
2. Run:
   ```bash
   ./tools/massai-local.sh            # 7B, asks before changing anything
   ./tools/massai-local.sh --small    # 3B on a lighter machine
   ./tools/massai-local.sh --check    # look, change nothing
   ```
3. The script checks memory, installs the model runner, downloads the model,
   starts a gateway, and **tests the whole chain with a real prompt** before it
   says done.
4. Optional: `--wire-dsh` adds the model to the agent's picker.
5. Point any OpenAI-compatible tool at `http://localhost:8000/v1`.

**Second machine?** Run the same command there. Each machine is its own worker;
the gateway on each is the seam.

---

## 4. Setting expectations by scenario

These are honest ranges, not promises. Prompt sizes vary enormously.

### Scenario A — "Ask the agent questions all day"
- Typical: 200 short Q&A turns/day, ~1.5k new tokens + 500 output each.
- Cloud (cheap tier, cache warm): roughly **$0.20–0.60/day** → **$6–18/month**.
- Local 7B: **$0**, at 5–20 s per reply.
- Verdict: works, but the cloud is cheap enough that local is about **privacy**
  and **offline**, not saving money.

### Scenario B — "Build a small app over a weekend"
- Typical: 400–800 agent steps, big contexts, lots of file reading.
- Cloud (cheap tier, 99% cache): roughly **$1–4/weekend**.
- Cloud (flagship model, careless): **$10–40/weekend**.
- Local 7B: $0, but a long build at 10 tok/s is genuinely slower — expect 2–4×
  wall-clock time.
- Verdict: **the big win is turning a flagship habit into a local one**, not
  replacing an already-cheap cloud session.

### Scenario C — "A team of agents on several machines"
- Several machines each running a 7B, each feeding the same project.
- Cloud equivalent at 3,000+ steps/day: **$60–150+ /month**.
- Local: $0 marginal cost, but you are now an operator (updates, uptime, fan
  noise).
- Verdict: **this is where local genuinely wins on cost** — and where a hub that
  can see all the machines matters.

### Scenario D — "Offline"
- No comparison. Cloud cannot do it. Local is the only option.

**The honest summary:** local models save real money when your volume is high or
your model choice would otherwise be expensive. At low volume the cloud is cheap
enough that the reasons to go local are privacy, offline, and independence.

---

## 5. Getting *effect* out of a small model

A 7B fails differently from a frontier model. These habits matter more than the
model:

1. **Small steps.** "Add a contact form to index.html" beats "build me a site".
2. **Point at files.** "Fix the error in app.js line 40" beats "it's broken".
3. **Feed it errors verbatim.** Small models are much better at fixing text you
   pasted than at reasoning about a vague symptom.
4. **One job per message.** Multi-part asks get half-done.
5. **Let it escalate.** Keep DeepSeek behind the gateway; when a step is too hard,
   the same conversation continues on the strong model.
6. **Keep context short.** Small models degrade with huge histories — this is why
   Massai compacts aggressively.

---

## 6. When to use which

| Task | Local 7B | Cloud (cheap) | Cloud (flagship) |
|---|---|---|---|
| Explain a file / rename things | ✅ | ✅ | overkill |
| Small single-file edits | ✅ | ✅ | overkill |
| Multi-file refactor | ⚠️ may drift | ✅ | ✅ |
| Hard debugging, long logs | ❌ | ⚠️ | ✅ |
| Design decisions, trade-offs | ⚠️ | ✅ | ✅ |
| Offline / private data | ✅ only option | ❌ | ❌ |
| High volume, low stakes | ✅ best value | ✅ | ❌ |

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `not enough memory — nothing was changed` | The guard refused; the model would not fit | Use `--small`, free RAM, or run it on another machine |
| Very slow replies | CPU-only inference | A 3B model, or a machine with a GPU / Apple silicon |
| Gateway up but no answer | Model still loading the first time | Wait ~30 s, retry |
| Agent crashed while installing | Model + harness in the same RAM | Run the model on a different machine |
| Model forgets earlier context | Context window is small (4k–32k) | Keep sessions short; let Massai compact |

---

## 8. Where this goes

Several machines with local models, one Massai in the middle, work landing on
whichever machine is free. The pieces that make that possible are already chosen:
every model is reached through **one OpenAI-compatible gateway**, routing happens
**per step**, and identity is the **user**, not the machine. DeepSeek stays the
default and the escalation; local agents are added capacity.
