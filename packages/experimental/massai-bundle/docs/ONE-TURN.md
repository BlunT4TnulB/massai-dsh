# One Turn, One Result — the mask

**The goal:** a person types one message and gets a working artifact. No follow-up questions from
them, no "can you clarify", no second attempt. The work of understanding happens *before* the
expensive call, in a mask that turns a conversation into a sealed specification.

This document is the build plan. It is deliberately blunt about where the idea works and where it
does not, because a one-turn promise fails fastest when it is sold wider than it can deliver.

---

## 0. Definitions that keep us honest

| Term | Meaning here |
|---|---|
| **turn** | one message from the user. A turn may still contain several model calls and many tool calls. |
| **call** | one paid request to a model provider. |
| **accepted** | the artifact runs, matches the brief, and the user keeps it without asking for a fix. |
| **one-turn rate** | share of trials accepted with exactly one user message. This is the headline number. |
| **mask** | the compiler that turns an intake spec into one dense, self-sufficient prompt. |

**What we are NOT promising:** one *call*. Building anything real needs a planning call, a build
call, and often a cheap verification call. One **turn** is achievable; one *call* is not, and
pretending otherwise is how this project would fail.

---

## 1. Where one-turn works, and where it cannot

**Supported shapes** (commit to these; refuse politely outside them):

| Shape | Examples | Why it works |
|---|---|---|
| **Single-page site** | landing page, portfolio, pricing page | bounded output, no persistence |
| **Single-file app** | calculator, converter, timer, kanban, quiz | one HTML file, state in memory/localStorage |
| **Script / automation** | file renamer, CSV cleaner, scraper, scheduler | one file, one clear entry point |
| **Data view** | dashboard over provided CSV/JSON | input is handed over, output is visual |
| **Document artifact** | resume, invoice, one-pager, README | text shape is well understood |

