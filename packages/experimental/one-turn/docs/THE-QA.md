# The Q&A is the prompt builder

There is no prompt to write. A person answers ten questions and the answers **become** the prompt.
The interview is not preparation for the builder — it *is* the builder, wearing a different hat.

The rule that keeps it honest: **every question names the failure it prevents.** If a question cannot
name one, it does not belong in the interview.

## The ten questions, word for word

These are the exact strings the deployed app serves at `GET /api/one-turn/intake`.

| # | Question | Skipped it becomes | Prevents |
|---|---|---|---|
| 1 | What should exist when this is done? One sentence, your own words. | *required — nothing proceeds without it* | wrong-shape |
| 2 | Which of these is it closest to? | inferred from the sentence; if that fails, asked | wrong-shape |
| 3 | The particulars this must get right — names, numbers, sizes, materials, part numbers, wording. | nothing beyond the sentence; expect guesses, and check them | hallucinated-detail |
| 4 | Three things it must do. Each one checkable by looking. | derived from the first sentence | missed-requirement |
| 5 | What would make you say "no, that is not it"? | the standard checks for the shape | underbuilt |
| 6 | What must it never make up? | no invented testimonials, prices, dates, credentials or addresses | hallucinated-detail |
| 7 | What should it deliberately NOT include? | no accounts, no backend, no sign-in, no popup | overbuilt |
| 8 | Three words for how it should feel, and one look to match if you have one. | a restrained two-colour palette, no gradients | style-drift |
| 9 | Any hard technical limits? Where will you open this? | one file, browser, no build step, no network | broken-run |
| 10 | Where does the data comes from, and what are the columns or fields? | the artifact carries its own content | underbuilt |

## Answer → mask section

| Answer | Becomes this section of the prompt | Weight |
|---|---|---|
| 1 + 4 + 7 | `brief` — the request verbatim, MUST DO, MUST NOT DO | ~85 tok |
| 2 | `shape` — the artifact contract: files, entry point, ceiling | ~50 tok |
| 3 | `particulars` — "use these exactly; invent nothing beyond them" | ~46 tok |
| 6 | `never-invent` — "a visible blank is a correct answer" | ~52 tok |
| 5 | `acceptance` — the checks that define "done" | ~92 tok |
| 8 | `style` — palette, type scale, spacing, corner radius, avoid-list | ~129 tok |
| 9 | `runtime` — where it runs, which decides whether it works at all | ~22 tok |
| 10 | `shape` (data line) — supplied file and fields | — |

Everything the person does not answer is replaced by a **stated default**, never by an unstated guess.
That is the difference between a build that fails mysteriously and one that fails visibly.

## Worked example: fiber tubing

**What they typed into the particulars box:**

```
12mm OD carbon fiber tube, 8mm ID
3m lengths, qty 6
aluminium ferrules, 12mm, qty 12
frame is 1.2m x 0.8m x 0.6m
```

**What the mask gained:**

```
THE PARTICULARS. Use these exactly; invent nothing beyond them:
- 12mm OD carbon fiber tube, 8mm ID
- 3m lengths, qty 6
- aluminium ferrules, 12mm, qty 12
- frame is 1.2m x 0.8m x 0.6m

NEVER INVENT ANY OF THE FOLLOWING. Leave a visible marker such as [your review] instead:
- supplier names
- prices
- load ratings
A visible blank is a correct answer. A plausible invention is a failed build.
```

**What that bought:** the trial returned `document.md` with a cut list, total tube required and an
assembly order, passed all six checks, and cost **$0.0009**.

## Earned follow-ups (probes)

The interview also generates up to **three** follow-ups from what was already said — never more,
because the interview must stay faster than the build.

| Trigger in the text | Probe | Prevents |
|---|---|---|
| tube, pipe, fitting, ferrule, hose, bracket, sheet, rod | "Give me the exact sizes and quantities: outside diameter, inside diameter, length, wall, count." | hallucinated-detail |
| price, cost, rate, fee, budget, $ | "What are the actual prices, and is tax included?" | hallucinated-detail |
| legal, contract, lease, terms, clause, policy | "Which wording must be exact? Paste it, or say 'paraphrase only'." | hallucinated-detail |
| logo, brand, colour, font, style, design | "Exact brand values you already have: colour codes, font names, logo file." | style-drift |
| shape: page | "What contact details and opening hours are real?" | hallucinated-detail |
| shape: app | "Walk me through the exact interaction, step by step." | underbuilt |
| shape: script | "Which machine, OS and language version will run this?" | broken-run |
| shape: data view | "Name the fields that matter and the order you want to see them." | missed-requirement |
| shape: document | "The facts that are true: dates, employers, amounts, exact titles." | hallucinated-detail |

## Why this beats a clever prompt

A clever prompt guesses what the person meant. The interview **asks**. Every guess it avoids is a
token not spent on a wrong build, and a rerun not needed — which is the entire economics of one turn:

```
mask 749 tokens  →  $0.0009–0.0016 per accepted artifact
one wrong guess  →  a second turn, and the trust that came with the first
```
