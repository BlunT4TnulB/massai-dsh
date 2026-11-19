# Massai landing / sign-in copy

The hosted link's "spoon-fed" onboarding. The emotional job of every line:
**spending a little on DeepSeek feels GOOD — a tiny bit of money that goes a long,
long way.** No jargon, no cost anxiety.

## Hero

> **Describe it. It gets built. The unknown is possible.**
> A tool. A site. An app. A workflow. A whole product — or the thing that doesn't exist
> yet. No templates. No ceiling. Whatever you can put into words, Massai shapes
> with you and hands back running — powered by DeepSeek.

## The "feel good" pitch (why paying feels great)

> **Here's the part you'll actually enjoy: it barely costs anything.**
>
> A few dollars on DeepSeek goes a *long* way — most people build for weeks on
> what a single coffee costs. No subscriptions. No "pro tier." Just your ideas,
> priced at cost by the friendliest model shop in AI.
>
> **You're not paying a bill — you're fueling your own ideas.** And they're
> cheaper to fuel than anything else out there.

## Pricing comparison (the "a little goes a long way" table)

> **The same kind of AI that powers the expensive assistants — for pocket change.**

| | What your few dollars buy |
|---|---|
| **DeepSeek** | 💸 **weeks of building** — rates ~10–20× cheaper than the big names |
| ChatGPT / Claude / Gemini | 💰 the same money, gone in an afternoon |

> *Current per-token rates live at platform.deepseek.com — but the story is
> always the same: DeepSeek is dramatically cheaper.*

## Sign-in / top-up moment

> **Grab a DeepSeek key — takes one minute, and $5 will carry you a long way.**
>
> Head to **platform.deepseek.com/api_keys**, top up a few dollars, paste your
> key here. That's it — your key, your build, your cost (which is tiny).
>
> *(owner-pays guest mode:)*
>
> **Just start building** — a trial allowance is on us. Bring your own DeepSeek
> key anytime to keep going for pocket change.

## Disclaimer (required on the sign-in action)

> By continuing you're signing in to DeepSeek; your usage is billed to your
> DeepSeek account at their published rates. Massai never sees or stores your
> payment details.

## Conversation collection (transparency note for the UI)

> **Every conversation you have here is automatically saved** — your chats,
> builds, and ideas are collected in your session history as you go. Open the
> sidebar anytime to review, continue, or revisit anything you've built. Your
> history is yours, stored on this service, never shared.


## Future ideas (parked, not scheduled)

- **Visitor feedback/reviews** — a section on the welcome page where people leave
  comments or send their email; a semi-live "dashboard" for the owner to watch
  them arrive (friendly, optional, never forced). Design notes: keep it light —
  a smiley-rating + one-line comment + optional email, rendered into a small
  owner dashboard (maybe a `/feedback` page or a plain file inbox).

## Future ideas (parked, not scheduled) — continued

- **Guided tour of usability** — the first-run experience splits into two modes:
  - **Newbie mode**: a warm tutorial — "tell me what you're trying to do, I'll
    walk you there" with big clickable cards for the common needs: build an app,
    connect a GitHub repository, open a folder/workspace, share a link.
  - **Easy mode (experienced)**: the same cards collapsed into a compact quick-
    actions bar so power users skip the tour but keep the shortcuts.
  - Common-use-case cards act as *oriented prompts* — clicking "Connect GitHub"
    runs the real handshake flow, "Open a folder" opens the workspace picker,
    etc. No browsing, no scrolling: the tour IS the usability.
  - DSH already ships `client-ui-creation-recommendations` (the creation
    suggestions) — the guided tour should build on that mechanism, not replace it.
