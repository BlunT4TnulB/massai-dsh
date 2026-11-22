# Money: what disclosure buys you, and what it does not

The owner's question: if we disclose the top-up price, and offer "top up" and "donate" as two
buttons, is a lawsuit avoidable?

Short answer: **disclosure removes the misleading-advertising risk. It does not remove the
obligations that come from selling.** The two buttons are only safe if the two things are genuinely
different in law — which means they have to be different in accounting too, not just in the layout.

## What each path actually is

| | **Donation** (Ko-fi) | **Top-up** (selling credit) |
|---|---|---|
| Legal character | a gift | a sale of goods/services |
| Refund rights | none by default | consumer rights apply |
| Chargebacks | rare, painful | common, and you lose the credit too |
| Tax | not business income | income; GST/HST once past the small-supplier threshold |
| Price display | not applicable | **all-in price inclia fees** (drip pricing is prohibited in Canada) |
| Prepaid balance law | not applicable | applies: expiry must be disclosed and reasonable |
| Merchant of record | no | **yes — you** |
| Privacy | donor is a person | buyer is a customer: receipts, records, retention |

So the honest answer: **two buttons + a price is not a shield; it is a shop with good signage.**

## The shape that keeps it small

1. **Donation path stays a gift.** No product, no promise. Already built at `/support`.
2. **If you ever sell, sell through a merchant of record** — Paddle, Lemon Squeezy, Polar. They
   become the seller for tax purposes, handle VAT/GST/sales-tax registration, and take their cut
   for it. You get a payout and none of the global tax paperwork. That single decision removes the
   most expensive obligation a solo operator can inherit.
3. **Sell the workshop, not the tokens.** A monthly price for the app (persistence, shelf, support)
   is a service with a clear value. "Tokens at a 5 % markup" is a resale business with a 3 % margin
   and a 3 % card fee — see `BUSINESS.md`.
4. **Every price shown must be the total.** $10 means $10 including fees, in the buyer's currency,
   with what they get stated next to it.
5. **Write the refund line before you take a dollar.** "Unused credit is refundable within 14 days"
   costs nothing and removes the angriest class of complaint.

## What actually creates lawsuits at this scale

Not price confusion. In descending order of likelihood:

1. **A user builds something harmful and it has your name on it.** Protect with the AUP, a notice
   channel, and the ability to take it down in minutes.
2. **A takedown arrives and you ignore it.** Answer every one, fast, even to say "looking".
3. **Privacy complaint** — a regulator letter rather than a courtroom, and it starts with someone
   being unable to delete their data. That route now exists (`/api/account/erase`).
4. **Provider terms breach** — account termination, not a writ.
5. **Chargebacks and fraud** — a loss, not a suit.
6. **Trademark** — the cheapest one to prevent, by not using anyone's brand as your own.

## Personal exposure

If money flows and the thing breaks, a sole proprietorship has no wall between the business and your
personal assets. Incorporation is the only real shield, and it costs a few hundred dollars a year.
Until then: keep the money path a gift, keep the caps tight, and keep the disclosure loud.
