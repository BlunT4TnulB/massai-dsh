# Massai on every device

The assistant is `/assist` — the mind full screen, a box, and answers spoken by the sphere.
Everything below points at the same endpoint, so the caps, sources and honesty are identical.

## Android — the held button (built)

`android/assist/` is a 10 KB app whose only job is to be the **assist app**.

1. Install `massai-assist.apk` (CI: *Build APK → assist*, or `gradle assembleDebug`).
2. **Settings → Apps → Default apps → Assist & voice input → Assist app → Massai**
   (Samsung: *Settings → Apps → Choose default apps → Digital assistant app*).
3. Hold the assistant gesture: it opens listening, you ask, the mind answers aloud.

If the picker only lists Google, the device is asking for a `VoiceInteractionService`; that is the next
Android piece, and it does not change the web side.

## iOS — Siri and the Action button

iOS does not allow a third-party default assistant, but it does allow a shortcut:

1. Shortcuts app → **New Shortcut** → *Open URLs* → `https://massai-itu.ca/assist`
2. Add it to the Home Screen, or to **Action Button** (iPhone 15+), or say
   *"Hey Siri, Ask Massai"* after renaming the shortcut.
3. For a spoken question without opening the box: *Dictate Text* → *URL Encode* →
   `https://massai-itu.ca/ask?q=<encoded text>` → *Open URLs*.

## Desktop — an app that answers

1. Open `https://massai-itu.ca/assist` in Chrome, Edge or Safari.
2. **Install / Add to Dock** (it installs fullscreen because the manifest says so).
3. A keyboard shortcut to that window is the whole feature: macOS *Shortcuts → New → Open URL →
   Add Keyboard Shortcut*; Windows *PowerToys → Keyboard Manager → Remap a key* to open the URL.

## Any browser — Massai as a search engine

`https://massai-itu.ca/opensearch.xml` is published. Chrome and Edge usually offer it automatically as
**"Massai"** site search; after adding it, typing `massai what is cardamom` in the address bar opens the
answer page. Firefox: *Settings → Search → Add*.

## What is free for whom

| who | questions a day | pace | length |
|---|---|---|---|
| anyone (guest) | 8 | 20 s | brief |
| signed in | 60 | 8 s | balanced |
| the operator | 300 | 3.5 s | balanced or deep |

Every answer names its source when the source actually fits the question, and says nothing when it does
not. The price is printed on the page: about **six hundredths of a cent** a question.
