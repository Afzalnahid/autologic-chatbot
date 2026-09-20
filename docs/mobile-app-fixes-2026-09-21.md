# Android app — six problems, their causes, and the fix (2026-09-21)

Reported by the owner from the installed app. Each entry: what was seen, the
**verified** cause (file and line of reasoning), where it is fixed, how to check
it on a phone, and a **master prompt** that reproduces the fix from scratch.

How the app works, in one paragraph: `mobile/` is a Capacitor 6 shell whose
WebView loads the live site (`capacitor.config.json → server.url =
https://www.tellmoreai.com/dashboard`). Capacitor injects its bridge into that
remote page, so the web code reaches native plugins through
`window.Capacitor.Plugins.*`. **Web changes reach the app by themselves; anything
in `mobile/` or the workflow needs a new APK** (GitHub → Actions → *Build Android
APK* → Run workflow). Problems 1, 2, 5 and 6 need the new APK to be complete;
the web half of every fix is backwards compatible with the old APK.

| # | Problem | Needs new APK |
|---|---------|---------------|
| 1 | Connecting a channel ends in the phone's browser, and the app logs out | yes (web half ships now) |
| 2 | Google Calendar connect: the same | yes |
| 3 | A fresh install opens already signed in | yes |
| 4 | Opening the app shows a bare icon, then a white page | partly (launch screen ships now) |
| 5 | The launcher icon looks small and undefined | yes |
| 6 | Voice message: "microphone permission needed" although it is granted | yes (clear errors ship now) |

---

## 1 · Channel connect leaves the app, and the app logs out

**Seen.** Tap *Connect* → Facebook/Instagram/WhatsApp opens in Chrome → the
connection finishes in Chrome, on a web dashboard that is not signed in → back
in the app the owner is signed out.

**Cause — two separate bugs.**
1. *Leaving the app.* `ConnectChannel` (`src/app/dashboard-client.js`) called
   `window.open("/api/fb/login…")`. A Capacitor WebView has no second window, so
   that **replaced the dashboard** with the login route; the route 302s to
   `facebook.com`, which is not the app's host, so Capacitor handed it to the
   phone's browser. Meta (and Google) refuse to run OAuth inside a WebView, so
   the browser is unavoidable — but nothing ever brought the owner back:
   `connect-page.js` ends at `/dashboard?connected=…` **in Chrome**.
2. *The logout.* The connect screens are `stage === "connect" | "connect-cal"`.
   For those stages `dashboard-client.js` registered a back-button handler
   written for first-run signup: *"back means I changed my mind → sign out"*.
   The same screens open from the **Channels tab** for an owner who has used the
   app for months, so the back presses that brought them home from Chrome ran
   into that handler and signed them out.

**Fix.** The pattern every professional app uses (AppAuth, RFC 8252):
- The app opens the login in a **browser sheet over itself** — Chrome Custom
  Tab via `@capacitor/browser` — `native-connect.js → openConnect(path)`.
- The sheet's first stop is `GET /api/app/connect?to=<login path>`
  (`src/app/api/app/connect/route.js`): it checks `to` against the five login
  routes (`safeConnectTarget`, no open redirect), sets a 20-minute
  `tm_app=1` cookie in the sheet, and redirects on.
- The last page of every flow is `connectedPage()` / `connectFailedPage()` in
  `src/lib/connect-page.js`. With the cookie present they answer **302 →
  `tellmoreai://connected?platform=…&name=…`** (or `connect-failed?…reason=`)
  and clear the cookie. Nothing secret is ever in that address.
- `mobile/scripts/patch-manifest.mjs` registers the `tellmoreai://` scheme on
  `MainActivity` (singleTask, so the running app receives it and the sheet
  closes). `initNativeConnect()` listens to `appUrlOpen` (and `getLaunchUrl`
  for a cold start) and posts the **same messages the popup flow posts**
  (`fb_connected`, `{type:"al-connected"}`…), so every connect screen works
  unchanged.
- The sign-out handler now applies only to a real first run
  (`everInApp` ref): once the owner has reached the app, back on a connect
  screen returns to the app.
- Pure logic + tests: `src/lib/app-return.js`, `tests/t-app-return.mjs` (21).

**Check on a phone (new APK).** Channels → Add → Facebook → the login slides up
*over* the app → finish → the sheet closes by itself and the Channels tab shows
"connected". Press Back on the connect screen: you land in the app, signed in.

