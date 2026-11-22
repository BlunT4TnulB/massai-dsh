# Ko-fi: the tip jar, wired end to end

## What the supporter sees

1. They run out of free allowance; the message says a coffee can keep it going.
2. They open `/support` (linked from the door and every legal page).
3. They tap the button, choose an amount, and put **their Massai id in the note**.
   The id is on `/me`; it looks like `guest-9f3c…`.

## What happens automatically

```
Ko-fi → POST /api/kofi/webhook
      → verification_token checked (KO_FI_VERIFICATION_TOKEN)
      → type must be "Donation"
      → credited to:  guest-… from the note, else email:<addr>, else unmatched:<tx>
      → row in `credits`  →  their ceiling becomes allowance + credit
```

Nothing is typed by hand. Unmatched donations are parked under
`unmatched:<transaction id>` and show up in the owner console's credit table, where the coffee-fund
form can move them to the right person.

## Setup, once

1. **ko-fi.com** → sign up → choose a page name (this becomes `ko-fi.com/<name>`).
2. **Settings → Payments** → connect **Stripe** (Canada supported) or PayPal for payouts.
3. **Settings → API / Webhooks** → set the webhook URL to
   `https://massai-dsh.onrender.com/api/kofi/webhook`
4. Copy the **verification token** Ko-fi shows there.
5. Set it in Render as `KO_FI_VERIFICATION_TOKEN` (the deployment currently holds a generated one —
   replace it with Ko-fi's own value, otherwise every real donation is refused with `401`).
6. Set `KO_FI_URL=https://ko-fi.com/<name>` so the button appears on `/support`.
7. Send yourself a $1 test donation with a note like `guest-…` and watch the row appear.

## Why the token matters

The webhook is anonymous by necessity — Ko-fi cannot sign a request. The verification token inside
the payload is the only proof a delivery came from Ko-fi. Without it, anyone could POST a donation
and mint themselves credit. The handler refuses on mismatch with `401`, which is tested.

## What is deliberately not credited

`Subscription`, `Shop Order` and `Commission` deliveries are acknowledged and ignored. Those are
sales, not gifts, and silently turning them into prepaid credit would blur the very line
`PAYMENTS.md` draws. If a paid tier ever exists it gets its own webhook and its own terms.

## Honest limits

- Amounts arrive in the donor's currency; the handler treats the number as dollars and stores the
  currency in the note. For coffee-sized gifts that rounding is harmless; at scale it is not.
- A donation with no note and no public email becomes `unmatched:<tx>` — visible, reassignable, not lost.
- Refunds are manual: Ko-fi reports them, the ledger does not auto-reverse.
