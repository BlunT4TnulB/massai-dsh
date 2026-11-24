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
