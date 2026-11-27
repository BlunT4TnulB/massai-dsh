# Baseline: the first honest measurement

Run against the live deployment (`https://massai-itu.ca`), on `deepseek-chat`, on 2026-11-23.

## The number

| Metric | Value |
|---|---|
| **one-turn rate** | **68% mean ± 16 points** (passes: 79% · 63% · 63%) |
| **cost per accepted build** | **$0.0021** |
| **refusals correct** | 3 / 3 |
| **the whole golden set, once** | ~$0.03 |
| **the whole golden set, three times** | ~$0.08 |

The spread is the important part. Nineteen tasks, run three times, gave 79%, 63%, 63% — so a
single run cannot tell a real improvement from luck. **Any future claim about the mask needs repeat
passes, and a change is only real if it moves the mean beyond the spread.**

## Where the failures are

| Check | Failures | What it means |
|---|---|---|
| `requirements-traced` | 4 | a stated requirement left no trace in the artifact |
| `no-placeholders` | 2 | `example.com` or `TODO:` shipped as if it were content |

Both are now named in the mask's constraints and self-check, and both are the highest-value things
to fix next.

## What the measurement itself fixed

The instrument was wrong three times before it was fair, and each fix was found by looking at the
failures rather than at the score:

1. **Literal-phrase matching** demanded words like "prominent" and "clickable" that an implementer
   never writes. Now: stopwords dropped, synonyms expanded, prefixes matched.
2. **Adjective requirements** ("visible", "defaults") counted as unfulfilled features. Now: soft
   words (`-ing`, `-able`, `-ly`) are excluded from what must appear.
3. **Truncated replies** counted as build failures. Now: unclosed JSON is repaired, and the build
   gets 12,000 output tokens instead of 8,000.

A scorecard produced by a bad instrument is worse than no scorecard, because it sends you to fix
working things.

## What is measured, and what is not

- **Measured:** does the artifact exist, is it small enough, does it avoid fake content, does each
  stated requirement leave a trace, does it encode no external requests.
- **Not measured:** whether it is *good*, whether it opens without console errors (no browser in the
  container), whether a person would accept it.
- The human trial is still the only test that matters, and it has not been run yet.

## The state of the mask that produced this

```
identity 63 · brief 87 · shape 52 · extrapolated ~60 · particulars ~46 · never-invent ~52
runtime ~22 · constraints ~120 · style ~130 · acceptance ~95 · decision ~160 · lessons ~94
voice ~160 · protocol 78 · self-check ~70          total ≈ 750–1,100 tokens
```

## With the library in the mask (one pass, 2026-11-24)

After publishing 13 repository imports to the community shelf and feeding their stack profile into the
mask's `library` section (94 tokens):

| Metric | Value |
|---|---|
| one-turn rate | **79%** (one pass; inside the 63–84% band) |
| cost per build | $0.0023 |
| failures | 2 (1 placeholder, 1 requirement trace) |

The library's opening profile, straight from the published projects:

```
md 103 · ts 91 · tsx 55 · py 38 · json 35 · dxf 33     13 projects, 1.87 MB
```

Every build now carries: *"the workshop's own library holds 13 published projects… follow their
conventions: the same file layout, the same naming, the same dependency restraint."*

## Next, in order

1. Drive `requirements-traced` to zero by feeding every failure back as a lesson.
2. Kill `example.com` / `TODO:` completely — the mask now names both.
3. Re-run three passes and compare **means**, not single runs.
4. Then the human trial: ten real requests, marked accepted or not.


---

# Second measurement: 2026-11-27

Run against the live deployment on `deepseek-chat`, same 20-task golden set, same checks.

## The number

| Metric | Baseline (2026-11-23) | Now (2026-11-27) |
|---|---|---|
| **one-turn rate** | **68% mean ± 16** (79 · 63 · 63) | **98% mean** (95 · 100 · 100) |
| graded per run | 19 | 19 |
| cost per build | $0.0021 | $0.0022 |
| whole set, one run | $0.03 | $0.036 |
| refusals correct | 3/3 | 1/1 (the set's one adversarial task) |

## What actually caused it — measured, not assumed

The repair pass is **not** the reason. Across the three runs it was **attempted once and won zero**.
The gain came from a single new mask section:

> **EVERY REQUIREMENT MUST LEAVE A TRACE IN THE ARTIFACT.** … A feature that exists only in your head
> fails the check that greps for it, and fails the person who has to verify it. Name what you built,
> in the words the brief used, in visible text or in a printed summary.

That section targets `requirements-traced`, which was the dominant failure at baseline (4 of 6).
It is now effectively gone.

## What remains

| check | baseline failures | now |
|---|---|---|
| `requirements-traced` | 4 | 0 in two of three runs, 1 in one |
| `no-placeholders` | 2 | 1 (the one repair attempt, which failed to fix it) |

## What this changes about the plan

1. **Mask wording is the strongest lever we have found** — one paragraph moved 30 points. The next
   iteration should attack `no-placeholders` the same way: a named, greppable self-check rather than a
   general instruction to be careful.
2. **The repair pass is insurance, not an engine.** Keep it (it costs nothing when checks pass) but do
   not count on it; its first honest record is 1 attempt, 0 wins. If it is to earn its place, the
   remedy text must be sharper than "fix this".
3. **Verify against held-out tasks.** These runs include all 20 tasks; the golden-set rules keep ten
   tuned and ten held out. A 98% on tuned tasks is not a 98% product claim.
4. **The spread is now small** (95–100), so the next change can be judged from fewer runs — but any
   regressions must still be re-run three times, because a single 95 could be luck.

## Cost of this measurement

Three full runs, plus the attribution runs: **$0.24 total**. The whole experiment — finding the
lever, proving it, and instrumenting the repair pass — cost less than a third of one Render month.


---

# Third measurement: repair pass earns its place (2026-11-27, later)

Same 20-task set, same checks, after two changes: the mask now names the four forbidden strings and the
repair turn carries per-check remedies.

| Metric | Baseline | Second run | Now |
|---|---|---|---|
| one-turn rate | 68% ±16 | 98% (95·100·100) | **98% (100·100·95)** |
| **repairs attempted** | — | 1 | **3** |
| **repairs that won** | — | **0** | **2** |

## What this says

1. **The repair pass is now real.** Two of three runs reached 100% *because* a deterministic failure was
   fixed by a second, targeted call. The remedy text ("a requirement is satisfied but invisible — add it
   in words the brief used") is what changed it, not the retry itself.
2. **The forbidden-strings section did not move the rate.** `no-placeholders` still fails about once in
   three runs, and in the one failure the repair did not win. Naming the strings is not enough; the next
   attempt should attack it at the source (e.g. make the report field print the four strings it searched
   for, so the check and the model share one definition).
3. **Do not claim 100%.** The remaining failure is intermittent and the set is partly tuned. The honest
   statement is: **≈98% on this set, with one known intermittent defect.**

## Cost

Nine full runs across the three measurements: **≈$0.34**. Every claim above is reproducible with
`scripts/run-golden.mjs`; the results files are committed beside this document.
