# The golden set

Twenty trials that decide whether one-turn works. Each is a real request written the way a
non-technical person types it, plus the artifact shape and the checks that must pass. This file is
the *source* of the trial list — the harness reads `golden/*.json`, and every task here has a
matching JSON fixture.

Rules:

1. **Never remove a failing task to make the number better.** Fix the mask, or tag the failure and
   leave it visible.
2. **Keep a held-out set.** Ten of these twenty are tuned against; the other ten are only run at the
   end of an iteration. Otherwise the mask learns the test.
3. **Adversarial trials count double.** A mask that spends money on an impossible request is worse
   than one that builds slightly less.

## Task format

```jsonc
{
  "id": "site-lawn-care",
  "shape": "single-page-site",
  "intake": {
    "goal": "A page for my lawn care business in Edmonton, phone number and a list of services",
    "audience": "homeowners in Edmonton",
    "mustHave": ["phone number visible without scrolling", "at least five services listed",
                 "a way to request a quote"],
    "nonGoals": ["no online booking system"],
    "acceptance": []
  },
  "checks": [
    { "kind": "file-exists", "value": "index.html" },
    { "kind": "no-console-errors" },
    { "kind": "text-present", "value": "(780)", "note": "an Edmonton area code" },
    { "kind": "no-external-requests" }
  ],
  "heldOut": false
}
```

## The twenty

### Single-page site
| id | request | held out |
|---|---|---|
| `site-lawn-care` | A page for my lawn care business in Edmonton, phone number and a list of services | no |
| `site-wedding` | A wedding invitation page for Sarah and Tom, June 14, RSVP by email | yes |
| `site-podcast` | A one-page site for a podcast, with the 5 latest episodes and links | no |
| `site-dogwalking` | A pricing page for a dog-walking service, 3 tiers | yes |

### Single-file app
| id | request | held out |
|---|---|---|
| `app-tip-calculator` | A tip calculator that splits by people | no |
| `app-countdown` | A countdown to Christmas with a nice big number | yes |
| `app-todo-persist` | A todo list that remembers after refresh | no |
| `app-kanban` | A kanban board with drag and drop, 3 columns | yes |

### Script
| id | request | held out |
|---|---|---|
| `script-photo-rename` | Rename every photo in a folder to the date it was taken | no |
| `script-csv-clean` | Clean a CSV: trim spaces, drop empty rows, fix dates | yes |
| `script-duplicate-finder` | Check a folder for duplicate files by content | no |
| `script-folder-backup` | Back up a folder to a dated zip | yes |

### Data view
| id | request | held out |
|---|---|---|
| `data-revenue-dashboard` | A dashboard of this CSV: revenue by month and top 5 products | no |
| `data-sortable-table` | A table I can sort and filter from this JSON | yes |
| `data-heatmap` | A heatmap calendar of these daily counts | no |

### Document
| id | request | held out |
|---|---|---|
| `doc-resume` | A resume from this text for a warehouse supervisor job | no |
| `doc-invoice` | An invoice template with my logo and tax line | yes |
| `doc-readme` | A README for this project based on the files | no |

### Adversarial — must refuse or ask once, and spend almost nothing
| id | request | expected |
|---|---|---|
| `adv-uber` | Build me an app like Uber | refusal naming the unsupported reason; ≤1 cheap call |
| `adv-vague` | Make it beautiful | refusal or one question; **zero paid build calls** |

## Scoring

Per task, in order:

1. **Refusal correct?** (adversarial tasks only) — pass/fail
2. **Deterministic checks** — every `checks` entry must pass
3. **One-turn rate** — counted only when no follow-up question was needed
4. **Judge score** 1–5 against the brief — used for tie-breaks, never as the only signal
5. **Cost** — tokens in, tokens out, dollars, per task

Reported per variant: one-turn rate, median cost per accepted artifact, median latency, and the
failure taxonomy counts. A variant is only "better" if it wins on one-turn rate *without* raising
cost per accepted artifact by more than 25%.

## Failure taxonomy (tag every miss)

`missed-requirement` · `hallucinated-detail` · `wrong-shape` · `style-drift` · `broken-run` ·
`overbuilt` · `underbuilt` · `refused-wrongly`

A mask change is accepted only when its own bucket shrinks and no other bucket grows by more than
one task.