**Master prompt.**
> In this Capacitor app the WebView loads the live site. Channel logins
> (`/api/fb/login`, `/api/ig/login`, `/api/wa/embedded`, `/api/wa/login`) must
> never navigate the WebView. Implement the AppAuth pattern: (1) add
> `@capacitor/browser`; in the web code, when `Capacitor.isNativePlatform()` and
> the Browser plugin exists, open `/api/app/connect?to=<path>` with
> `Browser.open` instead of `window.open`; otherwise keep the popup. (2) Add
> `GET /api/app/connect`: whitelist `to` to those exact same-origin paths, set a
> short-lived `Secure; HttpOnly; SameSite=Lax` cookie, 302 to `to`. (3) In the one
> module every flow ends in (`src/lib/connect-page.js`), if that cookie is
> present return `302 Location: tellmoreai://connected?platform&name` (failure:
> `connect-failed?platform&reason`), clearing the cookie; never put a token in
> the URL. (4) Register the `tellmoreai` scheme on MainActivity in the CI
> manifest patch and fail the build if MainActivity is not singleTask. (5) In
> the app, on `App.appUrlOpen` / `getLaunchUrl`, parse the URL, close the
> browser, and `postMessage` the exact events the popup flow already posts.
> (6) Find every back-button handler that signs the user out and make sure it
> only runs during first-run signup. Put the URL building/parsing and the
> whitelist in a pure module with tests, including open-redirect attempts.

---

## 2 · Google Calendar connect: leaves the app, logs out

**Cause.** The same two bugs: `ConnectCalendar` (onboarding, `stage
"connect-cal"`) and `Bookings.js → connectCal` both used `window.open(
"/api/gcal/login…")`. Google shows *disallowed_useragent* in a WebView, so it
went to Chrome and never came back; the onboarding variant also had the
sign-out back handler.

**Fix.** Both now call `openConnect("/api/gcal/login?client_id=…")` first;
`/api/gcal/callback` already ends in `connectedPage({platform:"gcal"})`, so it
returns on `tellmoreai://connected?platform=gcal`, and the app posts
`gcal-connected`, which both screens already listen for.

**Check.** Bookings → Connect Google Calendar → sheet → allow → back in the app,
"Connected as …" shown, still signed in.

**Master prompt.** *As problem 1, for `/api/gcal/login`: route every
`window.open` of it through `openConnect`, and confirm the callback ends in the
shared connected page so it inherits the app return.*

---

## 3 · A fresh install opens already signed in

**Cause.** Capacitor's template manifest ships `android:allowBackup="true"`.
Android's Auto Backup uploads the app's data directory — which **contains the
WebView's localStorage, i.e. the Supabase session** — and restores it when the
app is installed again on the same Google account. So "uninstall → install"
came back signed in. (Installing a new APK *over* the installed one keeps the
data by design; that is an update, and every app stays signed in through it.)

**Fix.** `patch-manifest.mjs` sets `allowBackup="false"`,
`fullBackupContent="false"` and `dataExtractionRules` pointing at a generated
`res/xml/data_extraction_rules.xml` that excludes every domain from both cloud
backup and device-to-device transfer (the Android 12+ path, which ignores
`allowBackup`).

**Check.** Install the new APK, sign in, uninstall, install again → the sign-in
screen. (Once, to clear an already-restored session: Settings → Apps → TellMore
AI → Storage → Clear data.)

**Master prompt.**
> A WebView-based Android app restores its login after reinstall. Disable
> Android Auto Backup and device transfer for the whole app in the CI manifest
> patch: `allowBackup=false`, `fullBackupContent=false`, and a
> `data_extraction_rules.xml` excluding root, file, database, sharedpref and
> external for both `<cloud-backup>` and `<device-transfer>`. Make the patch
> idempotent, fail the build if `<application>` is missing, and test it against
> the real `@capacitor/cli` Android template. Do not sign users out on update.

---

## 4 · Opening the app: a bare icon, then a white page

**Cause.** The splash was the default (small plum outline on white) and hid
itself on a timer; the WebView then showed **nothing** while the remote page
loaded, because `dashboard-client.js` returned `null` until the session check
finished, and the first data load said "Loading from Supabase…".

**Fix.** One continuous picture from tap to app:
- splash = the maroon tile with the white mark on the app's own background
  (`gen-assets.mjs`; light `#FCFCFD`, dark `#0B0B0E`);
- `@capacitor/splash-screen` keeps it up (max 4 s, so an offline phone is never
  stuck) and the web app calls `hideNativeSplash()` the moment the sign-in
  screen or the app is ready (`authChecked`), with a 250 ms fade;
