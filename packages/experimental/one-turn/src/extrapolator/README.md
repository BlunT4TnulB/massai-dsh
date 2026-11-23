# The Extrapolator

*Named after a joke that got out of hand. It stays.*

## What it is

The interview collects. The Extrapolator **fills the gaps** — and then tells the truth about having
done so. It is the component that makes one turn possible from incomplete input: instead of stopping
to ask a ninth question, it derives the missing detail from the shape, the shelf and the words
already typed, marks it as an assumption, and writes that mark into the artifact.

The rule it lives by:

> **An extrapolation is allowed. A silent extrapolation is a lie.**

So every value it invents carries three things: what was filled in, why, and a marker the build must
put in the artifact at that spot. The person sees `[your hours]` rather than a plausible fiction.

## Where it sits

```
person's words
   ↓
interview        (collects: the boxes they filled)
   ↓
EXTRAPOLATOR     (fills: audience, sections, contact, palette, must-haves…)
   ↓
mask compiler    (writes both the filled values and the marks)
   ↓
one paid call → artifact with honest blanks
```

## The two kinds of extrapolation

| Kind | Example | How it appears |
|---|---|---|
| **Structural** | "a page needs a contact block" | used plainly; the shape implies it |
| **Specific** | "[your phone]" | used, but **marked** so nobody trusts it |

Structural guesses make the artifact complete. Specific guesses make it honest. Both are recorded in
the trial so the shelf learns which ones people actually accept.

## The shelf

Everything the Extrapolator learns lives under the state directory, in one place:

```
$DSH_HOME/one-turn/data/
├── lessons.json    what failed, per shape, and how often
├── voice.json      the workshop's character and reference points
├── trials/         one directory per trial: files, checks, summary.json
└── extrapolations.json   which marks people replaced, and which they kept
```

That folder is the "category for collecting data" — one place, inspectable, portable to R2 when
durable storage lands.

## Why it is named this

Because a friend said "the extrapolator" about the thing that pries a whole project out of four
sentences, and then laughed until he could not breathe. The name stuck because it is accurate: this
component extrapolates, and it is the only part of the system that invents anything — which is
exactly why it is the part allowed to say "I guessed here".
