# TellMore AI — native mobile shell (Capacitor)

A thin native app that loads the live web app (`https://www.tellmoreai.com`) in
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
3. Open the finished run → **Artifacts** → download **tellmoreai-android-apk**
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

App identity: id `com.tellmoreai.app`, name **TellMore AI** (changed from
`com.getvoicium.app` on 2026-09-17 with the move to tellmoreai.com). Android
treats a new id as a different app: it installs NEXT TO the old one, so users
uninstall the old "getvoicium" app once. `google-services.json` holds both ids
(same Firebase project `getvoicium`, whose id Google never lets us rename);
the build picks the entry that matches `appId`.

## What the shell adds to the website (2026-09-21)

Full write-up, causes and master prompts: `docs/mobile-app-fixes-2026-09-21.md`.

- **Logins come back to the app.** Channel and Google Calendar logins open in a
  browser sheet (`@capacitor/browser`) and end on `tellmoreai://connected…`,
  which `scripts/patch-manifest.mjs` registers on MainActivity. The web side is
  `src/lib/app-return.js`, `/api/app/connect`, `src/lib/connect-page.js` and
  `src/app/dashboard/components/native-connect.js`.
- **A new install starts signed out.** The manifest patch turns Android backup
  and device transfer off, so the WebView's stored session is never restored.
- **Splash → app with no white frame.** `@capacitor/splash-screen` holds the
  splash (4 s ceiling) until the web app calls `hide()`.
- **Voice messages** are recorded by the phone (`capacitor-voice-recorder`,
  **pinned to 6.0.3** — 6.1.0 needs Capacitor 7) as AAC.
- **Icon and splash**: white mark on the brand maroon (`scripts/gen-assets.mjs`).
- **Light / dark with the phone.** The page follows the phone by itself
  (`src/lib/theme-pref.js`); `scripts/patch-manifest.mjs` steps 5–6 make the
  status and navigation bars do the same — colours from `values/` and
  `values-night/`, and a `MainActivity` that repaints them when the mode changes
  with the app open (the template keeps `uiMode` in `configChanges`, so the
  activity is not restarted and the page is not reloaded).
- **Opening animation** is web code (`LaunchScreen` in
  `src/app/dashboard-client.js`): it releases the native splash after its first
  frame and is held ~1.65 s only inside the app.

## Follow-ups (not done yet)
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
