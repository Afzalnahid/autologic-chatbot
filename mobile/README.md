# getvoicium — native mobile shell (Capacitor)

A thin native app that loads the live web app (`https://www.getvoicium.com`) in
its **own** WebView. Unlike the earlier TWA, it does **not** depend on the
phone's default browser being Chrome, so it no longer gets stuck on the splash
screen on phones where another browser is the default.

**This folder is completely isolated from the web app.** It has its own
`package.json` and is invisible to the Next.js build and to Vercel — nothing here
changes or can break the running website.

## How the app is built (free, in the cloud — no installs)

Building happens on GitHub Actions, not on anyone's machine:

1. On GitHub, open the repo → **Actions** tab → **Build Android APK** →
   **Run workflow**.
2. Wait ~5–10 minutes for it to finish (green tick).
3. Open the finished run → **Artifacts** → download **getvoicium-android-apk**
   (a `.zip` containing `app-debug.apk`).
4. Unzip, send the `app-debug.apk` to any phone (WhatsApp, Drive, link). On the
   phone, allow "install unknown apps" and tap to install.

The APK is **debug-signed**, which is fine for sharing and testing. It installs
alongside anything else and loads the live site, so a normal `git push` to the
website keeps the app up to date too — only the app's name/icon/id need a rebuild.

## What it loads

`capacitor.config.json` sets `server.url` to the live site, so the app is always
the current website in a WebView it controls. `www/index.html` is only a
placeholder loading screen required by the build; it is not the real UI.

App identity: id `com.getvoicium.app`, name **getvoicium** (separate from the old
TWA `com.getvoicium.www.twa`, so both can coexist during testing).

## Follow-ups (not done yet)

- **Branded app icon.** The first build uses Capacitor's default icon. Add the
  getvoicium logo via `@capacitor/assets` (needs a 1024×1024 source) in a later
  pass.
- **Release signing / Play Store.** For a store build, generate a release
  keystore, add it to repo **Settings → Secrets**, and switch the workflow to
  `assembleRelease` with signing. Keep that keystore safe — losing it blocks all
  future updates (same rule as the PWABuilder key).
- **iOS.** Capacitor can also produce an iOS project, but building it needs a
  Mac + Xcode + an Apple Developer account ($99/yr). Defer.

## Signing (why updates install over each other)

`mobile/debug.keystore` is the app's signing key. CI creates it the first time
(and commits it), then every build signs with it, so a new APK installs OVER
the old one on a phone. A debug key is not a secret — standard Android practice —
but if it is ever deleted or regenerated, every phone must uninstall and
reinstall once (Android refuses a build with a different signature). For a
Play Store release generate a separate release key (or let Play App Signing
manage one) and keep it in repo Secrets, never in git.
