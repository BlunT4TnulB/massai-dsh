# Massai Assist — the answer to a held button

An Android app whose only job is to be the **assist app**. Hold the assistant button (or whatever
gesture your phone uses for its assistant) and Massai opens, listens to one sentence, asks
`https://massai-itu.ca/ask`, and speaks the answer.

It is four screens' worth of code and no libraries: a WebView at `/ask?assist=1`, the system speech
recogniser for the question, and the system voice for the answer. There is no background listening,
no wake word, and no account needed to try it.

## Build

```sh
cd android/assist
gradle assembleDebug          # unsigned, installable on your own device
```

Or dispatch **Build APK** (`.github/workflows/android.yml`) and download the `massai-assist` artifact.
If `SIGNING_KEYSTORE_BASE64`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD` and `SIGNING_STORE_PASSWORD`
are set as repository secrets, the release build is signed with the same key as the wrapper.

## Make it the assistant

1. Install the APK (it also appears as a normal app called Massai).
2. **Settings → Apps → Default apps → Assist & voice input → Assist app → Massai.**
   On Samsung the path is *Settings → Apps → Choose default apps → Digital assistant app*; on Pixel it
   is *Settings → Apps → Default apps → Digital assistant app*.
3. Hold the assistant gesture. Massai opens listening; ask; the answer is spoken.

If the phone's picker only lists Google, the device wants a `VoiceInteractionService` alongside the
assist activity — that is the next piece of Android work, not a change to the web app.

## What it deliberately does not do

- no background microphone, no wake word, no always-listening
- no local storage of questions; the answer comes from the same capped endpoint as the web page
- no analytics
