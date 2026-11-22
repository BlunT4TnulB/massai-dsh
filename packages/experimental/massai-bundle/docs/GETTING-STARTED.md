# Getting started with Massai — the easy version

No jargon. No install. About five minutes, and a few dollars of credit goes a
long way.

---

## What this is

Massai is a place where you describe what you want built, and an AI agent builds
it with you. You type in plain English. It reads the files, writes the code, runs
things, and shows you the result.

The intelligence is DeepSeek's. The workshop is ours. **You bring your own
DeepSeek key**, so the usage is billed to you at DeepSeek's published rates — we
never see your card, and we are not a middleman skimming your tokens.

---

## Step 1 — Get a DeepSeek key (3 clicks)

1. Open **https://platform.deepseek.com/sign_up** and make an account (Google
   sign-in works).
2. Open **https://platform.deepseek.com/api_keys** and press **Create new
   key**. Name it anything, e.g. `massai`.
3. Copy the key. It looks like `sk-…` and you will only see it once.

That key is your password to the AI. Keep it like a password.

---

## Step 2 — Add a little credit

Open **https://platform.deepseek.com/top_up**.

A few dollars is genuinely enough to build for weeks — a typical session costs
cents, not dollars. Two things make it go further:

- **Build during DeepSeek's off-peak window.** It is a discount: the same work at
  a lower price. Massai's **Rates** page shows the window in *your* time zone.
- **Use the cheap model for normal work.** Massai starts you on it and only
  switches to the strong model when a job actually needs it — you will see a note
  in the chat when that happens.

---

## Step 3 — Open Massai and paste the key

1. Open **https://massai-itu.ca**
2. Paste your key into the box and press **Sign in**.
3. You are in. If you happen to be signed in with Google, it can use your
   account instead of a pasted key — but the key is the universal path.

> **First visit may take up to a minute.** The free hosting sleeps when nobody is
> using it; it wakes when you arrive. Leave the tab open.

---

## Step 4 — Say what you want

Press the guided start (**"What would you like to make?"**) or just type. Good
first prompts:

- *"A one-page site for my motorcycle repair shop. Dark, simple, with hours and
  a phone number."*
- *"A tool that turns a folder of photos into a contact sheet PDF."*
- *"Fix the error in this file: `<paste it>`"*
- *"Open my GitHub repo and add a README that explains it."*

You do not need to know anything about code. If you are unsure, say what you
want in your own words — including the vibe ("calm", "looks expensive",
"like Apple").

---

## What happens to your work

- Your conversations live in the app while it is running.
- **Notes you leave for the owner are read.** There is a small note box; it is
  not a black hole.
- There is an **export** for notes, so nothing has to be lost.

## If something goes wrong

| What you see | What it means | Do this |
|---|---|---|
| "Invalid API key" | The key was mistyped or was deleted | Make a new key on DeepSeek and paste it again |
| Page is blank for a while | The free host is waking up | Wait 30–60 seconds, reload |
| "Insufficient balance" | DeepSeek credit ran out | Top up a few dollars |
| Model switch note in chat | Normal. The agent moved to the cheaper model, or to one that can see your image | Nothing — it explains itself |
| Image rejected | The model you picked cannot see pictures | Pick the cheap model, or let Massai switch (it does this automatically) |

---

## Advanced (optional): an agent that runs on your own computer

If you want the AI on your own machine — free per message, works offline — there
is an easy mode. It is optional, and it is for a computer with **8 GB of RAM or
more**; don't run it on the same machine as a big app that is already using memory.

```bash
./tools/massai-local.sh          # installs the model runner, a small model, and a gateway
./tools/massai-local.sh --check  # look without changing anything
./tools/massai-local.sh --stop   # turn it off
```

The script checks your memory first, explains what it will do, and only reports
success after a real test prompt comes back. Full details:
[LOCAL-AGENT.md](LOCAL-AGENT.md).

---

## The shortest possible version

1. DeepSeek → make a key → add $5.
2. Massai → paste the key.
3. Type what you want.

That is the whole thing. Everything else is optional.