**Will keep failing, so do not promise it:** anything needing an external account or key at build
time, anything needing a server with persistence, anything visual judged by taste alone ("make it
beautiful like Apple" with no reference), and anything the user has not decided yet.

**Rule:** the intake must detect an unsupported shape and say so *before* a single paid token is
spent.

---

## 2. The nine components

### C1 — Intake interview (deterministic, no API cost)
A structured form, not a chat. Ten questions, all skippable, each with a smart default. The answers
are the only input the mask gets. Zero cost by design: this is where the "mask the print" idea
actually saves money.

### C2 — The spec object
One canonical JSON object, versioned. Nothing downstream reads the raw form.

```jsonc
{
  "version": 1,
  "shape": "single-page-site",            // from the supported list, or "unsupported"
  "goal": "string",                        // one sentence, user's own words preserved
  "audience": "string",
  "mustHave": ["string"],                  // hard requirements, each testable
  "niceToHave": ["string"],
  "nonGoals": ["string"],                  // what to explicitly NOT build
  "style": { "tone": "...", "palette": "...", "references": ["url|image"], "avoid": ["..."] },
  "content": { "copy": "...", "data": "...", "assets": ["..."] },
  "stack": { "allowed": ["vanilla-html"], "forbidden": ["any-build-step"] },
  "acceptance": ["string"],                // observable checks, written as assertions
  "outputContract": { "files": ["index.html"], "entry": "index.html" },
  "budgetHints": { "maxFiles": 3, "maxBytes": 200000 }
}
```

### C3 — Validator and normaliser
Fills defaults, rejects contradictions ("no JavaScript" + "needs a live clock"), maps vague phrases
to concrete ones, and refuses unsupported shapes with a helpful explanation. Pure code, fully
unit-testable, no model.

### C4 — The prompt compiler (the mask)
Assembles, in this order, with a hard token budget per section:

1. **Role and stance** — who the builder is, one paragraph, no flourish.
2. **The brief** — goal, audience, must-haves, non-goals, verbatim user intent.
3. **The shape contract** — exact files to produce, entry point, size ceiling.
4. **Constraints** — stack limits, forbidden patterns, accessibility minimum.
5. **Style tokens** — concrete values, never adjectives without a number.
6. **Acceptance tests** — the user's own checks, restated as assertions the build must satisfy.
7. **Environment** — what tools exist, what the workspace looks like, what is preinstalled.
8. **Output protocol** — exactly how to report: files written, how to run, what was verified.
9. **Self-check ritual** — the build must run its own acceptance checks before declaring done, and
   state the results.

Rules for the compiler: no nested instructions that contradict, every requirement testable, no
"be creative" without a reference, and a token accounting log so we can see the mask's weight.

### C5 — Context packer
Takes the spec plus environment facts (available tools, existing files, brand tokens, model limits)
and packs them into the remaining budget with a strict priority order. Everything measured in
tokens, everything logged.

### C6 — Router
| Stage | Model class | Why |
|---|---|---|
| Normalise / clarify (optional) | cheapest | it is a classification task |
| Compile mask | none, pure code | deterministic |
| **Build** | strongest available | this is where quality is bought |
| Verify (optional) | cheap | runs tests, reports; does not rewrite |

If a clarification call is used, cap it at **one round, three questions, cheap model** — and measure
whether it earns its cost (variant B below).

### C7 — Output contract and acceptance harness
Deterministic, not vibes:

- files exist, entry point present, no forbidden dependency
- page opens, no console errors (headless run)
- declared acceptance checks execute and pass
- size/time ceilings respected
- screenshot captured for human review

### C8 — Telemetry
Per trial: spec, compiled mask (full text), every call with tokens and cost, tool calls, artifacts,
verdict, wall time. Stored per trial id, so any run can be replayed or diffed.

### C9 — Golden set and scorer
A fixed set of tasks (section 6) with expected outcomes. Two scorers:

- **deterministic**: build-passes, checks-pass, size, latency
- **judge**: cheap model grades against the brief on a 1–5 rubric (can be spot-checked by a human)

Metrics reported per variant: one-turn rate, cost per accepted artifact, median latency, failure
taxonomy.

---

## 3. Where it lives in the repo

```
packages/experimental/one-turn/
├── src/
│   ├── spec.ts            // C2 types + zod schema + version
│   ├── normalise.ts       // C3 defaults, conflict detection, shape refusal
│   ├── compile.ts         // C4 the mask, section by section, token-budgeted
│   ├── context.ts         // C5 packer
│   ├── intake.ts          // C1 question definitions (shape → questions → defaults)
│   ├── verify.ts          // C7 acceptance runner (headless, deterministic)
│   ├── trial.ts           // C8 telemetry record shape
│   └── index.ts           // cordis plugin: /api/one-turn/compile, /api/one-turn/run
├── tests/
│   ├── normalise.spec.ts
│   ├── compile.spec.ts
│   └── golden/*.json      // C9 tasks
└── docs/GOLDEN-SET.md     // the trial prompts and their pass criteria
```

The plugin registers two routes:
- `POST /api/one-turn/compile` — spec in, mask + token accounting out (owner-only, free)
- `POST /api/one-turn/run` — spec in, artifact + trial record out (owner-only, paid)

Keeping compile separate from run is the whole trick: **we can iterate the mask for free**, and only
pay when a compiled mask is worth running.

---

## 4. The intake questions

Every question skippable, every one with a default, grouped so the first two are the only ones that
matter.

| # | Question | Default if skipped |
|---|---|---|
| 1 | What should exist when this is done? (one sentence) | required |
| 2 | Which of these is it closest to? (the five shapes) | inferred from #1, else ask |
| 3 | Who is it for? | "a stranger who has never seen this" |
| 4 | Three things it must do. | derived from #1, restated |
| 5 | One thing it must NOT do. | "no external accounts, no backend" |
| 6 | Any look you want to match? (link or image) | brand tokens from the workshop |
| 7 | Where does the data come from? | "none / in the page" |
| 8 | What must be true for you to accept it? | shape defaults |
| 9 | Files you want: one page, or a small project? | one file |
| 10 | Anything already built to reuse? | none |

If #1 cannot be matched to a shape → refuse with the supported list, spend nothing.

---

## 5. Test plan — three stages, in this order

### Stage A — offline harness (no UI, no product code)
A script that runs `spec → compile → call → artifact → verify` and writes a trial record. Runs from
the terminal. **This is where 90% of the iteration happens, and it costs only API money.**

### Stage B — golden set + variants
Run every golden task against mask variants, side by side:

| Variant | Difference | Question it answers |
|---|---|---|
| **V0** | the bare brief, no mask | what does the model do today? (baseline) |
| **V1** | full mask, no questions | how good is a mask with inferred defaults? |
| **V2** | mask + one cheap clarification round | do the questions pay for themselves? |
| **V3** | V1 + cheap verify-and-report pass | does self-checking lift acceptance? |

Report per variant: one-turn rate, cost/accepted artifact, median latency.

### Stage C — human trial
You and your buddy run **ten real requests each**, unscripted, and mark each accepted or not. This
is the only measure that matters, and it is the one an automated scorer will disagree with — which
is why it is last.

**Ship gate:** V2 (or whichever wins) reaches **≥70% one-turn acceptance across the golden set** and
**≥60% in the human trial**, at **≤$0.35 per accepted artifact**.

---

## 6. The trial run prompts

Twenty trials, four per shape. Each has the request, the expected artifact, and hard pass criteria.
Written the way a non-technical person would actually type it.

### Single-page site
| # | Prompt | Pass criteria |
|---|---|---|
| 1 | "A page for my lawn care business in Edmonton, phone number and a list of services" | one file, phone visible above the fold, 5+ services, no broken links |
| 2 | "A wedding invitation page for Sarah and Tom, June 14, RSVP by email" | date prominent, RSVP mailto works, mobile-readable |
| 3 | "A one-page site for a podcast, with the 5 latest episodes and links" | 5 episodes, episode links clickable, no JS errors |
| 4 | "A pricing page for a dog-walking service, 3 tiers" | 3 tiers, prices visible, recommended tier marked |

### Single-file app
| # | Prompt | Pass criteria |
|---|---|---|
| 5 | "A tip calculator that splits by people" | works at 1–20 people, rounds correctly, no console errors |
| 6 | "A countdown to Christmas with a nice big number" | correct target date, ticks, survives reload |
| 7 | "A todo list that remembers after refresh" | add/remove/persist via localStorage |
| 8 | "A kanban board with drag and drop, 3 columns" | drag works, 3 columns, no dependency download |

### Script
| # | Prompt | Pass criteria |
|---|---|---|
| 9 | "Rename every photo in a folder to the date it was taken" | reads EXIF, dry-run mode, no data loss |
| 10 | "Clean a CSV: trim spaces, drop empty rows, fix dates" | idempotent, prints a summary |
| 11 | "Check a folder for duplicate files by content" | hashes content, reports groups, deletes nothing by default |
| 12 | "Back up a folder to a dated zip" | creates zip, verifies, prints path |

### Data view
| # | Prompt | Pass criteria |
|---|---|---|
| 13 | "A dashboard of this CSV: revenue by month and top 5 products" | reads provided file, two charts, no hardcoded numbers |
| 14 | "A table I can sort and filter from this JSON" | sort + filter work, 100 rows smooth |
| 15 | "A heatmap calendar of these daily counts" | 12 months rendered, tooltip shows value |

### Document
| # | Prompt | Pass criteria |
|---|---|---|
| 16 | "A resume from this text for a warehouse supervisor job" | one page, ATS-friendly, no invented claims |
| 17 | "An invoice template with my logo and tax line" | totals correct, printable |
| 18 | "A README for this project based on the files" | accurate to the files, run instructions correct |

### Adversarial (must fail gracefully, spend nothing or little)
| # | Prompt | Pass criteria |
|---|---|---|
| 19 | "Build me an app like Uber" | refuses politely, offers the closest supported shape, spends ≤1 cheap call |
| 20 | "Make it beautiful" (no object at all) | asks at most one question or refuses, no paid build call |

---

## 7. Debug and iteration loop

For every trial, capture and keep:

1. **spec.json** — what the intake produced
2. **mask.txt** — the exact compiled prompt, with section token counts
3. **calls.jsonl** — every request/response with model, tokens, cost, latency
4. **artifact/** — files produced
5. **verify.log** — each acceptance check with pass/fail and output
6. **verdict.json** — deterministic result + judge score + human score

**The loop:** change one mask section → rerun the same 20 trials → compare one-turn rate, cost and
the failure taxonomy. Never change two sections at once; never judge a change on fewer than ten
trials.

**Failure taxonomy to tag every miss with** (this list is the actual product work):

- `missed-requirement` — a must-have was ignored
- `hallucinated-detail` — invented data or claims
- `wrong-shape` — built the wrong kind of thing
- `style-drift` — ignored the reference
- `broken-run` — does not open / errors
- `overbuilt` — unnecessary files or dependencies
- `underbuilt` — clearly incomplete
- `refused-wrongly` — refused something supported

Every taxonomy bucket gets a mask fix; the fix is only accepted when its bucket shrinks without
others growing.

---

## 8. Cost model

| Item | Estimate |
|---|---|
| compile only, no calls | **$0** — iterate as long as you like |
| one trial, build call | $0.02–0.15 depending on model |
| one full golden run (20 trials) | $0.50–$2.50 |
| one variant across the set | same |
| four variants, three iterations each | **$10–$30** |
| serious tuning with judge + verify calls | **$50–$100** |
| human trial, 20 real requests | a few dollars |

The mask itself is free to build and re-build. Money is only spent on runs, and a run is a decision
you make with your eyes open — which is exactly why the compile/run split exists.

---

## 9. Risks and non-goals

- **One turn is not magic.** Bounded shapes succeed; open-ended requests will not. The refusal path
  is part of the product, not an embarrassment.
- **Taste cannot be specified.** If the user cannot point at a reference, "beautiful" is luck. Intake
  must push for a reference.
- **A mask can overfit.** Twenty trials is a small set; add tasks as taxonomy buckets appear, and keep
  a held-out set you never tune against.
- **Not a replacement for the agent.** The full agent still handles multi-turn work; one-turn is a
  fast lane for the common case.
- **Do not promise "perfect".** Track the number. Publish the number. Improve the number.

---

## 10. Build order

| Milestone | Content | Effort |
|---|---|---|
| **M0** | `spec.ts` + `normalise.ts` + unit tests (pure, offline) | 2–3 h |
| **M1** | `compile.ts` + token accounting + `POST /api/one-turn/compile`; inspect masks by hand | 3–4 h |
| **M2** | offline harness: spec → mask → call → artifact → verify, trial records | 3–4 h |
| **M3** | golden set (the 20 above) + deterministic scorer + variant runner | 3–4 h |
| **M4** | first tuning round: V0 vs V1 vs V2 vs V3, taxonomy tagging | 4–6 h + API money |
| **M5** | wire into the product: intake UI → compile → one turn; ship behind a flag | 4–6 h |

**M0–M2 are free to build and test.** The first dollar is spent at M4, on purpose.