- the web app's own `LaunchScreen` (same tile, wordmark, a thin moving line)
  replaces the `null`, so there is never a white frame; the loading text is
  "Loading your workspace…".

**Check.** Cold-start the app: tile → the same tile with a moving line → the
app. No white flash, in light and dark mode.

**Master prompt.**
> Make app start feel native: brand splash (solid tile + white mark on the
> app's background colour, light and dark), `@capacitor/splash-screen` with
> `launchAutoHide:true` and a 4 s ceiling, and have the web app call
> `SplashScreen.hide({fadeOutDuration:250})` when its first real screen is
> ready. Replace every `return null` loading state in the shell with a launch
> screen that matches the splash pixel for pixel, respects reduced motion, and
> never names an internal service.

---

## 5 · The launcher icon looks small and undefined

**Cause.** `gen-assets.mjs` drew the plum **outline** on a **white** adaptive
background at 1.0×. Launchers crop an adaptive icon to its centre 72/108 and
mask it; a thin drawing in a white disc reads as small and empty.

**Fix.** Background: the brand maroon, edge to edge. Foreground: the mark in
white at 1.15× (its ellipse 273 × 194 sits inside the 333-radius mask on every
launcher shape). `capacitor-assets` is told the same colours. Previewed masked
as a circle and a squircle at 144 px and 48 px before shipping.

**Master prompt.**
> Redraw the Android adaptive icon so it reads at 48 px: full-bleed brand colour
> background layer, single-colour (white) mark on the foreground layer scaled to
> the largest size that stays inside the 66/108 safe circle for the mark's real
> outline (compute it), and render a masked preview (circle, squircle, 48 px)
> before committing. Keep the notification icon a white silhouette.

---

## 6 · Voice message: "microphone permission needed" though it is granted

**Cause.** `Conversations.js → toggleRec` wrapped **everything** —
`getUserMedia`, `new MediaRecorder(stream,{mimeType})` and `rec.start()` — in
one `catch` that always said "Microphone access denied". That much is verified
in the code: **any** failure was reported as a permission problem, so the
message the owner saw says nothing about the real fault. With the permission
granted, the likely fault is the recorder itself (the code preferred
`audio/mp4`, which an Android WebView can report as supported and still fail to
record) — it could not be confirmed without a device log, which is exactly why
the errors are now specific. WebView recording is also a poor fit for the
channels: WhatsApp does not accept WebM at all.

**Fix.**
- In the app the **phone** records: `capacitor-voice-recorder` (pinned to
  **6.0.3** — 6.1.0 needs Capacitor 7) → AAC, which Messenger, Instagram and
  WhatsApp all accept. `requestAudioRecordingPermission()` → `startRecording()`
  → `stopRecording()` → base64 → `File` → the existing `/api/send-media`.
  A refusal names the exact Settings path.
- In a browser: `getUserMedia` and the recorder are separate steps with
  separate messages (blocked / no microphone / in use / cannot record), and the
  container is the first one the browser really supports.
- First launch asks for the microphone through the plugin.

**Check (new APK).** Open a chat → mic → speak → stop → the customer receives a
voice message; deny the permission in Settings → the message says where to
allow it.

**Master prompt.**
> Voice recording fails in a Capacitor WebView with a misleading "permission"
> error. (1) Split the try/catch: report `getUserMedia` errors by
> `error.name`, recorder errors separately. (2) In the native app record with a
> native plugin that produces AAC/M4A (check the plugin's peerDependencies
> against the project's Capacitor major and pin the exact version), convert its
> base64 to a `File` with the right MIME and extension, and reuse the existing
> upload route. (3) Ask for the microphone through that plugin on first launch.
> (4) Keep the browser path working and choose the MediaRecorder container by
> trying `isTypeSupported` in order.

---

## Build and install

1. GitHub → **Actions** → *Build Android APK* → **Run workflow** (5–10 min).
2. Download the artifact, install it **over** the current app (same signing
   key, `mobile/debug.keystore`), and run the six checks above.
3. If the build fails, the log names the step. The manifest patch was run
   against Capacitor 6.2.2's real template here (idempotent, well-formed XML,
   two intent filters on MainActivity); the plugin versions were checked against
   npm (`@capacitor/browser ^6.0.6`, `@capacitor/splash-screen ^6.0.4`,
   `capacitor-voice-recorder 6.0.3`). **The APK itself was not built or run on a
   device from this machine** — there is no Android SDK or `gh` here.
