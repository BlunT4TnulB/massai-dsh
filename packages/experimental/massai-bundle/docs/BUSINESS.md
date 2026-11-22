# The middleman question, answered with numbers

Easy mode makes Massai an intermediary: the user pays Massai, Massai pays the model provider.
That is a real model — OpenRouter and every managed host do it — but the arithmetic decides whether
it works, not the idea.

## Why a 5–10 % margin on tokens loses money

Card processing in Canada is roughly **2.9 % + $0.30** per charge.

| Top-up | Processor takes | Effective fee | Margin at +5 % | Result |
|---|---|---|---|---|
| $5 | $0.145 + $0.30 = **$0.445** | 8.9 % | $0.25 | **−$0.20** |
| $10 | $0.29 + $0.30 = **$0.59** | 5.9 % | $0.50 | **−$0.09** |
| $25 | $0.725 + $0.30 = **$1.03** | 4.1 % | $1.25 | **+$0.22** |
| $50 | $1.45 + $0.30 = **$1.75** | 3.5 % | $2.50 | **+$0.75** |

So a small markup only survives on **larger top-ups**, and it never survives chargebacks — a
disputed $25 costs the money *and* the credit that was already spent.

Three ways out:

1. **Raise the rate.** 20–25 % is what convenience layers actually take, and even that is thin on
   $5 packs.
2. **Charge for the workshop, not the tokens.** A flat $8–10/month for the app (persistence, shelf,
   no setup) with model usage bundled at cost underneath. Predictable, defensible, no per-token math.
3. **Stay donation-funded.** Ko-fi takes no platform fee; the card fee is the donor's problem. No
   promises, no margin, no obligation — and Massai stays a gift with a tip jar, which is what it is
   today.

## The wall that matters more than margin: reselling rights

Marking up another company's API is usually **governed by that company's terms**, not by us.
Before charging anyone for access to DeepSeek (or Gemini, or Groq) through Massai, those terms have
to be read for: resale, end-user disclosure, rate limits, and whether a managed wrapper counts as a
separate service. That is a Tuesday-afternoon job with a lawyer's eye, and it is the difference
between a business and an account ban.

Being the one who takes the money also makes Massai the **merchant of record**: refunds, taxes
(GST/HST once past the small-supplier threshold in Canada), a privacy policy, and consumer law about
prepaid balances that expire.

## The model that fits what is already built

| Layer | Who pays | What they get |
|---|---|---|
| **Free tier** (built) | Massai absorbs, capped at `$0.25/user`, `$5/month` | a real taste, 3 sessions/day per network |
| **BYOK** (built) | the user, directly to the provider | no caps, no margin, no middleman |
| **Coffee** (trivial to add) | whoever feels generous | nothing owed back — it funds the free tier |
| **Credit** (small build) | the user, prepaid to Massai | their own allowance raised; honest ledger already exists |
| **Subscription** (later) | the user | the workshop itself: persistence, shelf, support |

The middleman position is not a trick — it is the product. What the user pays for is *not having to
do what we did tonight*. Anyone who wants the raw version can fork the repo and bring their own keys;
that is not a bug in easy mode, it is easy mode's whole reason to exist.

## What is already in place for it

- per-user spend attribution (`user_id` on every call)
- a hard per-user and per-deployment ceiling
- a ledger the owner can read at `/admin`
- a guest turnstile keyed to the network, not the cookie

Adding prepaid credit means one table (`credits`), one grant route, and the gate reading
`cap + credit` instead of `cap`. The payment rail can be added later without touching any of it.
