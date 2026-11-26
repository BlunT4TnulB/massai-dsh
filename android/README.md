# Android wrapper

The Android app is a **Trusted Web Activity**: a Play-Store-shaped shell around
`https://massai-itu.ca/mind`. The wrapper configuration lives here so the whole project is one
repository; the long-form instructions are in [`../docs/android/`](../docs/android/).

- `twa-manifest.json` — package id `ca.massai.mind`, host `massai-itu.ca`, start `/mind`, fullscreen.
- `assetlinks.json.template` — the fingerprint proof Android needs; served by this server at
  `/.well-known/assetlinks.json` from the `ANDROID_ASSETLINKS` environment variable.
- Build: Actions → **Build APK** (manual). Without secrets it produces an unsigned APK for sideloading;
  with a keystore it signs. The four remaining owner steps are in
  [`../docs/android/TODO-APK.md`](../docs/android/TODO-APK.md).

iOS has no equivalent — Apple permits no web-based screensaver, so a fullscreen PWA is the ceiling there.
