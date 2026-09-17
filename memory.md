# getvoicium — Working Memory  (the product was named Autologic until 2026-09-01)

Update the top two sections after every session.

---

## Last session (2026-09-10, latest) — Admin drawer refreshes in place; reply-turn SQL found ALREADY applied

- `90c7216` — **admin client drawer now updates AT ONCE after an action** (plan change /
  extend / suspend). `run()`'s list refresh only patched the top badge (`detail.client`);
  the Subscription card, usage and dates come from `/api/admin/client-detail` and had to
  be re-fetched. `act()` is now async and, when the acted-on client's drawer is open,
  calls `openDetail(id, true)`; the new `silent` flag on `openDetail` skips the loading
  spinner so the drawer updates in place instead of flashing. Admin-only, no tenant/
  business-type surface, no client_id leak. 40/40 suites, JSX parses, **Vercel READY**
  (live on www.getvoicium.com). This was an uncommitted change already in the working tree
  at session start (provenance unknown, lessons #9/#12) — owner decided to keep + commit it.
- **CORRECTION — `docs/sql/2026-09-08-reply-turn.sql` is ALREADY APPLIED in production.**
  Earlier notes list it as an open owner task ("must run it… until then usage counts
  customer messages via fallback"). Verified live against project `cchvsgouqqxibhubioch`:
  the `reply_turn` boolean column (default false, NOT NULL) AND the partial index
  `message_buffer_reply_turn_idx` (client_id, created_at) WHERE reply_turn BOTH exist,
  and **91 rows are flagged reply_turn=true** (of 551 bot rows), last flag 2026-09-09. So
  usage has been counted on the real per-bot-reply basis since then, not the fallback.
  **This item is OFF the open-tasks list.** (Supabase MCP `execute_sql`/`apply_migration`
  is available this session and CAN run DDL — so the old "owner must run SQL by hand, the
  service key can't DDL via JS" constraint no longer binds; migrations can be applied from
  here with the owner's go.)

Found-in-passing (NOT fixed): the admin login screen still uses `T.gold` (admin-client.js
~165–172) — brand invariant says gold is dead. Pre-existing, internal super-admin console.

### BYOK price list — BUILT this session, NOT yet pushed or migrated

Owner's long-open task ([[byok-separate-price-list]]). Design the owner chose: a
**separate lower price per tier, on ALL paid tiers**, Shop = Service. A client on
their own AI key pays less because they cover their own AI cost. Prices
(monthly/yearly): Starter ৳1000/10000, Growth ৳2500/25000, Scale ৳4000/40000
(vs standard 1500/15000, 3500/35000, 6000/60000). Built in four stages, all
local, **41/41 suites, every changed file parses** (JSX via Next babel):

- **Data + core:** `byok_monthly`/`byok_yearly` columns
  (`docs/sql/2026-09-10-byok-prices.sql`, add-if-missing + seed-if-null, safe to
  re-run); `byokMonthly`/`byokYearly` on the 6 paid plans in `src/lib/plans.js`
  + two pure helpers there — `planPrices(plan,cycle)` and
  `priceForClient(plan,cycle,ownKey)` (BYOK price only when key AND package set
  one >0, else standard; never 0, never the low price without a key). Exposed via
  `fromConstant`/`limitsFor` in `plan-limits.js` and in `/api/plans`.
  `tests/t-byok-price.mjs` (35).
- **Server pricing:** `clientHasOwnKey(clientId)` in `src/lib/ai.js` (same test
  `getClientAI` routes on — saved Google key in `client_ai`, no decrypt; a
  failing key still counts; fails closed). `/api/billing` GET returns `own_key`;
  `POST /api/billing` and `/api/billing/checkout` both price server-side with
  `priceForClient` so the amount can't be forged.
- **Client UI:** `Billing.js` shows the reduced price + struck-through standard +
  a neutral "you're on your own key" note (NOT mint — invariant; NOT gold);
  `pricing-client.js` shows an informational own-key line per paid card and the
  COMPARE "Use your own AI key (lower price)" row now true for all paid tiers;
  `ui.js` PLAN_LIST fallback carries byok too.
- **Admin editing:** Packages → Edit → "Own-key price (BYOK)" two boxes
  (`Packages.js`); `save_plan` in `/api/admin/packages` persists `byok_monthly`/
  `byok_yearly` via `int()` (blank → NULL). Docs: `architecture.md` → "The
  own-key (BYOK) price list".

Note the consequence flagged to the owner: own-key is usable on ANY tier the
admin grants (no `features.byok` gate enforced at runtime), so the public
COMPARE row was widened from Scale-only to all paid tiers to match.

**SHIPPED (owner approved push + migration):** commits `f17038d` (feature) +
`0a4ae7c` (memory), pushed; **Vercel READY** (commit `0a4ae7c`, live on
www.getvoicium.com); migration applied via Supabase MCP `apply_migration` on
`cchvsgouqqxibhubioch` (success). Verified end-to-end: DB has byok prices on all
6 tiers, and live `/api/plans` returns them. BYOK price list is fully live.

### Plan entitlements — features + usage, visible to admin AND client (shipped this session)

Owner: the client list doesn't show which package a client is on or what
features it has; each client (and the client themselves) should see their
features and how much of each limit is used/remaining. Built in four stages,
**42/42 suites, every file parses**:
- **`src/lib/features.js`** (NO imports — safe in any bundle): `FEATURE_DEFS` (the
  ONE labelled capability list, each tagged with its business type) + pure
  `featureList(features,biz)` and `shapeMeter(key,label,used,limit)`.
  `tests/t-entitlements.mjs` (20).
- **`src/lib/entitlements.js`**: `usageMeters` (one cheap count per meter in
  parallel — messages, products|documents by biz, channels, broadcasts, website
  imports; each fails soft to null) + `entitlementsFor(client)` →
  `{planId, planName, period, features, meters}`. The one shared assembler, so
  admin and client never disagree. NEVER call per list row (count storm).
- **Admin list:** `/api/admin` catalogue now carries each plan's `features`;
  `admin-client.js` `FeatureChips` shows package features as icon chips per row
  (cheap — package-level, no per-client query). Added a "Features" column
  (desktop, non-compact) + chips on the mobile card.
- **Admin drawer:** `client-detail` `subscriptionOf` now returns `features` +
  broadcasts/scrapes meters; the `Subscription` card renders a features on/off
  list + all six meters. `Meter` now shows "—" for an unread count.
- **Client dashboard:** `/api/billing` returns `entitlements`; Profile "Your
  package" card renders used/remaining bars (`PlanMeter`, "N left") + the
  capability features. Old marketing-bullet path kept as a fallback.
- Feature on/off ticks are NEUTRAL (not mint — invariant); usage bars follow the
  existing green→amber→red convention. docs/architecture.md → "What a plan
  includes, and how much is left (entitlements)".

**The one BYOK client — Broker's BD** (client_id a5305b5e-…, shop_growth, verified
own Google key since 2026-08-22, active to 2026-09-19). **No DB change made, and
none needed:** BYOK price is package-level and applies automatically by key
status, so their Billing already shows ৳2,500 and renewal charges it. When the
owner asked to "convert the current period to BYOK", a live query showed
**Broker's BD has NO payment_requests at all** — their shop_growth was set
manually, not purchased, so there was no overpayment to credit. Owner's final
call (2026-09-10): keep the expiry (09-19) as-is, price stays BYOK. Done.

**afzalnahid021@gmail.com cleanup — DONE (confirmed 2026-09-10):** gone from both
auth.users and clients (verified by live query, zero rows). Off the task list.

**Follow-up — DONE:** Packages.js `FEATURES` (the admin toggle list) now derives
from `FEATURE_DEFS` in `src/lib/features.js` (`FEATURE_DEFS.map(d => [d.key, d.label])`),
so the capability labels live in ONE place (lesson #19). The admin byok toggle
label changed "Can use their own AI key" → "Use your own AI key" as a side effect
(harmless). 42/42.

SHIPPED: commits `4d12826` + memory, Vercel READY, live. Verified against live DB
for Broker's BD (shop_growth, ecommerce): features + meters compute correctly
(messages 91/15000, products 3/3000, channels 1/3, broadcasts 0/20, imports 0/200).
No DB migration — reads existing data.

**byok-display fix (`52fa027`, shipped):** the "Use your own AI key" feature now
follows the client's REAL key state (`clientHasOwnKey`), not just the package
flag — a BYOK client on a non-Scale tier (like Broker's BD) was wrongly shown
"off". `featureList(features, biz, {ownKey})` carries the override; entitlementsFor
and the admin drawer both pass it; the admin LIST stays package-level by design
(no per-client query). Test +4 (24). The admin list showing package-level byok
while the drawer/dashboard show the client's real key is intentional (list =
package, drawer/dashboard = this client).

### Native Android app (Capacitor) — replaces the flaky TWA, cloud APK build (`d216732`)

Owner report: the installed TWA opens to just the splash logo forever on ANOTHER
phone, while Chrome on that phone loads the site fine. Diagnosed: a TWA renders
via the phone's DEFAULT browser's Custom Tabs; on a phone where Chrome is not the
default (common on Xiaomi/other brands) it can't hand off and hangs on splash.
Fix path the owner chose: a real native app that carries its OWN WebView.

Built as a **Capacitor WebView shell** — NOT a rewrite, NOT touching the web app:
- Everything lives in an ISOLATED `mobile/` folder (own package.json) +
  `.github/workflows/android-build.yml`. Root package.json / next.config / src
  are untouched, so Vercel builds the identical website (verified: `git status`
  showed only new files). `mobile/capacitor.config.json` sets
  `server.url = https://www.getvoicium.com`, appId `com.getvoicium.app`, name
  "getvoicium", bg `#EEF0F5`; `mobile/www/index.html` is a placeholder loader.
- The workflow (manual `workflow_dispatch` only, so it never runs on web pushes)
  builds a **debug-signed installable APK** on GitHub Actions (free) and uploads
  it as artifact `getvoicium-android-apk`. Node 20 + JDK 17 + Android SDK →
  `npm install` → `npx cap add android` → `cap sync` → `gradlew assembleDebug`.
  Its OWN WebView removes the default-browser dependency.

**⚠️ NOT yet verified — could not run it here** (this machine has no Android SDK
and no `gh` CLI, so the cloud build is untested). The FIRST run on GitHub Actions
is the real test; if it errors, read the Actions log and fix (likely gradle/SDK/
`cap add` details). Owner must trigger it: GitHub → Actions → "Build Android APK"
→ Run workflow → download the artifact → sideload the APK.

**Follow-ups (in mobile/README.md):** branded app icon (default Capacitor icon
for now; needs a 1024² logo via @capacitor/assets), release signing + Play Store
(keystore in repo Secrets, switch to assembleRelease), iOS (Mac+Xcode+$99). Also
note: the app-login gate keys on display-mode standalone/android-app referrer —
a Capacitor WebView may not match, so that gate may not fire in this app (it will
behave like a normal browser session; revisit if the owner wants the app-login
requirement in the native app too).

### Native push (FCM) for the app — the WebView can't do Web Push

The native app's WebView cannot do Web Push (browser limitation), so the existing
web-push stack shows "this browser cannot show push notifications" inside the app.
Added native push via **Firebase Cloud Messaging**, built and verified (42/42), NOT
yet shipped. Owner created a Firebase project (id `getvoicium`, package
`com.getvoicium.app`) and sent `google-services.json` (committed to `mobile/` — it
is NOT a secret, ships in every APK). Pieces:
- **App:** `@capacitor/push-notifications` added; CI copies `mobile/google-services.json`
  into `android/app/` (Capacitor's template applies the google-services gradle
  plugin when the file is present).
- **Server:** new table `fcm_tokens` (`docs/sql/2026-09-11-fcm-tokens.sql`, its own
  table — an FCM token has no p256dh/auth). `src/lib/fcm.js`: `fcmEnabled()`,
  `saveFcmToken`/`removeFcmToken`, `sendFcm` (FCM HTTP v1, auth via
  `google-auth-library` from env `FIREBASE_SERVICE_ACCOUNT`; prunes UNREGISTERED;
  never throws). New `notify()` in `push.js` fans out to BOTH web push AND FCM; the
  3 bot.js triggers + `/api/push/test` now call `notify()`. New route
  `/api/push/register-native` (POST/DELETE the token). `google-auth-library` added
  to root package.json.
- **Web:** `src/app/dashboard/components/native-push.js` (Capacitor PushNotifications
  via the injected bridge — register token, tap→al-goto navigation); `PushToggle`
  branches to native when `isNativeApp()`. All native code is guarded, so the
  browser path is unchanged.

**⚠️ SHIP STEPS (pending):** (1) owner sets Vercel env `FIREBASE_SERVICE_ACCOUNT` =
the whole service-account JSON, redeploy — WITHOUT it native push is a quiet no-op;
(2) run `docs/sql/2026-09-11-fcm-tokens.sql` (Supabase MCP apply_migration on
`cchvsgouqqxibhubioch`, or owner runs it); (3) push (Vercel deploys server+web);
(4) owner rebuilds the APK (Actions → Build Android APK) so the push plugin +
google-services are in it; (5) test: open app → Profile → Turn on notifications →
Send a test. **Notification small-icon DONE** (gen-assets writes a white-bolt-on-
transparent `notif-icon.png`; CI drops it at `res/drawable/ic_stat_notify.png`
and patch-manifest adds the FCM `default_notification_icon` meta-data — so the
status-bar icon is the bolt silhouette, not a white square). Cold-start tap
navigation still a follow-up (tap opens /dashboard; deep-tab nav only when the
app was already running). SHIPPED: pushed, Vercel READY, migration applied
(fcm_tokens table verified), owner set the Vercel env.

### Native app: Android back button (exit-confirm)

Owner: the hardware back button dumped them out of the app from any tab. Added
`@capacitor/app` + `@capacitor/dialog` (mobile deps) and
`src/app/dashboard/components/native-back.js`: on backButton, if `canGoBack` →
`window.history.back()` (the shell already keeps one history entry per tab +
drawers push one, so this navigates tabs / closes a drawer via its popstate
handler); at the root → a native Dialog.confirm "Exit getvoicium?" (Exit →
App.exitApp, Cancel → stay). `initNativeApp()` (back + push tap wiring) is called
once from a new useEffect in `dashboard-client.js` (one import + one effect —
minimal touch to the shell). All native-guarded; browser unchanged. Needs an APK
rebuild (new plugins). 42/42.

### "Could not reach the server" on a 12-photo save — photos now upload one at a time

Owner's screenshot (assistant, "boxy jersey", **"12 photos, 17.6 MB of 3.3 MB"**
then "Could not reach the server"). Diagnosed from code, not guessed: (1) the
gallery was still 17.6 MB AFTER shrinkBatch — shrinking silently returned the
originals (shrinkImage swallows decode/encode failures by design; likely the
app's WebView); (2) all 12 went in ONE request to /api/add-product and Vercel
refuses >~4.5 MB at the edge; (3) `offlineError()` in api-error.js is only
returned when fetch gets NO response — a 17.6 MB body on 3.5 KB/s was cut off,
so it read as "no internet". Worst part: the UI showed 17.6/3.3 MB and still
enabled Save.
Fix (owner: "do all, web + app, never again"):
- **New `/api/product-photo`** (one file → URL via `uploadProductImage`, so the
  cleanup guard still recognises it; 413 JSON over `PHOTO_MAX_BYTES` 3.5 MB).
- **`photo-upload.js`**: `uploadPhotos(photos,{from,onProgress})` sends photos
  one at a time, each keeps `url` so a retry sends only the missing; honest
  "connection dropped while uploading photo N" text. `tooLargePhotos`.
- **All three save paths** (InventoryAssistant, Inventory.js incl. variant
  photos, PhotoBatch) now: pre-flight refuse + message if any photo is too
  large; upload 2..N first; send `images=[first]` + `image_urls=["upload:0",
  ...urls]` (variants carry URLs — `resolveVariantImages` passes http through).
  The FIRST photo stays as bytes on purpose: `primaryPhotoKey` hashes it for
  photo-duplicate detection (switching it to a URL would silently break that).
- `shrink-image.js`: 640px rung added to LADDER, `toDataURL` fallback when
  `toBlob` returns null (Android WebView), `galleryBytes`/`galleryFits`.
- Assistant UI: "Shrink photos" button + "Uploading photo N of M…" line; i18n
  keys `asst.photoTooLarge`, `asst.shrinkAgain`, `asst.uploading` (EN+BN);
  `asst.photoCount` no longer mentions a budget.
No migration. Server routes unchanged (they already accepted URLs). Not
unit-testable here (canvas/fetch); 42/42 suites still pass.

### APK "App not installed" — every cloud build signed with a new key (FIXED)

Owner screenshot: the 2nd+ APK failed on the phone with "App not installed".
Cause: GitHub Actions runners are fresh machines, so Gradle minted a NEW debug
key every build and Android refuses to install over a different signature. My
earlier "install over the old one, it updates" advice was wrong — lessons.md
entry added. Fix: the workflow now generates mobile/debug.keystore ONCE
(keytool on the runner; Java is not on the dev machine), commits it back
(permissions: contents: write), and copies it to ~/.android/debug.keystore
before every build → identical signature forever; artifact renamed
getvoicium.apk. Owner must uninstall + reinstall ONE more time (the key changes
once more), then updates install in place. Play Store later needs a separate
release key (Secrets, never git). README + lessons noted.

### Notification centre: feed of comments/orders/bookings/hand-offs/alerts, deep links, emails

Owner: the panel must show comments, messages, orders, alerts, and "a customer
needs the owner"; organise it; decide what also goes by email; and tapping a
notification (push or panel) must open THE conversation/order. Built as one
feature, all web (no APK rebuild):
- **`/api/notifications`** (new): server-assembled feed, client_id-scoped —
  needs_human contacts, comments (last 3 d; reply/dm failed = urgent), orders +
  bookings (7 d), alerts (plan lapsed/expiring ≤3 d, key failing, limit ≥90%/hit,
  channel expired, payment approved/rejected 7 d). Stable keys+times (fact time,
  never "now"). Shell polls 30 s (`loadFeed`); messages still from convos (10 s).
  Column names verified against the live DB (no `orders.total`, no
  `channels.page_name`/`updated_at` — `total_price`, `name`, `connected_at`).
- **Bell**: sections Needs you / Customers / Business; FB read model + a
  per-device "first seen" map (`gv-notif-first`) so a new alert with an old
  fact-time is still unread; urgent → red badge/dot; `onNavigate(tab,id)`.
- **Deep links `#tab:id`**: shell `splitSpec`/`goTo`/`focus` → Conversations
  (`setSelId`) and Orders (`setOpen` by id or order_code) open the item; push
  urls now `#conversations:<sender>` / `#orders:<code>`; sw `gv-navigate` and
  native `al-goto` pass "tab:id" through unchanged.
- **Hand-off** (the big missing signal): `src/lib/handoff.js` pure
  (`extractHandoff` strips `[[HANDOFF]]` the prompt now asks for; `wantsHuman`
  EN/BN/Banglish), `tests/t-handoff.mjs` (22). `composeReply` returns `handoff`;
  `flagNeedsHuman` (bot.js) flips `contacts.needs_human` once + push + email;
  cleared by `send-message` and the contacts bot-switch. Migration
  `docs/sql/2026-09-11-needs-human.sql` APPLIED to prod (Supabase MCP).
- **Emails**: notifyNewOrder, notifyNewBooking (default ON, one each),
  notifyNeedsHuman, notifyChannelExpired; `emailOwner()` helper in bot.js.
  **Push** added for bot-blocked (24 h gate), key-failing (per-outage flip),
  widget conversation-start (was none), hand-off.
- **Channel token check**: `/api/cron/channels` daily (vercel.json 04:30 UTC),
  Facebook only, error 190 only → `status="expired"` atomic flip + push + email;
  Channels.js shows red "Disconnected" + Reconnect button (uses `onConnect`).
- Owner's two decisions taken as recommended: order/booking emails on by
  default (toggle = follow-up), channel detector included (FB only).
43/43 suites.

### Notification bell now reads like Facebook's (mark all / per-item unread)

Owner: wants a "Mark all as read" like FB; after it the badge goes, and a NEW
notification shows again. Before, merely OPENING the panel marked everything
read. `NotificationsBell.js` rewritten: read state = a watermark
(`gv-notif-seen`, everything older counts read; "Mark all as read" moves it to
now and clears the per-item set) + per-item read keys (`gv-notif-read`, capped
200) added when a notification is TAPPED. Opening no longer clears anything.
Unread rows: faint brand tint, bold title, crimson dot + time; header shows
"N unread" and the Mark-all button only while unread > 0; badge = unread count.
localStorage-only (per device, like before); no server change. 42/42.

### Native app: runtime permissions asked on first launch

Owner's App-info screenshot showed **"Permissions — No permissions requested"**:
the generated manifest declared none, so Android never prompted and push could
not work. Fix, two halves:
- **Manifest:** `mobile/scripts/patch-manifest.mjs` (CI, right after `cap add`)
  appends POST_NOTIFICATIONS, CAMERA, READ_MEDIA_IMAGES, RECORD_AUDIO,
  MODIFY_AUDIO_SETTINGS, ACCESS_COARSE/FINE_LOCATION, READ_EXTERNAL_STORAGE
  (maxSdk 32) before `</manifest>`; idempotent (skips ones a plugin already
  declared). **Verified locally** against a Capacitor-shaped sample manifest: 8
  added on run 1, 0 on run 2, XML well-formed.
- **First-launch prompts:** `native-permissions.js` `requestAllNativePermissions()`
  runs once per install (localStorage `gv_native_perms_v1`): notifications
  (`enableNativePush` → OS prompt + FCM register), Camera (`@capacitor/camera`
  requestPermissions camera+photos), Location (`@capacitor/geolocation`), mic (a
  getUserMedia audio probe, released at once — the WebView raises RECORD_AUDIO).
  Called from `initNativeApp()`. Added `@capacitor/camera` + `@capacitor/geolocation`
  to mobile deps.
- **Token vs login:** first launch asks BEFORE sign-in, and `/api/push/register-native`
  needs a session — so `postToken` in native-push.js sends now if signed in, else
  waits on `onAuthStateChange` and sends ~1.5s after sign-in (the shell stores the
  fresh access token on that same event). Owner's rule: no "test notification"
  needed — the permission prompts on first launch are the proof. Needs an APK
  rebuild. 42/42.

### Human replies from Business Suite / Messenger app were being dropped (2026-09-11)

Owner (three phone screenshots): (1) Comments card badges drew over the
commenter's name; (2) wants Messenger-style bold for unanswered chats;
(3) with the bot OFF, a reply he typed in Messenger / Business Suite never
appeared in the inbox — "so how does the bot get the context when it is on
again?"
- **Diagnosis (verified, not assumed):** Graph `subscribed_apps` for all three
  FB pages lists `message_echoes` (the 09-08 back-fill held), and the last
  hour of Vercel logs shows echoes are the only path such a reply can take.
  The one drop condition was `if (app_id) return null` in
  `parseMessengerEvent` — but Meta's own Business Suite / Page Inbox /
  Messenger app stamp THEIR app id on a human reply, so every reply typed
  there was discarded as "our own send". The 09-08 test only covered
  "no app_id". Lesson recorded in lessons.md.
- `6d75069` — `messenger.js`: `OWN_APP_IDS` (FB_APP_ID / IG_APP_ID, same
  public defaults as the login routes); an echo is dropped only when its
  app_id is ours. `bot.js` echo branch: second guard — skip an echo whose
  text the bot or dashboard already wrote to that thread in the last 5 min.
  `tests/t-echo.mjs` +3 (foreign app_id captured, IG app id ours). docs.
- `1713c94` — Conversations list: `waiting = cv.status==="active"` (newest
  message is the customer's, nobody replied) → bold name + preview, dark
  time, crimson dot, title "Waiting for a reply". Same set the sidebar Inbox
  badge counts (`activeCount`), so number and bold rows agree — this also
  answers the earlier "Inbox 10 after mark-all" confusion. Comments header:
  row wraps, name `flex:1 1 180px`, badges `flex:0 1 auto` (no more
  `flexShrink:0`). Verified with a static before/after render at 336px in
  the preview pane (old = overlap reproduced, new = badges on own line).
- 43/43 suites; JSX parses. Web-only, no APK rebuild.
- **Not verified live:** a real Business Suite reply landing in the inbox
  (needs the owner to reply from Business Suite once and check the thread;
  Vercel logs keep only 1 h). Instagram's `subscribed_apps` has no
  `message_echoes` entry (IG API lists echoes under `messages`) — untested.
- **Owner then refined the rule (same day):** bold must mean UNREAD, not
  "awaiting reply" — opening a chat makes it normal, and the bell's Mark-all
  clears every bold row AND the Inbox badge. Built: `src/lib/convo-read.js`
  (pure: `lastCustomerAt`, `isUnreadConvo`, `unreadConvoCount`, `trimSeen`;
  `tests/t-convo-read.mjs`, 20) + `dashboard/components/convo-read.js`
  (localStorage `gv-convo-seen` map + `gv-convo-seen-all` watermark,
  `markConvoSeen`, `markAllConvosRead`, `useConvoRead()` hook re-rendering on
  a `gv-convo-read` window event and cross-tab `storage`). Conversations.js
  marks the on-screen chat seen on open and when a new customer message lands
  while open; shell's `activeCount` (Inbox badge) = `convoRead.count(convos)`;
  bell `markAll` also calls `markAllConvosRead()`. A bot reply never makes a
  chat read. Desktop auto-previews the top chat, so that one reads as seen.
  44/44. Verified by tests + parse only (no logged-in browser here).
- **Owner's follow-up (same day): still no Business Suite reply captured; after
  Mark-all a new message re-counted everything; leaving a chat lost the list
  scroll.** Findings + fixes:
  - **Echoes never ARRIVE.** DB: Broker's BD 09:25–09:41 UTC has only customer
    rows, yet customers are answering the owner ("Arektu kom rakhen vaia");
    Vercel logs (1 h): zero `is_echo`. Page-level `subscribed_apps` lists
    `message_echoes` (all 3 pages) but the APP-level subscription
    (`/{app-id}/subscriptions`, App Dashboard → Webhooks → Page) is what
    delivers, and it was never given `message_echoes`. Can't read/fix it here
    (needs FB_APP_SECRET, Vercel-only) → built `a2a4f9b`: `/api/admin/webhooks`
    (GET lists app Page fields + `missing`; POST = super admin + `x-admin-key`
    re-subscribes with union of current + `messages, messaging_postbacks,
    message_echoes, feed`, callback kept or
    `https://www.getvoicium.com/api/messenger`, verify_token =
    FACEBOOK_VERIFY_TOKEN) + admin console page "Meta webhooks"
    (`src/app/admin/Webhooks.js`, Platform group, superOnly): Check again /
    Repair now. **OWNER MUST: admin → Meta webhooks → Repair now, then reply
    once from Business Suite and check the chat.** lessons.md entry added.
    The 6d75069 app_id fix stays needed once echoes flow.
  - `8932304`: `markAllSeen(convos, state, now)` (pure, +9 tests → 29) marks
    each chat seen at its newest customer message and watermark = max(clock,
    newest) — clock-proof; bell `markAll` watermark = max(now, newest item /
    first-seen) and calls `markAllConvosRead(convos)`; bell first-seen effect
    merges `readFirst()` (saved) instead of the not-yet-loaded `first` state
    (a mount with items loaded re-stamped every key "new" → all unread again);
    inbox list scrolls in its own div, `listScrollTop` ref restored when the
    list is shown again (`listShown` computed BEFORE the effect — `showList`
    is declared later, TDZ). 44/44.
  - Likely part of 1(a) was the phone still running the previous bundle (an
    open WebView does not pick up a deploy until the app is closed/reopened).
  - **VERIFIED END TO END (10:01 UTC):** owner pressed Repair (page now shows
    all 4 required fields on; also on: message_reads, message_deliveries;
    callback is the old `autologic-chatbot.vercel.app/api/messenger`, still
    served). Then a Business Suite reply arrived as `is_echo:true, app_id:
    263902037430900` (Meta's Business Suite id — exactly the case 6d75069
    keeps), was stored as `role=agent "২১-২২"` for sender 28452631517690440,
    and that customer's Pending rows flipped to Replied. Human replies from
    Business Suite / Messenger now reach the inbox and the bot's memory.
  - **Owner: "do the same for WhatsApp and check Instagram."** Built:
    `parseWhatsAppEvent` keeps `smb_message_echoes` (coexistence: owner typed
    on their own phone) as `echo:true`, senderId = `to`, pageId =
    phone_number_id, text = body/button/caption, images = ["📷"] marker (no
    url; bot.js echo branch stores only http(s) urls as attachments);
    `history` + `smb_app_state_sync` still dropped. Admin "Meta webhooks"
    page now per object: `page` (FB app), `whatsapp_business_account` (FB
    app: messages, smb_message_echoes), `instagram` (IG app IG_APP_ID|
    IG_APP_SECRET: messages, comments); POST `{object}` repairs one.
    Instagram has NO echo field — echoes ride `messages` with `is_echo`
    (ig/select comment). t-echo +9 (31). 44/44. **NOT yet verified live:**
    owner must open Admin → Meta webhooks, repair WhatsApp/Instagram if
    missing, then reply once from the WhatsApp Business app and once in
    Instagram and check the chats; I can then confirm from logs/DB.
  - **VERIFIED (10:15–10:26 UTC):** owner repaired WhatsApp at app level
    (log: `whatsapp_business_account fields set: messages,smb_message_echoes`;
    Meta's verify GET on /api/whatsapp → 200). **No WhatsApp channel is
    connected to any client yet**, so the phone-reply path is covered by
    tests only until one connects. **Instagram works:** owner's hand-typed
    IG DM "Hello" arrived as `object=instagram … is_echo:true` (no app_id)
    and was stored as `role=agent` for @norayafzalnahid's customer
    1986042089452132; screenshot shows it as "You" in the chat.
  - **Bug found while verifying (fixed, own commit):** Meta's Business Suite
    *instant reply* ("Hi, thanks for contacting us…") echoed 1.8 s after a
    customer's message with the SAME app_id 263902037430900 and was treated
    as a human reply → flipped Pending→Replied. With the bot ON that would
    silence the bot for every new chat on a Page with instant replies on
    (Broker's BD has bot OFF, so no harm today). `src/lib/echo-rules.js`
    `isAutomatedEcho` (≤20 s after newest customer msg AND no business reply
    in prior 10 min → automated: stored in thread, no Pending flip, no
    memory); `tests/t-echo-rules.mjs` (9). 45/45.
  - **Profile "Phone notifications" card → one row** (owner's rule, same
    day): bell + "Notifications" + a `Switch` (ui.js) on/off; no "Send a
    test", no paragraph; blocked/unsupported/unconfigured = same row, switch
    off + one line why. `/api/push/test` kept server-side, not in the UI.
    Native FCM path unchanged behind the switch. JSX parses; web + app.
  - **Client manual updated (owner's standing rule: docs after every
    change).** `src/lib/docs/en.js` + `bn.js`: new page `notifications`
    (index.js, group daily, tab null; names in both maps); Inbox (unread
    bold/dot row, sidebar count note, "Replying from Messenger / Business
    Suite / WhatsApp / Instagram" section + instant-reply note, 2 FAQs);
    Profile ("Notifications" switch section); Channels (red Disconnected +
    Reconnect row, FAQ); Packages/Billing: **counting rule corrected** — the
    manual said "only customer messages count, bot replies are free", the
    OPPOSITE of the real rule. Now: unit = one bot reply per customer
    message, bubbles don't multiply, owner's replies + bot-off = 0 (table
    "How a reply is counted"); rows/trial renamed "Bot replies" /
    "বট-উত্তর". AGENTS.md **gate 6**: any client-visible change updates
    en.js AND bn.js in the same work. t-nav: 12 pages line up. 45/45.
  - Docs header: `src/app/docs/auth-button.js` (client) shows "Open
    dashboard" (`ui.dashboard`, EN/BN) to a signed-in client, "Log in" to a
    visitor (server renders Log in; swapped after `auth.getSession()`).
    Owner asked why a logged-in customer sees Log in on a public manual.
  - Verified counting code unchanged today: `countBillableMessages` counts
    only `role=bot AND reply_turn=true`; echo/agent rows never count.
  - **2026-09-12 — marketing assets (no app change).** Owner is NOT sure the
    name/domain "getvoicium" stays → logo is name-free: crimson app icon with
    a white chat bubble + voice-wave bars (`marketing/logo/app-icon.svg`,
    `logo-mark.svg`; a wordmark lockup `getvoicium-horizontal.svg` held back
    until the name is final). PNGs were delivered via chat, not committed.
    Not yet used as the real app icon/favicon (would need an APK rebuild).
    **Explainer video** (owner wanted "HeyGen style" but has no HeyGen; no
    talking avatar possible here): `marketing/explainer-video/` — 16-scene
    script (EN + BN) → Edge neural TTS (`en-US-AndrewNeural`,
    `bn-BD-PradeepNeural`, free) → Chrome/Playwright records animated
    mock-dashboard scenes (`scene.html`) → ffmpeg mux + concat. Delivered
    `getvoicium-explainer-en.mp4` (5:23, 27.8 MB) and `-bn.mp4` (5:51,
    27.0 MB), 1080p30. Gotchas: Playwright needs its own ffmpeg at
    `%LOCALAPPDATA%/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe` (copied from
    ffmpeg-static); local `.env.local` GEMINI_API_KEY is stale/invalid (so
    Gemini TTS was not an option); `msedge-tts@1` cannot connect, `@2` works.
    Also that day: LinkedIn post drafted (owner pastes a prompt into the
    Claude Chrome extension; final "Post" click stays with the owner);
    Google OAuth verification confirmed done (branding + data access), no
    code change; Advanced-settings claims left unchecked on purpose.
  - **2026-09-12 (session 2) — cross-account push bug FIXED + Friendly Bot
    logo shipped.**
    - **Push bug (`04f3918`):** in the app, after switching accounts the
      PREVIOUS account's notifications still came. Cause: FCM token
      (`fcm_tokens`, unique on token) stayed bound to whoever registered it;
      logout never removed it, new login never re-registered (permission asked
      once per install). Fix: `rebindNativePush(clientId)` at end of `loadMe`
      (re-registers onto current account, permission checked never requested),
      `unbindNativePush()` on both logout paths; token mirrored to localStorage
      `gv_fcm_token`. All `isNativeApp()`-guarded. No APK rebuild needed (web
      code in WebView) — owner must close+reopen the app. lessons.md added.
    - **Logo:** owner chose concept **C Friendly Bot** (chat-bubble robot
      face). `src/lib/brand.js` `BotMark` (white body, cut-out face via mask,
      works on any tile) replaces the old bolt + generic ti-robot in page.js,
      site-shell.js, docs/shell.js, dashboard-client.js sign-in; favicon
      `src/app/icon.svg` and `mobile/scripts/gen-assets.mjs` (app icon +
      splash + notif) use it; `marketing/logo/*` updated (`5f386ad`). Dashboard
      sidebar still shows each client's own logo (unchanged). App icon needs an
      APK rebuild. Google Cloud Console logo delivered to owner:
      `getvoicium-bot-google-120.png` (120x120, no white edge needed).
    - Logo/video generators live in `scratchpad/` (not repo) except the sources
      already in `marketing/`.
    - **`bbdf55b` — logo audit found the bolt/stale name in MORE places, all
      fixed:** og cards `public/og.png` + `og-bn.png` (had the OLD name
      "Autologic" + bolt → now bot + "getvoicium"; `scripts/make-og-images.mjs`
      MARK+word updated), `public/logo.png` (PWA/manifest/PWABuilder store icon,
      full-bleed bot), `src/app/favicon.ico` (regenerated from icon.svg via
      sharp; `scripts/make-favicon.mjs` rewritten to rasterise the SVG),
      `src/app/apple-icon.js` (iOS icon → bot), the channel-connect/OAuth
      callback HTML pages (connect-page.js, fb & wa callbacks, wa embedded),
      `ui.js` onboarding frame, dashboard sidebar no-logo fallback. Left on
      purpose: Analytics "Bot resolved" stat icon + internal preview-dash (not
      brand logos). Every brand mark is now the Friendly Bot. 45/45.
  - **2026-09-16 — REBRAND to "TellMore AI" / tellmoreai.com (step 1 of 2
    done, `5e0fa3c`).** Owner finalised domain tellmoreai.com; chose display
    name "TellMore AI"; tagline "Conversations that convert" (from a mockup
    he sent — its icon/maroon colour NOT adopted; Friendly Bot + crimson stay
    unless he asks). Display-name rename done in 60 files (script with
    negative lookahead; identifiers protected). **STILL getvoicium:** every
    `getvoicium.com` URL (seo.js SITE, email.js links + support@, push.js
    VAPID subject, connect pages, admin webhooks callbacks, widget snippet in
    docs, `mobile/capacitor.config.json` server.url, sw.js?), Android appId
    `com.getvoicium.app` + `mobile/package.json` name + Firebase project id
    `getvoicium` (fcm.js default, google-services.json) + APK artifact/keystore
    dname + `public/.well-known/assetlinks.json` (old TWA). og cards/videos
    still show getvoicium.com.
    **Step 2 (after owner puts the domain on Vercel):** tellmoreai.com parks
    at Hostinger (2.57.91.91, "hcdn"). Owner must: Vercel → project → Domains
    → add tellmoreai.com + www; Hostinger DNS: A @ → 76.76.21.21, CNAME www →
    cname.vercel-dns.com. Then me: global `getvoicium.com`→`tellmoreai.com`
    in code, permanent redirect old→new (vercel.json), Capacitor server.url,
    regenerate og (`scripts/make-og-images.mjs` url line) + favicon ok,
    re-render videos, then owner-side: Meta app domains/OAuth redirect/
    webhook URL/privacy links (+ webhooks re-verify via admin page), Google
    OAuth authorized domain + redirect URI (may need re-verification), Resend
    domain (SPF/DKIM) + RESEND_FROM env + support@ mailbox, Firebase new
    Android app if appId changes (decide before Play Store; sideloaders
    reinstall), APK rebuild.
    Note: CI commit `53ac46f` added `mobile/debug.keystore` — owner's APK build
    ran; the stable key now exists.
  - **2026-09-16 — voice fixes.** `8ac1e90`: in `handleIncoming` the canned
    "couldn't hear that voice message" and video replies were sent BEFORE
    `botAllowed` → bot OFF / manual chat / expired plan still replied (owner
    screenshot). Now `cannedAllowed()` gates both; blocked → saved Pending +
    owner notified, nothing sent. `ab66c26`: voice understanding in EVERY
    package — runtime never gated it; fixed the catalogue: plans table
    `voice=true` for shop_starter/svc_starter/starter (applied in prod, all
    10 plans now true; `docs/sql/2026-09-16-voice-all-plans.sql`), Starter
    bullets in plans.js, pricing table, manual EN+BN package rows. 45/45.
  - **2026-09-16 — domain audit (partial, via Claude Chrome extension; §1–3
    only, extension timed out on Meta).** Findings:
    - tellmoreai.com (Hostinger DNS, ns aster/helios.dns-parking.com): only
      A @ 2.57.91.91 (parking) + CNAME www→tellmoreai.com. NOT on Vercel.
    - getvoicium.com (Hostinger, expires 2027-03-08): A @ 216.198.79.1 + CNAME
      www 66621ef0cf81622a.vercel-dns-017.com (Vercel's NEW per-project values —
      use what Vercel shows, not 76.76.21.21); Resend sending domain (send,
      rsend, resend._domainkey); **Google Workspace mail** (MX SMTP.GOOGLE.COM,
      google DKIM, SPF google); DMARC p=reject; CNAME inst→itrackly (owner's
      outreach tool, not ours). Other old-name domains: voiciumteam.com,
      usevoicium.com, voicium.live.
    - Vercel: domains getvoicium.com (308→www), www.getvoicium.com,
      autologic-chatbot.vercel.app. Env VAPID_SUBJECT=mailto:support@getvoicium.com;
      RESEND_FROM/FB_APP_ID/IG_APP_ID/WA_CONFIG_ID/GOOGLE_CLIENT_ID stored as
      Sensitive; SITE_URL, NEXT_PUBLIC_SITE_URL, FB_CONFIG_ID, WA_LOGIN_CONFIG_ID,
      SSLCZ_MODE absent (code falls back to request origin / defaults).
    - Supabase Auth: Site URL https://autologic-chatbot.vercel.app, redirect
      allow-list ONLY https://autologic-chatbot.vercel.app/reset → reset links
      requested from www.getvoicium.com are not allow-listed (Supabase falls
      back to Site URL). Fix with the TellMore allow-list. No custom SMTP.
    - Meta app 914246304594380 already named "Tellmore AI", **App mode:
      Development**, products FB Login for Business, Webhooks, Messenger,
      WhatsApp, Instagram. Rest of Meta, Google Cloud, Firebase, Resend,
      SSLCommerz, GitHub not audited.
    - All OAuth redirect_uri are built from the request origin
      (/api/fb/callback, /api/wa/callback, /api/ig/callback, /api/gcal/callback;
      SSLCommerz /api/billing/callback + /api/billing/ipn), so the new domain's
      URIs must be ADDED to Meta/Google before anyone uses tellmoreai.com.
    - Plan: Phase A (owner via extension, additive only, getvoicium keeps
      working): Vercel domains + Hostinger DNS → Supabase URLs → Meta add
      redirect URIs/app domains + read App Review → Google add authorized
      domain/origins/redirects → Resend add tellmoreai.com. Phase B (me): code
      getvoicium.com→tellmoreai.com, og/videos, Capacitor server.url, APK.
      Phase C: getvoicium→tellmoreai 308, webhooks callbacks, privacy/terms/
      deletion URLs, VAPID_SUBJECT, RESEND_FROM, SSLCommerz store URL.
      Open decision: support@ mailbox — recommend Google Workspace domain
      alias for tellmoreai.com.
  - **2026-09-16 — Phase A progress.** Prompt 1 DONE: tellmoreai.com live
    (A 216.198.79.1; apex 308 → www; www 200 "TellMore AI"). Meta prompt: A1
    app domains + A2 FB Login for Business OAuth redirect URIs (tellmoreai
    fb/wa callbacks, www + apex) + JS SDK domains SAVED. Webhooks read:
    Page + Instagram → https://autologic-chatbot.vercel.app/api/messenger,
    WABA → .../api/whatsapp (vercel.app host, works; move to
    https://www.tellmoreai.com in Phase C — MUST be www, apex 308s and Meta
    will not follow a redirect on POST). Privacy/Terms/Data-deletion/Site URL
    all on apex https://getvoicium.com (308s). Contact email
    afzalnahid021@gmail.com (Meta review mail goes there). Business
    verification NORAY AFZAL NAHID Verified; Tech Provider access verification
    Verified; Data Use Checkup complete; App mode Development. NOT done: IG
    business-login redirect URIs, App Review statuses/rejection text — Meta
    session got developers.facebook.com/sorry.php?msg=account after the
    extension typed a guessed URL; owner to do these manually.
    **Bug found (not fixed yet, owner to OK):** `src/app/api/fb/data-deletion`
    POST returns 500 on an empty/malformed body (formData/split/
    timingSafeEqual throw), and deletes message_buffer/contacts/chat_memory by
    `sender_id = user_id` — but Meta's signed_request user_id is the
    app-scoped id of the person who removed the app (the business owner), not
    a customer PSID, so it deletes nothing relevant and never removes the
    owner's channels/tokens that the GET page promises. Relevant to App Review.
  - **2026-09-17 — Phase B DONE (`73128a5`), verified live.** Owner ran all
    5 extension prompts. Resend: tellmoreai.com added (Tokyo), DNS records
    in Hostinger resolve (DKIM TXT, CNAME send + rsend → forge.rmta.net,
    _dmarc p=none) — Verify button in Resend NOT yet clicked. Supabase /
    Google / IG redirect registration could not be proven from here (a curl
    negative control showed the check was blind) → prove by a real Calendar /
    Instagram connect from www.tellmoreai.com. Code: SITE/robots/sitemap/
    canonical/og:url/og:image → https://www.tellmoreai.com (live-checked);
    email links → tellmoreai; email footer support address + reply_to +
    VAPID default → COMPANY.email (office@autolinium.com); Capacitor
    server.url → https://www.tellmoreai.com/dashboard (needs APK rebuild);
    APK file tellmoreai.apk; og/logo regenerated. Kept: appId
    com.getvoicium.app, Firebase ids, TWA assetlinks, keystore dname.
    **Phase C cautions (do NOT use Vercel's domain-level redirect for
    getvoicium):** it redirects every path. (1) `public/widget.js` sets its
    API host from its own script src, and a cross-origin redirect makes the
    browser send Origin: null → our origin check 403s → a client's installed
    widget would die; (2) Meta webhooks (still on
    autologic-chatbot.vercel.app, fine) and the data-deletion callback are
    POSTs Meta will not follow through a redirect; (3) the installed APK
    loads getvoicium.com/dashboard and Capacitor opens a redirect to another
    host in the external browser. So: get every phone on the new APK first,
    then add a host-conditional redirect in next.config.js for
    getvoicium.com / www.getvoicium.com that EXCLUDES /api/:path* and
    /widget.js. Still owner-side: Vercel env RESEND_FROM (→ TellMore AI
    sender on tellmoreai.com after Resend verifies) + VAPID_SUBJECT; Meta
    webhook callbacks → https://www.tellmoreai.com/api/messenger and
    /api/whatsapp (www only), Privacy/Terms/Site URL/data deletion → www
    tellmoreai, IG deauth/data-deletion URLs, contact email; Google branding
    home/privacy/terms (restarts Google verification — do after redirect);
    SSLCommerz store URL.
  - **2026-09-17 — owner: drop getvoicium.com ENTIRELY ("no customer on
    getvoicium.com"). Checked: EzPz website channel (ezpzbd.com) — no widget
    script on its homepage, nothing breaks. Bots of Broker's BD (shop_growth,
    expires 2026-09-19), EzPz (svc_starter), mahadihasan5272 (trial) and the
    owner's pages run on Meta webhooks (vercel.app host), unaffected by the
    domain; those users only need the new login address.** `db12309` (live):
    admin Meta-webhooks Repair now always re-subscribes on
    https://www.tellmoreai.com/api/messenger | /api/whatsapp and flags any
    other callback (no one types the verify token); TWA assetlinks.json
    removed; CI dname text TellMore AI. Cutover order given to owner:
    1 Resend Verify → 2 Vercel env RESEND_FROM "TellMore AI
    <notifications@tellmoreai.com>", VAPID_SUBJECT mailto:office@autolinium.com,
    SITE_URL + NEXT_PUBLIC_SITE_URL https://www.tellmoreai.com + redeploy →
    3 admin Repair ×3 → 4 Meta Basic/Login/IG URLs to tellmoreai, remove
    getvoicium + vercel.app entries → 5 Google Search Console verify
    tellmoreai.com + branding links (restarts Google review) + remove old
    origins/redirects → 6 Supabase remove old redirect URLs → 7 Firebase add
    Android app com.tellmoreai.app, save google-services.json to Downloads
    (then ME: appId → com.tellmoreai.app, copy json, APK; users uninstall old
    app) → 8 SSLCommerz store/IPN URL → 9 tell Broker's BD/EzPz/trial the new
    login URL → 10 remove getvoicium domains from Vercel + Resend.
    Firebase project id "getvoicium" cannot be renamed (Google rule, invisible).
    PROGRESS 2026-09-17: steps 1–3 done (FB Pages + WhatsApp webhooks on
    www.tellmoreai.com; Instagram read fixed in 91c599c — owner to Repair).
    Step 5 DONE by extension: Search Console Domain property tellmoreai.com
    verified (Hostinger TXT google-site-verification=k5ESb1…, TTL 60 — must
    stay; resolved via 8.8.8.8). Google project my-project-483713 branding =
    TellMore AI / www.tellmoreai.com / privacy / terms; authorized domains
    tellmoreai.com + autologic-chatbot.vercel.app (getvoicium removed). Web
    client 1: origins https://www.tellmoreai.com, https://tellmoreai.com;
    redirects only the two tellmoreai /api/gcal/callback. Branding
    verification not shown to users (optional). Calendar connect test by
    owner still UNVERIFIED.
    Step 6 DONE by extension: Supabase auth Site URL https://www.tellmoreai.com;
    redirect URLs only https://www.tellmoreai.com/** + https://tellmoreai.com/**
    (getvoicium x2 + vercel.app x2 removed). Password reset uses
    window.location.origin/reset, so it matches.
    Step 7 DONE: Firebase project renamed "TellMore AI" (id stays getvoicium);
    Android app com.tellmoreai.app registered; new google-services.json (both
    package ids, one API key) copied to mobile/; capacitor appId →
    com.tellmoreai.app. New APK = a separate app on phones: users uninstall the
    old one once. Old app's push tokens prune themselves (UNREGISTERED).
    Step 10 (partly, done EARLY before the new APK was installed): Vercel
    getvoicium.com + www removed (getvoicium.com now 404 — the OLD app is dead,
    everyone must install the new APK). Left: tellmoreai.com, www,
    autologic-chatbot.vercel.app. Resend: tellmoreai.com sending verified,
    receiving MX pending — NOT needed (app only sends; reply_to is
    office@autolinium.com; tellmoreai.com has no MX) → told owner to delete
    getvoicium.com in Resend and NOT add the MX.
  - Step 4 DONE 2026-09-17 by extension (Meta app 914246304594380): Basic
    privacy/terms/data-deletion/site URL on www.tellmoreai.com, app domains
    tellmoreai only; FB Login for Business redirect URIs = www+apex
    /api/fb/callback + /api/wa/callback, JS SDK domains tellmoreai only; IG
    business login redirects www+apex /api/ig/callback (+ vercel.app one still
    there — remove), deauth /api/ig/deauth, data deletion /api/fb/data-deletion.
    Webhooks read: Page + WhatsApp on www.tellmoreai.com; Instagram REPAIRED by owner
    2026-09-17 via admin → callback https://www.tellmoreai.com/api/messenger,
    messages+comments on (screenshot). App Review (Sept 2 submission): only
    pages_read_engagement NOT approved (rejected Jul 28, Aug 15, Aug 24 feedback:
    "Screencast Not Aligned with Use Case Details", Policy 1.6 — needs a new
    English screencast showing full Meta login, the grant, and the end-to-end
    use). instagram_business_manage_comments approved Sept 2; rest renewed.
  - SECURITY BUG FIXED 2026-09-17 (owner approved; was: /api/ig/deauth POST
    has NO signature check and reads JSON user_id — anyone can POST
    {"user_id":"<ig id>"} and disconnect a client's Instagram (tokens nulled).
    Meta actually sends form-encoded signed_request, so the real callback never
    matches either). FIX: src/lib/meta-signed-request.js verifies signed_request
    (FB or IG secret, never throws; tests/t-meta-signed-request.mjs 25 checks);
    ig/deauth + fb/data-deletion refuse unsigned with 400; verified IG user_id
    disconnects channels by id+client_id; data-deletion returns a status URL
    ?code=del_… shown on the GET page. UNVERIFIED: whether Meta's IG user_id
    equals channels.page_id (professional-account id) — routes log unmatched ids,
    check Vercel logs after a real deauth. FB owner user_id still maps to no
    channel (not stored).
  - PER-CLIENT FEATURE EXCEPTIONS, and the DB round-trip verified (2026-09-18,
    owner: "all package modifications should be workable for database?"). Checked:
    the admin package form writes every column it edits (plans table has all
    24), upsert → invalidatePlans() → limitsFor reads the DB, so a save applies
    without a deploy. ONE GAP FOUND: save_overrides rewrote clients.limit_overrides
    whole, so saving a client's message limit would have silently wiped the
    features exception set by SQL. Fixed: features.js cleanFeatureOverrides
    (pure; keeps only booleans that differ from the package), the route merges
    body.features or preserves the existing ones, and Admin → Packages → client
    panel now has "Features for this client" — every relevant switch as
    Follow package / On / Off — saved by the same button. EzPz + mahadihasan
    overrides are now visible and editable there. tests/t-feature-gates 37.
  - PACKAGE FEATURE SWITCHES ARE NOW ENFORCED (2026-09-18, owner: "make the
    feature switch live and connected"). Audit found can() in plan-limits.js was
    never called: all 9 switches were display-only, and checkKbQuota (the file
    limit) was never called either. Now: src/lib/features.js is the registry —
    13 keys (vision, voice, comments, widget, broadcast, followup | kb,
    photo_import, website_import | assistant, calendar, analytics, byok), each
    with area, biz and a "what it stops" sentence; featureOn() + gateMessage()
    pure; plan-limits.js featureGate(client,key) = limitsFor + gateMessage (so a
    per-client limit_overrides.features wins). Gates: bot.js vision/voice
    (photo/voice arrive as bare markers, composeReply adds a [NOTE] so the bot
    asks for text), handleComment; widget/chat (visitor told nothing, like a
    paused bot); channels/website POST; broadcast POST; followup.js
    runFollowups; gcal/login (connectFailedPage 403); knowledge POST (+ the file
    limit, finally); inventory-chat; photo-draft + photo-group; import-url;
    analytics. byok stays gated by the admin client_ai grant. Admin → Packages
    renders every switch from FEATURE_DEFS grouped by area with the sentence.
    tests/t-feature-gates.mjs fails the build if a key has no gate. DB: the 4
    new keys set true on every plan (nothing changes until the owner flips one);
    EzPz (svc_starter) and mahadihasan5272 (trial) had comment automation on
    against a comments:false plan → limit_overrides.features.comments=true so
    enforcement took nothing away; owner told, can remove. Manual: "A feature
    that is not in your package" block on the packages page, EN + BN.
    LESSON: this Bash tool un-escapes backslashes inside quoted heredocs — a
    "\n" in JS source became a real newline five times; build strings with
    String.fromCharCode(92) or use the Edit tool.
  - REDUCTION PLAN (node scripts/ai-cost-model.mjs --reduce). Shop Growth at its
    limit after the product trim = ৳16,410/mo. Steps, each on top of the last:
    caching ৳12,670 · shorter output 248→150 ৳11,992 · comment prompt 4,723→1,500
    ৳11,099 · flash-lite router on 40% ৳9,286 · photo dedupe (20% repeats) ৳8,673
    · language rewrite 30%→10% ৳8,566 · catalogue on the Batch API ৳8,203.
    Half the cost, none of it removing a feature. After all of it the cap is the
    remaining lever: break-even 6,400 replies, 50% margin at 3,200 (today 15,000).
  - MAX-USE MODEL corrected 2026-09-18 (owner): the TRIAL is 3 days × 30/day =
    90 replies, not 900 — it was being costed as a month. Month length is now
    explicit too (DAYS env, default 30): the message allowances are monthly so
    they do not move, only per-day things (the assistant) do — 28 vs 31 days
    shifts a package total by ~0.3%. `--max` totals after the trim, every month:
    trial ৳132 · Starter ৳3,528 · Growth ৳16,410 · Scale ৳53,768 (first month
    with the catalogue built from empty: ৳157 / ৳3,836 / ৳19,484 / ৳64,014).
  - COST FIXES SHIPPED 2026-09-18 (cca3adb, deploy dpl_77Lkjr READY):
    (1) usage_daily.tokens_cached + record_ai_usage param (migration
    usage_daily_tokens_cached, copy in docs/sql/2026-09-18-usage-tokens-cached.sql);
    geminiTokens reads cachedContentTokenCount; rowCost charges cached at 10%
    (CACHED_RATE) and summarise exposes cacheHitRate.
    (2) composeReply prompt re-ordered: systemInstruction = systemPrompt + rules
    (fixed per client); context + who + timeLine + lock + customer message moved
    to the USER turn, so Gemini's implicit cache can reuse the ~2,900-token
    prefix. currentTimeLine() deliberately moved out of the prefix.
    (3a) PHOTO TURNS keep each product's FULL `visual` description (owner asked
    whether trimming hurts photo matching): retrieval is a vector search over
    products.content, which already contains the photo description, so matching
    is untouched — but the model still has to pick between the 3-4 rows handed
    to it, and that detail is the tie-breaker. bot.js passes
    { photo: combined.includes("--- ITEM") }.
    (3) src/lib/prompt-parts.js productForPrompt/productsBlock trims each product
    from ~3,900 chars to ~1,200 (drops visuals/client_id/photo_key/timestamps,
    caps description 300 / visual 160, keeps code, name, both prices, variants,
    options, stock, images, tags, match_score). tests/t-prompt-parts.mjs 25 checks.
    (4) bot.js meteredRewrite closes the unmetered language-rewrite hole.
    .env.example documents USD_BDT (t-env.mjs). 50/50 suites.
    UNVERIFIED IN PRODUCTION: reply quality after the re-order, and whether
    tokens_cached comes back > 0 — check usage_daily after the owner sends a
    test message (bot.chat tokens_in should fall from ~7,718).
  - PRICING + COST PLAN (2026-09-18): artifact for the owner
    https://claude.ai/artifact/6q7SVPW9kezxGnUSeQCbwg (Bangla). Levers modelled in
    scripts/ai-cost-model.mjs --levers: reply ৳0.84 → ৳0.60 (implicit caching of
    the ~2,900 fixed tokens, 90% discount, needs cachedContentTokenCount
    recorded) → ৳0.54 (move search results/name OUT of systemInstruction; today
    composeReply builds systemPrompt+context+who+rules+lock, so the variable part
    sits mid-prefix and shortens the cache) → ৳0.48 (trim product JSON) → ৳0.47
    (6 memory turns) → ৳0.31 (flash-lite router for simple questions).
    Fixed stack/month: Vercel Pro $20 + Supabase Pro $25 + domain $1 = ~৳5,663;
    Resend free <3k; storage inside Supabase (100GB ≈ 350 shops); WhatsApp is
    Meta's charge on the CLIENT. Competitors (Sep 2026): Zaman IT ৳1,999+,
    Digivate ৳2,500+৳2,500 setup, BotSailor $10.99+, PowerinAI $49, ManyChat
    $14-139. VERDICT: prices are fine, the CAPS are not — recommended caps
    2,000/5,000/9,000 replies at the same prices, ৳1 per extra reply, heavy users
    to BYOK. Break-even ~5 Growth clients (9-10 with video+marketing amortised).
  - FULL AI AUDIT (2026-09-18): every call site found in code and listed in
    scripts/ai-cost-model.mjs SITES (18: 7 bot, 7 catalogue, 4 platform incl. the
    free model listing). Report published as an Artifact for the owner:
    https://claude.ai/artifact/MzXMn1NngMvuzUeFu9M833 (Bangla).
    Holes found: bot.js:805 language-rewrite fallback calls Gemini WITHOUT a
    meter; 4 sites never used in production so their tokens are estimated from
    the prompt (product.scrape, knowledge.embed, platform.prompt, platform.offer);
    model-chain retries double-charge and are not modelled. Dead imports of
    generateEmbedding in bot.js/knowledge.js/products.js.
    Break-even replies: Starter 1,608 of 3,000 · Growth 3,812 of 15,000 ·
    Scale 6,553 of 50,000. 2027 Gemini price doubles → Growth max ৳27,534.
  - AI COST MODEL (2026-09-18, owner asked what a package costs at MAX use).
    scripts/ai-cost-model.mjs holds the measured per-call tokens (from
    usage_daily, mostly Broker's BD) and prints cost per message/product/package.
    Measured: reply = chat 7718 in/248 out + embed 34 in, tag on 23% of replies,
    language rewrite on 30%; photo +1230/123 each; voice +437/38; comment
    4723/36; product photo 1226/142, product embed 321 in, interview 936/48.
    At gemini-3.6-flash ($0.75/$3.75) one text reply = $0.0068 (~৳0.84).
    MAX USE IS A LOSS on every paid package: Starter ৳1,500 vs ~৳2,600 of AI,
    Growth ৳3,500 vs ~৳13,000, Scale ৳6,000 vs ~৳43,000 (real-mix column).
    Real use is nowhere near max — Broker's BD burned $1.55 in three weeks.
    FIXED: model_prices had NO row for gemini-3.6-flash, so the admin panel
    priced it at the __default__ 0.30/2.50 and under-reported by ~2.2×; row
    inserted in production (docs/sql/2026-09-18-model-price-gemini-3-6-flash.sql).
    Biggest lever = the 7.7k input tokens per reply (system prompt + catalogue +
    history): Gemini context caching reads cached input at $0.075/1M.
    STILL TO DO: the AI assistant and the other platform tools (owner will ask),
    and the admin panel's own cost page is still the messy one he complained of.
  - SPEED (2026-09-18, owner asked for speed before blogs). Lighthouse mobile,
    home page: 68 → 82 (LCP 7.8s → 3.6s, weight 4.2MB → ~280KB). Pricing 100,
    docs 91, solution pages 92. Fixes: (1) the 3.1MB film no longer autoplays —
    poster jpg cut with ffmpeg, file fetched on press; (2) Tabler icon font was
    803KB from a CDN on EVERY page → scripts/make-icon-font.mjs subsets the 50
    icons public pages use into public/fonts/tabler-subset.{css,woff2} (10.4KB,
    same class names); dashboard/admin/shots/preview-dash/reset keep the full
    CDN font via src/app/app-chrome.js in their own layout; (3) Geist/Hind
    Siliguri @import left globals.css (they were loading on marketing pages);
    (4) public faces load as <link> (src/app/public-fonts.js) not @import;
    (5) metric-matched fallback @font-face for Fraunces/Inter/IBM Plex Mono.
    STILL OPEN: solution pages CLS 0.122 (home 0.018, others ~0.02) — the shift
    lands at ~2.0s when the page's inline <style> + fallback faces apply; the
    page CSS being a big inline <style> in the body is the likely cause.
    Lighthouse runs from scratchpad/lh (run.mjs, detail.mjs, shift2.mjs).
  - SEO PHASE 2 (2026-09-18): six keyword landing pages at /solutions/<slug> —
    facebook-messenger-chatbot, whatsapp-chatbot, instagram-dm-automation,
    website-chatbot, ecommerce-chatbot, bangla-chatbot — full copy in EN + BN
    (src/lib/solutions/{index,en,bn}.js, route src/app/solutions/[slug]),
    FAQ+breadcrumb JSON-LD, internal links, in sitemap (priority .9, bn
    alternates). Owner's scope: global market too, plus speed work and blogs
    later. Local `next build` now runs (google-auth-library installed with
    --no-save); only /apple-icon fails locally, the known Windows next/og fault.
  - SEO WORK STARTED 2026-09-18 (owner: "rank tellmoreai.com"). Phase 1 shipped:
    seo.js gained productJsonLd (SoftwareApplication + AggregateOffer in BDT, fed
    by PLANS so prices can't go stale), faqJsonLd, breadcrumbJsonLd, jsonLdProps
    (escapes "<"); pricing page and every manual page now emit them
    (docs faq blocks → FAQPage). tests/t-seo-jsonld.mjs 16 checks. Site already
    had: canonical/og/twitter per page, sitemap (24 urls, bn via ?lang=bn),
    robots, WebSite+Organization on home. NOT DONE: keyword-targeted content
    pages, Bangla landing content, Core Web Vitals check, off-site (Google
    Business Profile, backlinks, directories).
  - EMAIL still said the old brand until 2026-09-18 (owner saw it in a client
    mail): src/lib/email.js clientWrap header was "get" + a coloured span, so the
    rename's search never matched. Header now renders BRAND_HTML, derived from
    COMPANY.name. NEW GUARD tests/t-brand-name.mjs walks src/ and fails on any
    mention of the old name (allow-list: fcm.js project id, company.js comment,
    admin/webhooks comment). DB scanned: plans/clients/knowledge_base/products
    carry no mention. Supabase Auth's own emails (confirm/reset) are templates in
    the Supabase dashboard — owner must check those separately.
  - APK build run #6 FAILED 2026-09-17 at "Set up Android SDK": setup-android@v3
    default packages "tools platform-tools"; runner's cmdline-tools 16 has no
    "tools" package → sdkmanager exit 1. Fixed: with: packages: platform-tools.
    Next run SUCCEEDED; owner downloaded tellmoreai.apk (7.3 MB). APK inspected
    here: manifest package com.tellmoreai.app, app name TellMore AI, server.url
    https://www.tellmoreai.com/dashboard, launcher foreground = new plum logo.
    On-phone install/login/push still to be confirmed by owner.
  - FB PAGE PICKER shows ALL Pages (2026-09-17, owner report "not showing all
    the pages"): src/lib/fb-pages.js fetchAllPages follows /me/accounts paging
    (limit 100) + /me/businesses → owned_pages + client_pages, merges by id,
    asks /{page}?fields=access_token for tokenless ones, lists tokenless Pages
    greyed with a reason; picker adds "Connect again" hint (Pages not ticked in
    the Facebook dialog can only be fixed by the owner re-choosing).
    tests/t-fb-pages.mjs 13 checks. VERIFIED by owner 2026-09-17 on his real
    account: "now all pages show". Vercel log "[fb-callback] pages found=".
  - NEW LOGO 2026-09-17 (owner's final artwork: plum robot head whose face is a
    speech bubble, "TellMore AI" with "Tell" in ink, tagline). Owner's rule: the
    LOGO is plum #722B4D (+ ink #1E1A1D); the product UI stays crimson — no other
    design change. Redrawn as vector in src/lib/brand-mark.js (markInner /
    markSvg, 1024 canvas, centre 512,504) — the one source; copies in
    scripts/make-og-images.mjs and mobile/scripts/gen-assets.mjs. Logo tiles
    (nav, docs, auth, sidebar, admin header, OAuth connect pages) are now WHITE
    with the plum mark (was crimson tile + white bot). icon.svg, favicon.ico,
    apple-icon, logo.png, og.png/og-bn.png regenerated. Android: adaptive icon
    white bg + plum mark, white splash, notif icon = white silhouette (needs APK
    rebuild). Manual-upload pack in Downloads\TellMore AI logo pack (Meta app
    icon 1024, Google OAuth 120, FB/IG profile 1080, WhatsApp 640, FB cover
    1640x624, lockups, SVGs). Local `next build` fails only on the missing local
    google-auth-library (pre-existing, Vercel installs it).
    IG app data-deletion pointed at /api/fb/data-deletion will fail signature
    (FB_APP_SECRET) — part of the still-unfixed data-deletion bug.
  - `51cbd4e`: the new admin page crashed the console on open — `titles[page]`
    had no "webhooks" entry (header reads `titles[page][0]`). Added + safe
    fallback. lessons.md: a new admin page = NAV + render branch + titles.

## Earlier session (2026-09-10) — Auth polish, and admin-delete now removes the login

- `7597e39` — `AuthGate` defaults to **sign-in** (was sign-up on first visit, which
  turned a login attempt into a new account + onboarding); a failed sign-in shows a
  friendly "no account matches … tap Create account" message; and the phone back
  button during the sign-up flow (onboarding/connect/connect-cal) returns to sign-in
  signed out (`useBackClose` + a pushed history entry). **Verified live in a browser**
  (login now reads "Welcome back / Sign in").
- `895f5d3` — **admin DELETE now also deletes the Supabase Auth user** (new helper
  `deleteAuthUserByEmail`, reads `owner_email` before dropping the client). Root cause
  of "a deleted account keeps coming back": admin delete removed the client rows but
  NOT the auth login, so the email still signed in; with no client row, `loadMe()` in
  `dashboard-client.js` (~line 708) **silently auto-registers a fresh client** (name =
  email prefix, plan "none") and drops them into onboarding. Left `loadMe`'s
  auto-register as-is (it is the legit incomplete-signup recovery path; the root fix is
  removing the auth user on delete).
- **Open cleanup — DONE (owner confirmed 2026-09-10, verified).** `afzalnahid021@gmail.com`
  was in the re-created state (auth user + a fresh empty client). It is now GONE from
  BOTH `auth.users` AND `clients` — verified by a live query on `cchvsgouqqxibhubioch`
  (a union of the two returned zero rows). Nothing left to do.

40/40 suites pass.

---

## Earlier session (2026-09-10, later-2) — TWA verification diagnosed to the device; app-login gate hardened

Owner: the installed Android app still "already logged in", notification still says
"Running in Chrome", and no install-time permission prompt — "not satisfied". These
are ONE root cause: the TWA is **not verifying**, so it runs as a Chrome Custom Tab,
which (a) shows the Chrome notification + address bar and (b) reports
`display-mode: browser`, so the installed-app login gate is bypassed and the shared
Chrome session logs the owner straight in. Fix the verification and BOTH resolve.

**Proven NOT a site/APK/key problem — it is device-side (Chrome cache on MIUI).**
Inspected the actual installed APK at
`C:\Users\This Pc\Downloads\getvoicium - Google Play package\Getvoicium.apk` (read the
zip with .NET `System.IO.Compression`, pulled the v1 signer cert from
`META-INF/MY-KEY-A.RSA` via `System.Security.Cryptography.Pkcs.SignedCms` and SHA-256'd
`cert.RawData`; read the baked host from `AndroidManifest.xml` + `resources.arsc`
strings). ALL THREE match the hosted `www` assetlinks and Google's DAL:
- package `com.getvoicium.www.twa`
- signing SHA-256 `C8:AD:E2:9C:AB:54:B8:19:20:E1:6B:69:C9:86:5B:44:84:B9:AA:7F:9C:DB:83:B2:BB:F6:CA:06:3D:85:24:63`
- baked host `https://www.getvoicium.com` (launch `/dashboard`)
So Chrome cached the FAILED verification from the first install (done while Google's
DAL cache was still stale) and a plain reinstall does not clear it. **Fix for the
owner:** uninstall → Settings → Apps → Chrome → Storage → Clear storage (or reboot the
phone) → confirm Chrome is updated and the default browser → reinstall Getvoicium.apk
with internet on. Address bar gone == verified == notification + login both fixed.

- `0de146c` — app-login gate now also treats `display-mode: fullscreen` / `minimal-ui`
  as the installed app (was standalone / iOS-standalone / `android-app://` referrer
  only). Note the shared-storage limit stands: once signed in inside the app the
  `gv_app_signed_in` marker persists across reinstall (TWA shares Chrome storage), so
  the owner's own device auto-logs-in until they Log out; a genuinely new user's phone
  (no marker) always sees the login screen — which is the actual requirement.
- Owner is weighing TWA vs a fully native app (a TWA renders on the phone's Chrome
  engine invisibly, so it needs a Chromium browser present — true on ~all Android;
  native removes that dependency but is a full rewrite). Decision still open.
- Agency dashboard "back button / reload" issue the owner reported: the back/reload/
  full-bleed fixes are all in the SHARED shell, and agency components (Bookings,
  KnowledgeBase) already use `useBackClose` — so no agency-specific gap found; likely a
  stale cached app. Awaiting the owner's exact screen + repro before changing anything.
- `7597e39` — auth UX: `AuthGate` now defaults to **sign-in** (was sign-up on first
  visit, so typing login details created an account and jumped to onboarding); a failed
  sign-in shows a friendly "no account matches … tap Create account" instead of raw
  "Invalid login credentials"; and the phone back button during the sign-up flow
  (onboarding / connect / connect-cal) returns to the sign-in screen signed out
  (`useBackClose` + a history entry pushed on entering the flow), instead of doing
  nothing / exiting.

40/40 suites pass.

---

## Earlier session (2026-09-10, later) — The AI Assistant now serves agency clients too

Owner: "the AI assistant is dedicated for only e-commerce; it should serve agency
clients too — two assistants, each expert for its own bot/dashboard." Owner chose
the FULL-expert option (teach by typing + upload documents + set identity/tone/
booking, all by chat). `0517f33`.

**Key model fact that made it small:** an agency bot answers from `knowledge_base`
(uploaded documents, via `searchKnowledge`) PLUS the Bot Training answers/notes —
and those settings (`training.set`, `note.add`, `identity.set`, offers, follow-up)
ALREADY feed the agency bot through `businessFacts()` in `bot.js` and already work
for both business types. So the only real gap was the CATALOGUE half.

- `/api/inventory-chat`: for `business_type === "agency"` it reads the knowledge
  docs (`file_registry`) instead of `products` and uses a new **`agencyPrompt`** —
  same settings verbs, NO product proposals (`actions` forced to `[]`), and its one
  `ui` token is `import:docs`.
- `InventoryAssistant.js`: `isAgency` branch — the 📎 attach uploads a PDF/Word/text
  file straight to `/api/knowledge` (`uploadDocs`, reported in chat) instead of the
  photo interview; `ui:"import:docs"` opens that picker; agency example chips +
  intro (`EXAMPLE_KEYS_AGENCY`, `asst.introAgency`); the file input accepts docs,
  not images. The guided photo interview stays shop-only.
- i18n EN+BN: `asst.introAgency`, `asst.chip.{teach,train,docs,identity}Agency`,
  `asst.doc.attach`, `asst.kb.{reading,learned,failed,badType}`.
- Did NOT need `ingestText` or new apply verbs: typed facts go to the existing
  `note.add`/`training.set` (which feed the agency bot), bulk material goes through
  document upload to `/api/knowledge`. `docs/architecture.md` updated.

40/40 suites pass.

---

## Earlier session (2026-09-10) — getvoicium becomes an installable mobile app (PWA → Android TWA)

Owner wants a real mobile app people install (manual `.apk` sharing now, Play Store later),
NOT a rewrite. Chosen path: make the site a proper **PWA**, then package it with **PWABuilder**
into an Android **TWA** (a thin native shell that loads the live site — so a normal `git push`
updates the app too; only name/icon/identity changes need a rebuild). Full reference in
`docs/architecture.md` (§ "Installable app (PWA)"). Commits, in order:

- `5c589d0` **PWA basics.** `src/app/manifest.js` (name, icons `logo.png`/`icon.svg`,
  `display:standalone`, crimson theme, `start_url:/dashboard`); `public/sw.js` gained a no-op
  `fetch` handler (required for installability; deliberately never caches — a logged-in
  dashboard must stay fresh); `layout.js` registers the SW for every visitor + `appleWebApp`.
- `305d79c`, `6298234` **Full-screen app shell on a phone.** A `fullBleed` flag
  (`dashboard-client.js`) makes the open inbox chat AND the AI Assistant fill the screen edge
  to edge (shell header + page padding dropped; the assistant gained its own menu button via
  `onMenu`). Both composers add `env(safe-area-inset-bottom)` so they clear the nav bar on
  button- and gesture-nav phones. **Reload keeps the tab:** the mount `replaceState` now keeps
  the `#tab` fragment (was `""`, which stripped it and sent every refresh to Analytics).
- `6711648` **Log out → the app's own sign-in screen** (reload → AuthGate), not the public
  marketing site.
- `cdf69ce` → `ef7e10a` **Digital Asset Links** at `public/.well-known/assetlinks.json` (so the
  Android app opens with no browser address bar).
- `90f96ef` **The installed app requires its OWN login.** A TWA shares the origin's cookies
  with the phone's Chrome, so a browser-logged-in owner landed straight in the dashboard. In
  app mode (`display-mode:standalone` / iOS `navigator.standalone` / `android-app://` referrer)
  the shared session is now ignored until the owner signs in from inside the app once — marker
  `gv_app_signed_in` in localStorage, set on sign-in, cleared on log out. Browser tab unchanged.

**Key facts for whoever continues this:**
- **The site's canonical host is `www.getvoicium.com`.** The apex `getvoicium.com` 308-redirects
  to www (a Vercel domain setting, not in code). Google will NOT verify assetlinks through a
  redirect, so the **TWA must be built against `https://www.getvoicium.com`** (where the file is
  served directly). The apex build failed verification; the www rebuild is the live one.
- **Installed app identity:** package `com.getvoicium.www.twa`, signing fingerprint
  `C8:AD:E2:9C:AB:54:B8:19:20:E1:6B:69:C9:86:5B:44:84:B9:AA:7F:9C:DB:83:B2:BB:F6:CA:06:3D:85:24:63`
  — this is what `assetlinks.json` currently declares. The owner holds the PWABuilder signing
  key (must be kept for every future update + Play Store).
- **Google Digital Asset Links caches the statement ~1h.** After the `ef7e10a` update, Google
  still served the OLD package for ~45 min, so a reinstall during that window kept failing
  (address bar + "Running in Chrome"). Once Google's `statements:list` for www shows
  `com.getvoicium.www.twa`, an **uninstall + reinstall** of the www `.apk` verifies and the
  address bar / "Running in Chrome" disappear. (Verify with
  `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.getvoicium.com&relation=delegate_permission/common.handle_all_urls`.)

**⚠️ OPEN — owner/next-session tasks:**
1. **Reinstall the www `.apk`** once Google's DAL cache shows the new package → address bar goes.
2. **Play Store later:** Google re-signs the AAB with its own key, so the fingerprint changes —
   add Google Play App Signing's SHA-256 to `assetlinks.json` (keep both) or the address bar
   returns on the store build.
3. Still open from before: **run `docs/sql/2026-09-08-reply-turn.sql`** (usage counts customer
   messages via fallback until then); **rotate the Supabase `service_role` key** (pasted in an
   earlier chat); build the **BYOK separate price list** ([[byok-separate-price-list]]).

40/40 suites pass throughout. Standing rule reaffirmed by owner: **keep `memory.md` current so
the project can be resumed from any Claude account** — a new account should `git pull` then run
`/start` (which loads CLAUDE.md → AGENTS.md → memory.md → lessons.md).

---

## Earlier session (2026-09-08, late night) — Usage counts bot replies, not the owner's manual ones

Owner's rule: a counted/billable message is a **bot reply**, never the **page owner's manual
(agent) reply** — but agent replies must still SHOW in the conversation. This surfaced right
after the echo work, which added `role:"agent"` rows the admin dashboard was sweeping into its
message counts.

- **Done — admin dashboard** (`/api/admin/route.js`): per-client `messages*` tallies and the
  `total_messages*` aggregates now count `role="bot"` only (was every role). `customer_messages_7d`
  stays as the separate labelled traffic figure. Agent replies still render in the inbox.
- **Done — the plan LIMIT now counts bot REPLY TURNS** (owner chose "per reply = 1", not per
  bubble). The trap: one reply = several `message_buffer` rows (photo + text + question), so
  raw `role="bot"` over-counts (live check: 37 bot rows vs 23 customer msgs for one client).
  Fix: `botReplyRows(items, base)` (bot.js, pure, tested) flags EXACTLY the first bubble
  `reply_turn:true`; the main path, the widget, the canned video/voice replies and the
  comment→DM reply all go through it or set the flag. New `src/lib/message-usage.js`
  `countBillableMessages(clientId, since, pageId?)` counts `role="bot" AND reply_turn=true`,
  and — until the column exists — **falls back to counting customer messages** so a limit is
  never silently unenforced (verified live: the reply_turn query errors → fallback returns the
  customer count). Wired into: botAllowed (×2), billing usageThisMonth/usageToday, me/route,
  admin/client-detail. `bufferInsert` strips `reply_turn` and retries if the column is missing,
  so the inbox never loses a message pre-migration. Followups/broadcast sends are NOT flagged
  (they never counted toward the conversational limit before either); broadcast.js's own quota
  now uses countBillableMessages + broadcast_recipients. Left alone: admin/packages (a separate
  cost-analysis tool on customer volume), and the recipient-finding/followup/contacts customer
  filters. `botReplyRows` test `tests/t-reply-turn.mjs` (11). 40/40 suites.
- **⚠️ Owner must run `docs/sql/2026-09-08-reply-turn.sql`** (adds the `reply_turn` column +
  partial index). Until then usage counts customer messages (the old basis) via the fallback —
  safe, just not yet per-reply. Existing rows stay false, so counting starts fresh from the
  first reply after the migration (no backfill).
- **Remembered (auto-memory):** [[usage-counting-rule]], and a future **separate BYOK price
  list** for clients on their own AI key ([[byok-separate-price-list]]).

40/40 suites pass.

---

## Earlier session (2026-09-08, late night) — Human replies now reach the bot's memory

Owner: "why are the human replies to customers not captured? the bot loses the context."
Correct, and it was THREE bugs stacked (see `lessons.md`):

1. `messenger.js` did `if (m.message.is_echo) return null;`. Meta reports a reply the owner
   types in the Messenger app / Page Inbox ONLY as an echo, so it was thrown away — it
   reached neither the dashboard thread nor the bot. Now: an echo with an `app_id` is our own
   Send API call (already stored, still dropped); an echo with NO `app_id` is a human and is
   captured. In an echo sender/recipient are REVERSED (sender = page, recipient = customer).
2. `fb/select` subscribed to `messages,messaging_postbacks,feed` — no `message_echoes`, so
   Meta never delivered the echo at all. Added there and in `ig/select`.
3. `/api/send-message` wrote the dashboard's own reply to `message_buffer` but NOT to
   `chat_memory` — and `getMemory()` reads `chat_memory`. So even a dashboard reply was
   invisible to the bot.

New `saveAgentTurn(senderId, clientId, text)` in `bot.js` writes one `ai` turn into
`chat_memory` (never throws). `handleIncoming` gets an early `event.echo` branch: store as
`role:"agent"` + `saveAgentTurn`, then RETURN — the bot must never reply to the shop's own
message. Deduped on `wa_msg_id` like every other message. `tests/t-echo.mjs` (19). 39/39.

**Back-fill done (owner authorised 2026-09-08).** Old pages keep the field list they were
connected with, so a throwaway script re-POSTed `subscribed_apps` for every connected channel
using the stored token, then GET-verified. Result: the **three Facebook pages** (Broker's BD
112231873927166, EzPz, AutoLogic Systems) now show **`message_echoes: YES`** — no reconnect
needed. **Instagram has NO `message_echoes` field** — the POST failed with IGApiException 100
("must be one of {...}"), which also means the earlier `ig/select` edit adding it would have
made every NEW IG connection subscribe to nothing. Reverted: `ig/select` is back to
`messages,comments,live_comments,message_reactions`. On IG the business's own outgoing
(including a hand-typed reply) arrives under the ordinary `messages` field with `is_echo`, so
`parseMessengerEvent` already captures it — no separate field. So **no owner action is needed
after all**; new clients get `message_echoes` on FB automatically via the fixed `fb/select`.

Known gaps left alone: (a) an echo carrying a DIFFERENT app's `app_id` (a third-party tool
replying) is still dropped — cannot tell it from our own send without pinning our app id;
(b) IG human-app-typed replies depend on IG actually emitting `is_echo` under `messages`,
which is unverified here (no live IG test message). Dashboard replies reach the bot on every
platform regardless (fix 3, `saveAgentTurn` in `/api/send-message`).

---

## Earlier session (2026-09-08, late night) — Notification panel fits a phone; grid overflow audit

Owner's phone screenshot: the bell dropdown ran off the LEFT edge, "Notifications" cut to
"fications". Cause: the panel was `position:absolute; right:0` — anchored to the BELL, which is
not the last thing in the header (the avatar is). A 340px panel hanging left from there starts
~40px off-screen on a 375px phone. On mobile it is now `position:fixed` pinned to the VIEWPORT
(`left:10, right:10`, `top` measured from the bell's own rect on open + on resize/rotate),
`maxHeight: calc(100dvh - top - 12)`; desktop keeps the anchored dropdown. Also closes on
`touchstart`, not just `mousedown`. **Verified at 375×812: panel left 10 → right 365, no
horizontal overflow.**

Audited every tab's grids for small-phone overflow (measured, not guessed): `auto-fit` +
`minmax(Npx,1fr)` does NOT shrink below N, so `minmax(280px,1fr)` in a ~260px container (320px
phone, page padding + card padding) produced a 280px cell — 20px of overflow. Fixed the only
two files with 280px tracks (`Analytics.js` ×4, `Profile.js` ×1) to `minmax(min(280px,100%),1fr)`.
230px and below measured clean, so they were left alone. Billing's and Inventory's wide tables
are already wrapped in `overflowX:auto` — checked, not assumed.

---

## Earlier session (2026-09-08, late night) — The dashboard fits every screen again

Owner: the Orders drawer footer is cut off, and other pages "do not fit" — wants it right on
Windows, Mac, iPad, iPhone, Android and tablets.

**Root cause (one bug, eight components).** `ui.js` had
`.ui-page { animation: ui-in .28s ... both }`. `both` fills forwards for ever, so the final
`transform: none` stays applied as the identity matrix `matrix(1,0,0,1,0,0)` — and any
transform makes that element the containing block for `position: fixed` descendants.
`.ui-page` wraps EVERY tab, so every drawer/sheet/dialog/toast was sized against the page box,
not the viewport. Measured in a browser: overlay at `top: 81`, running 81px below the screen —
the cut-off footer. Changed `both` → `backwards` on `.ui-page`, `.ui-menu`, `.ui-opt`,
`.ti-check` (identical animation, leaves `transform: none`). Verified: `top: 0`,
height == viewport, on desktop AND at 375×812 with no horizontal overflow. See `lessons.md`.

**Also:**
- Every fixed overlay got `height: 100dvh` (Orders, Bookings, Inventory ×2, PhotoBatch,
  DuplicateSweep, KnowledgeBase, Settings) so a phone's browser toolbars cannot hide the
  sheet's own bottom. Drawer bodies got `env(safe-area-inset-bottom)` for the iPhone home
  indicator (`viewportFit: "cover"` is already set in `layout.js`, so it takes effect).
- Shell height is now `100dvh` always, not `isMobile ? dvh : vh` — `isMobile` is false on the
  first paint, so a phone briefly got the tall viewport and was cut off until hydration.
- Pages with a fixed `maxWidth` hugged the LEFT on a wide monitor (AI Engine, Bot Training,
  Channels, Billing) — all now `margin: "0 auto"`.

**Verified:** 38/38 suites, all 12 changed files parse, `next build` says "Compiled
successfully". The local build then fails on `/apple-icon` (a `@vercel/og` "Invalid URL" on
Windows) — PRE-EXISTING, untouched by this work, and Vercel's Linux builds are unaffected.

---

## Earlier session (2026-09-08, late night) — Category overview image on a broad question

Closed the one genuine gap in the owner's tiered-image request: "powerbank ache?" (a BROAD
question) now sends ONE overview image + intro, then narrows to a model, then a colour. The
colour→photo (rule 18c) and capacity→photo (search) already worked; the overview was the
missing piece. Owner chose option (ক): a **category/collection cover image + intro**.

- `bot.js` — `activeCollections(settings)` (pure, exported): keeps only rows with a category
  AND a real http `cover_url`, trims, dedups by category (last wins), intro optional.
  `collectionsBlockText()` builds the `[COLLECTIONS]` block; `getSystemPrompt` injects it for
  ECOM only (an agency has no "show me your <category>"). New **FIXED_ECOM rule 16b**: on a
  broad category question with no specific model/code/capacity/size/colour, send the
  collection's cover image + a short intro and ask them to narrow — do NOT list products yet;
  fall back to normal display when nothing matches.
- Stored in `app_settings.settings.collections` = `[{id, category, cover_url, intro}]`, saved
  via PATCH `/api/settings`. No new table.
- `/api/collection-cover/route.js` (NEW) — POST a cover file → uploads to the **`logos`**
  bucket (deliberately NOT `product-images`, so the product-delete cleanup never sweeps it) →
  returns the public URL.
- `CollectionOverview.js` (NEW) — collapsed opt-in card at the top of Inventory (shown once
  there is a catalogue). Add rows, upload the image, write the intro, Save. Category input has
  a datalist of the shop's existing categories. English UI only (dashboard language rule).
- `tests/t-collections.mjs` (NEW, 16) — activeCollections. Full suite 38/38.

**Owner's to-do to make it work:** Inventory → "Overview image for a category" → Add → upload
the powerbank infographic → category "Power Bank" → intro → Save. Then set each colour
variant's own photo (Preview flags the ones without) so the colour step sends the right image.

---

## Earlier session (2026-09-08, night) — Add-product wizard + confirming the bot's tiered image logic

### The add-product drawer is a Details → Photos → Variants → Preview wizard

The editor already had Details/Photos/Variants tabs but no linear flow and no preview, so it
did not read as a step-by-step. Added a 4th **Preview** tab and a wizard: Back/Next in the
footer walk `STEPS = [details, photos, variants, preview]`, a "Step N of 4" counter, and the
final button is **Add product** only on the Preview step (adding no longer saves from a
half-filled first tab). Editing keeps a "Save changes" button on every step (editing is
fixing, not a wizard). The tabs still let you jump. Preview renders the product the way the
bot presents it — primary photo, price, description, and each variant with ITS photo (a
dashed box flags a colour with no image). `Inventory.js`.

### The tiered image behaviour the owner asked for is MOSTLY already in the bot

Owner wants: "powerbank ache?" → overview image; pick a capacity → that model's image; pick a
colour → that colour's image. Reading `bot.js` FIXED prompt: **rule 18c already sends a
variant's own photo when the customer picks it** ("the red one → show the red one"), and
capacity→image works through product search. So the colour step works once each colour
variant has an image set (the new Preview flags the ones that don't). **The one genuine gap
is the "overview infographic on a general question"** — the 3 models are separate products,
so a general query has no single overview to send. NOT built yet — needs a small design
decision (a category/collection cover image, or a designated lead product). Flagged to the
owner.

### Notification bell dropdown + Web Push

### The bell now opens an in-app notification center

The header bell used to just open the inbox with an "active convos" count. It is now a
`NotificationsBell` dropdown built from data the shell already holds (no fetch): conversations
waiting for a reply (`status==="active"`) + recent orders, newest first. "Unread" = newer than
the last time it was opened (localStorage `gv-notif-seen`); opening marks all read. Clicking an
item navigates to its tab. The sidebar Inbox badge still uses `activeCount`. This is the IN-APP
list; the phone push below is the separate "reach me when the app is shut".

### Web Push notifications (phone/browser)

Owner wanted Facebook-style notifications — chose real **push** (reaches the phone even when
the dashboard is closed), for new order / new booking / handover / new message. Built the
whole Web Push stack:

- **VAPID keys** generated (web-push). In `.env.local` locally + `.env.example` documented.
  Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public), `VAPID_PRIVATE_KEY` (SECRET), `VAPID_SUBJECT`.
- **`web-push` dependency added** (npm install crashed once — machine — retried, fine).
- `docs/sql/2026-09-08-push-subscriptions.sql` — `push_subscriptions` table (one row per
  device, unique endpoint, RLS on). **Owner must run it** (service key can't DDL via JS).
- `src/lib/push.js` — `pushEnabled()`, `saveSubscription`, `removeSubscription`,
  `sendPush(clientId, {title,body,url,tag})`. Fan-out to all the owner's devices, prunes
  dead subs (404/410), never throws (a push must never break the order/reply that fired it).
- `src/app/api/push/subscribe/route.js` — POST saves a subscription, DELETE removes it.
- `public/sw.js` — service worker: `push` → showNotification, `notificationclick` → focus/
  open the right dashboard tab.
- `PushToggle.js` (in Profile) — "Turn on notifications": registers the SW, asks permission,
  subscribes, POSTs the subscription. Handles unsupported / blocked / iOS-home-screen cases.
- **Wired into `bot.js` (fire-and-forget):** new order (maybeSaveOrder), new booking
  (maybeCreateBooking), and a customer message that STARTS a conversation
  (`notifyIncomingMessage` — throttled to no prior message in 20 min, so a back-and-forth
  does not buzz every line; a paused/handover chat still pushes, covering "needs you").

**⚠️ Not live until the OWNER does three things:** (1) run the SQL, (2) set the 3 VAPID env
vars in Vercel and redeploy, (3) open Profile → Turn on notifications and grant permission
on each device. **iOS caveat:** web push needs the site added to the Home Screen first.
After they subscribe I can send a test push from here (DB access + web-push) to verify.

---

## Earlier session (2026-09-08, later) — One reply per burst, order saved 4×, and delete confirmation

### Deleting an order — already worked, now honest about failure

Owner asked to ensure deleting an order really removes it from the DB. It already did — the
`/api/orders` DELETE does a hard `.delete().eq("id").eq("client_id")` on the service-role
client (bypasses RLS). **Verified end-to-end against production**: inserted a throwaway order,
deleted it with the route's exact query, confirmed 0 rows left, real order count untouched.
The one real weakness: `Orders.js` `remove()` swallowed every error with `.catch(() => {})`
and said "Order deleted" regardless, so a FAILED delete looked done until the list refreshed
and the order reappeared — which reads as "delete doesn't persist". `remove()` now checks the
response (`apiJson`) and only claims success when the server confirms it; dropped the unused
`api` import. `76bbd0d`. (Bookings "cancel" is deliberately different — it keeps the row and
removes the calendar event; not touched.)

### The same order saved four times

Owner placed one test order and saw it saved 4× in the dashboard (dupes already deleted, so
only 1 row remained to inspect). **Root cause is the double-reply bug below:** the bot
composed a reply several times for one conversation, and each pass the model invented a
FRESH `order_code`. The existing dedup and the `orders_one_per_code` unique index both key on
`order_code`, so different codes slipped past both → four rows.

- The debounce fix (below) removes the multiple composes, which is the primary fix.
- Defence in depth: `isDuplicateOrder(recent, prodNames, totalStr)` (pure, `bot.js`) — a
  second guard in `maybeSaveOrder`, checked before insert for a known sender: same customer +
  same `product_names` + same `total` within the last **5 minutes** = the same order under a
  different code, skip it. Matches all three to keep a genuine re-order from being blocked.
  `tests/t-order-dup.mjs`, 10 tests.

### One reply per burst (proper debounce)

Owner: when the bot is typing and the customer sends another message, it replies twice; a
burst within a few seconds should be understood together and answered once.

Two double-reply sources in `processConversation`, both fixed:
1. The old debounce was a FIXED 3s wait then a single newest-check. If a second message
   arrived AFTER those 3s (while the first was composing), the first handler had already
   passed the guard and committed — so both replied.
2. The **orphan self-reprocess** at the end (`freshOrphans → processConversation(…, null)`)
   re-answered messages that arrived during compose — but those messages ALREADY have their
   own handler (handleIncoming fires one per message), so it raced its own handler and
   double-replied. **Removed it.**

Now: a **quiet-period debounce**. `debounceDecision(rows, myRowId, now, start)` is pure
(→ stop / bail / go / wait) and `processConversation` loops on it, re-reading pending each
round, until the customer has been quiet for `DEBOUNCE_QUIET_MS` (**5000**, one-line
tunable) or `DEBOUNCE_MAX_MS` (20000) is hit. Only the LATEST message's handler survives —
an older one bails the instant a newer message lands — so N quick messages → ONE combined
reply. **WhatsApp is left immediate** (it carries a message id we already dedupe on); the
change is Messenger/Instagram only. Trade-off the owner accepted: a single message now waits
~5s before the reply. `tests/t-debounce.mjs`, 17 tests.

---

## Earlier session (2026-09-08) — Real customer names in the inbox (Conversations API, not the profile API)

Inbox showed "User 5184" instead of names. Diagnosed against LIVE Meta with the page token:
the direct **User Profile API** (`GET /{PSID}?fields=first_name,last_name,name`) answers
**error 100 / subcode 33** for our app — it needs `pages_read_engagement`, which Meta
**rejected** in review (the app is otherwise live and approved). But the **Conversations
API** returns the same names and runs on the `pages_messaging` we DO have:
`GET /{pageId}/conversations?platform=messenger|instagram&user_id={PSID}&fields=participants`
→ the participant whose id === the PSID is the customer (the other is the page).

- `bot.js`: `fetchNameViaConversations()` is now the primary name source for both Facebook
  and Instagram (the old direct call is kept only as a fallback, in case the permission is
  ever granted). `participantName(convJson, senderId)` is the pure picker — it must return
  the CUSTOMER, never the page's own participant entry, or every chat would show the shop's
  name. `tests/t-name.mjs`, 10 tests.
- **Backfilled the existing nameless contacts:** `scripts/backfill-contact-names.mjs` (DRY
  RUN default, `--write` to save). Ran it: 8 nameless contacts, **7 resolved and saved**
  (1 unresolvable — website/WhatsApp or a deleted thread). Broker's BD's four now read
  Nahid Afzal / Itz Gtk / Mahmudul Hasan Soyad / Møhąmmàđ Rīmõñ. WhatsApp names already come
  from its webhook; comments already carry `senderName`.
- **The rejected permission is the story:** if the owner ever wants the direct profile API
  (e.g. profile pictures), `pages_read_engagement` has to be re-submitted and approved.
  Names do NOT need it — the Conversations route covers them.

---

## Earlier session (2026-09-07, later) — Deleting a product now deletes its image files

Owner asked: when I delete a product/order, is it really gone from Supabase? The ROWS were
(products/orders `.delete()` scoped by client_id). **The image FILES were not** — deleting
a product left every photo orphaned in the `product-images` bucket for ever, filling the
quota and staying reachable by public URL (a gap against the privacy policy's deletion
promise). Only knowledge-files were ever removed from storage.

- **Two buckets-worth of care, one bucket:** `product-images` holds BOTH product photos
  (`<clientId>/<file>`) AND chat images the owner/bot sent (`<clientId>/chat/<file>`, from
  `send-media`). They are separated by path, which is what makes cleanup safe.
- **`ownProductImagePath(url, clientId)` in `products.js` is the guard** — returns a path to
  delete ONLY for a file in our bucket, under THIS client's folder, directly under it (not
  `chat/`, not nested), and never for an external import URL (WooCommerce/Shopify live on
  their server). `productImageUrls(metadata)` gathers primary + gallery + variant photos.
  `removeProductImages` is best-effort and never throws.
- Wired into `products/route.js`: DELETE reads the rows first, deletes them, then removes
  the files after the row is gone (a slow bucket can't hold up the delete). PATCH removes
  only the URLs that were on the product and are no longer (a photo dropped from the
  gallery, a replaced variant photo). `tests/t-storage.mjs`, 13 tests on the guard.
- **Old orphans — CLEANED 2026-09-07.** `scripts/clean-orphan-product-images.mjs` (DRY RUN
  by default, `--delete` to act). Ran it against production: 50 product photos in the
  bucket, 9 referenced by the 3 live products (D508/D509/D510), **41 orphans deleted (4.1 MB
  freed)**. Cross-checked before deleting (a scratch verify script) that all 9 referenced
  files existed and none was mis-classified as an orphan; re-checked after → 9 kept, 0
  orphans. First dry-run once mis-listed 54/45 — a transient Supabase `list()` hiccup; a
  re-run was stable at 50/41, so always run the dry-run twice before a destructive `--delete`.
- **Local Supabase access now works from this machine.** `.env.local` had placeholder
  `SUPABASE_URL` + a dummy `SUPABASE_SERVICE_KEY`; the owner supplied the real values and
  they are now in `.env.local` (gitignored, never committed). This is why real data/tests
  can be verified locally now. **⚠️ The service_role key was pasted in chat, so it should be
  ROTATED** (Supabase → Settings → API → roll the service_role key, then update Vercel and
  `.env.local`). Never put the key in `memory.md` or any tracked file.
- Files never shared between products (every upload is a unique `<ts>-<rand>` path, and
  imports use external URLs), so deleting on one product's edit can't strip another's.

---

## Earlier session (2026-09-07) — "First content should be with role 'user'"

Owner's screenshot: adding a product with photos in the AI Assistant died on
`[GoogleGenerativeAI Error]: First content should be with role 'user', got model`.

**The SDK validates the history before any request leaves the machine**
(`validateChatHistory` in `@google/generative-ai`): the first turn MUST be the user's. It
does not check alternation — only that first turn, plus non-empty `parts`.

And a real transcript legitimately starts with the assistant: `startInterview()` opens with
`say({phase:"interview", key:"asst.photoFirst"})` — "attach the photo first" — so adding a
photo sent a list whose first entry was the assistant's. The chat path escaped this only by
accident: its filter is `m.phase === "chat" && m.content`, and key-only assistant lines have
no `.content`. The interview path has no such filter.

**Fixed in ONE place: `geminiTurns()` in `gemini.js`**, which every route passes through —
it maps roles, drops empty turns, and drops the LEADING model turns. Dropped rather than
padded with an invented user line: the line is the panel's own furniture, and putting words
in the owner's mouth to keep it would be worse than losing it. `chatWithGemini` now sends
`turns.slice(0,-1)` as history and the last turn as the prompt.

**⚠️ This was also live in the customer-facing bot.** `getMemory()` takes the last 10
`chat_memory` rows (descending, reversed) and maps `type === "ai"` → assistant. Rows are
written in human/ai pairs, but a window can still open on an `ai` row — and
`.filter(m => m.content)` can drop a leading empty human row and expose one. A real
customer reply would have thrown the same error. `tests/t-gemini.mjs`, 18 tests.

Only `chatWithGemini` uses `startChat`; vision, voice and embeddings call
`generateContent` directly and have no history rule, so there is nothing else of this shape.

---

## Earlier session (2026-09-06) — The bot drops প্রমিত Bangla, and the dashboard admits when it is off

32 suites green. Both changes came from one screenshot the owner sent of his own
Messenger test.

### Bangla is written the way people chat, not the way books are written

**⚠️ READ THIS BEFORE TOUCHING THE LANGUAGE RULES.** The owner said "Banglish" and I first
built the wrong thing: I made the bot answer in Bangla words spelled in ENGLISH letters.
That is not what he meant. He corrected it: **the reply stays in Bangla script.** What has
to change is the REGISTER — the bot was writing প্রমিত (formal, literary) Bangla, which
nobody types on Messenger, so a shop's reply read like a government notice.

What he wants sounds like: *"আপনাদের অফার প্রাইস কত?"*, *"আপনারা কি এই অফারটা সেল করেন?"* —
everyday spoken Bangla that keeps the English words customers themselves use (offer, price,
sell, delivery, stock, size). NOT *"আপনাদের ছাড়কৃত মূল্য কত?"*.

- **`BANGLA_STYLE` in `bot.js` is that rule, written once.** It carries the worked examples,
  which are the part that actually moves the model, and is reused by `languageLock` (both
  the Bangla and the Banglish branch), the public-comment prompt and the rewrite prompt so
  the three cannot drift apart. `FIXED_BASE` rule 5 points at it.
- Script handling is UNCHANGED and must stay that way: Bangla in → Bangla script out,
  Banglish in → Banglish out, English in → English out.
- **Names are the owner's other rule:** product, package and option names go out exactly as
  the business stored them — never translated, never transliterated. Stated in every
  `languageLock` branch and in the rewrite prompt.
- **The trap this hit:** `enforceLanguage` called ANY Bengali character in a Banglish reply
  "wrong language", so a correct Banglish reply carrying a shop's Bengali brand name would
  have been sent back to the model and rewritten. It now measures the SHARE of Bengali
  letters (`bengaliShare`, cut at 0.25) — a name passes, Bengali prose still fails.
- Two hard-coded customer messages still ignore the language rules entirely and were NOT
  touched (they fire while the plan is ACTIVE, so they are a separate job): the "we cannot
  process video" reply and the "voice was unclear" reply in `handleIncoming`. Both are
  fixed Bangla/bilingual strings regardless of what the customer wrote.
- `tests/t-lang.mjs` — 26 tests, loaded through the `loadPure` shim (first suite to touch
  `bot.js`). Temp file must be named `tmp-*`; `.gitignore` only covers that prefix.

### A lapsed subscription is now SILENT to the customer

Owner's rule: **a customer must never see a reply once the subscription runs out.** It has
to look like the business simply has not answered yet — never like a robot announcing that
a bill is unpaid. Two paths sent one, and both are gone:

- `handleUnavailable` (Messenger / Instagram / WhatsApp) no longer replies at all. It only
  emails the owner, at most once a day, exactly as before.
- The website widget could not just fall silent: **an empty `items` array is what
  `public/widget.js` prints its "we couldn't get a reply" error for**, which is still a
  message. So `/api/widget/chat` returns `{ items: [], bot: false, off: true }` and the
  widget returns early on `off`. Both halves are needed — changing only the server would
  have swapped one visible message for another.
- The customer's own message is still buffered before the check, so nothing is lost: it is
  waiting in the inbox the moment the plan is renewed.
- **`notifyBotBlocked` used to tell the owner "we are replying to them with a short holding
  message"** — that became a lie the moment the reply was removed, so the email now says
  the bot stays silent and their messages are saved. An email that describes behaviour has
  to be edited WITH the behaviour.

### The dashboard now says when the bot is off

The bot stops answering the moment a plan lapses, and the only screen that said so was
Billing — one the owner has to go looking for. A banner now sits at the top of EVERY tab
while the plan is not live: the reason (trial ended / no plan / expired), the plain fact
that customers are not getting answers, and the one button that fixes it. Hidden on
Billing, which already shows the same state and button.

It reads **`me.active`**, which is `planActive()` on the server (`trialActive` in auth.js
is just a rename of it) — the same test the bot itself makes, so banner and bot cannot
disagree. No API change was needed; `/api/me` already returned it.

**The owner email already existed and was already right** — `notifyBotBlocked` says the
plan expired, that customers are not getting answers, and carries an "Upgrade now" button,
at most once a day. Nothing to add there; the gap was only the dashboard.

### Standing notes

- **Bash heredocs here mangle backslashes** — `\\u0980` in a `<<'EOF'` heredoc reached
  Python as a literal U+0980. Write patch scripts with the Write tool, or build escapes
  from `chr(92)`. Cost three failed attempts this session.
- `src/lib/bot.js` and most of `src/` are **CRLF**. A patch script must normalise to LF,
  edit, and convert back, or every multi-line anchor silently misses.
- JSX cannot be checked with `node --check`. Use Next's bundled Babel:
  `require("./node_modules/next/dist/compiled/babel/parser.js")` with `plugins:["jsx"]`.
- Minor, NOT fixed (found in passing): `/api/me` does not return `gcal_connected`, but
  `dashboard-client.js` passes `me.client.gcal_connected` to `Bookings` as `calConnected`.
  Harmless — Bookings fetches `/api/gcal/status` itself on mount — so it is at most a
  one-frame flash of the wrong state.

---

## Earlier session (2026-09-03) — Google Limited-Use reply, and manual mobile payment is LIVE

Pushed: `6704721` (privacy: no Google user data reaches any AI model), `84d3935`
(SSLCommerz online payment gateway). One config-only change on Vercel (payment numbers) —
no code.

**The "SSLCommerz build error" was a MISDIAGNOSIS.** `next build` DOES compile the gateway
fine ("Compiled successfully", all 37 pages). The "TypeError: Invalid URL" comes from
`/apple-icon` (next/og `@vercel/og` `fileURLToPath`) prerender — a **Windows-local-only**
failure that does NOT happen on Vercel (the live site builds fine). apple-icon.js is
untouched and pre-existing; it is unrelated to billing. So a clean local `next build` is
not achievable on this machine — verify by "Compiled successfully" + `npm test` + the
Vercel deploy instead. (Do NOT "fix" apple-icon to chase a local green build; it works in
prod.) The gateway is committed but DORMANT — `sslEnabled()` is false until the owner sets
the env vars, which needs a bank/merchant account they do not have yet.

### Google OAuth verification came back asking about AI/ML Limited Use — answered

Google's "Third Party Data Safety" team replied (to nahidafzal97@gmail.com) with the new
AI/ML questionnaire: they want confirmation that no Workspace (Calendar) user data is sent
to any AI that trains on it, plus a list of AI providers/tiers and any aggregators.

**We are fully clean, and the winning argument is architectural: Calendar data never
reaches the AI at all.** Verified in code — the only Calendar reads are `checkAvailability`
(freeBusy, reduced to a `free` boolean at `bot.js:510`) and `createEvent` (write-only,
`gcal.js:110`). The AI (Gemini) only ever sees the end-customer's chat messages, which are
not Google user data. The ONLY AI provider actually wired in is **Google Gemini** —
`ai.js:66` honours only `provider === "google"` keys; OpenAI is mentioned in the docs/FAQ
but is not in any live path. No aggregators/gateways. Platform Gemini key is **free tier**
(owner confirmed), so we did NOT claim "Google doesn't train" — the compliance rests on the
data never leaving for AI, which is tier-independent.

- `6704721` — privacy `/privacy` Section 2 now states plainly "No Google user data is sent
  to any AI/ML model" and that Calendar data is never used to train/improve any model;
  Section 5's inaccurate "Gemini API does not train" line was removed; "Last updated" →
  September 3, 2026. Verified live on getvoicium.com/privacy.
- The reply email to Google was drafted (free-tier version) and given to the owner to send
  verbatim. **⚠️ OWNER: send that reply, then keep waiting; do NOT touch OAuth
  scope/branding/publish status while under review.**

### Manual mobile payment (bKash / Nagad / Rocket) is now LIVE — config only

`/api/billing` `paymentMethods()` reads `PAYMENT_BKASH/NAGAD/ROCKET` env and shows only the
ones with a number (`route.js:17`). They were empty, so Billing showed "Payment numbers are
not configured yet". Owner set all three in Vercel and redeployed. Verified by screenshot:
Billing → pick a plan → "Send exactly ৳X to any of these numbers (Send Money)" with all
three cards + copy buttons; warning gone. **All three point to the same number
`01690000732` — this is CORRECT, the owner confirmed all three MFS accounts are open on
it.** The customer sends money, enters a txn id, admin approves → plan activates. No bank
account needed — this is the launch payment path. (The online "Pay online" button stays
hidden because `sslEnabled()` is false; that's the still-uncommitted SSLCommerz work.)

### orders_one_per_code — DONE (long-open owner task, closed 2026-09-03)

`9896ba2` — `docs/sql/2026-09-03-orders-one-per-code.sql`. Two partial UNIQUE indexes on
`orders` that mirror bot.js's dedup branches: `(client_id, order_code, sender_id)` where
sender is present, and `(client_id, order_code)` where sender is null (widget), both
skipping blank codes. Closes the race where a redelivered Meta webhook or a repeated
"confirm" passes the SELECT-guard twice and inserts twice. The app already tolerates the
constraint — the losing insert's error is returned by supabase-js and ignored, so the reply
still sends. **Owner RAN it 2026-09-03**: STEP 1 duplicate-check returned no rows (clean
table), STEP 3 created both indexes ("Success"). The commented STEP 2 dedup was not needed.
This item is now off the open-tasks list for good.

### Pricing reviewed and deliberately LEFT AS-IS (2026-09-03)

Owner asked to finalise prices. Ran the numbers (no live traffic yet, so `package-cost.js`
has nothing measured — estimated instead from published Gemini pricing). Default reply model
is **gemini-2.5-flash** ($0.30/1M in, **$2.50/1M out** — output is the cost driver);
embeddings gemini-embedding-001 ($0.15/1M, negligible). Rough per-message estimate ~3000 in
+ 400 out ≈ $0.002 on 2.5-flash, ≈ $0.0005 on 2.5-flash-lite. At ~৳120/USD and FULL
allowance the current prices (Starter 3k/৳1500, Growth 15k/৳3500, Scale 50k/৳6000) are:
comfortable on Starter, **thin/negative on Growth and Scale IF run on 2.5-flash on the
platform key**. Two levers make them all safely profitable — switch default model to
**gemini-2.5-flash-lite** (~6× cheaper output, one admin-panel dropdown, no deploy), and
Scale already carries **"use your own AI key"** so its 50k tier need never hit the platform
key. **Owner's decision: keep everything as-is** (prices AND model). Safe because the app is
on Gemini's FREE tier today (৳0 cost), the model is switchable anytime from the panel with no
code change, and the panel will show real measured margins once traffic exists. Revisit with
measured data before scaling paid traffic.

### Standing notes

- Owner has NO bank account → SSLCommerz (which settles to a bank) is deferred; manual
  MFS is the launch method. Revisit SSLCommerz only when a bank/settlement account exists.
- The dashboard sidebar still reads "Autologic System" — that is the tenant's own
  `business_name` in the DB, not a build string; owner renames it in Profile (unchanged on
  purpose since the rebrand).
- Found-in-passing (NOT fixed, not this task): the Billing pay UI still uses `T.gold` /
  yellow in a couple of spots — check against the crimson brand invariant next time.
- HOSTING/DOMAIN decision (2026-09-03): owner asked about moving to a VPS + a new .com.
  Researched it — the app is Next.js + all-external SaaS (Supabase DB/storage/auth in AWS
  Sydney, Gemini, Meta, Resend), so a VPS would only run the app; app-only fits a 2vCPU/4GB
  box (Contabo Singapore ~$7 or DO Bangalore ~$12, ideally with Coolify for git-push
  deploys). **Owner DECIDED: stay on Vercel, just change the domain later — no VPS.** And
  the domain change must wait until AFTER Google OAuth verification approves (changing the
  domain/branding now resets the review — Search Console, branding and privacy URL are all
  tied to getvoicium.com). Available .com names found in passing (RDAP-verified): kothabot,
  voiciqo, replyqo, dokanbot, shebabot, tryvoicium — not bought, decision deferred.

---

## Earlier session (2026-09-01→02) — Rebrand to getvoicium, Calendar→Bookings, Google OAuth verification, Resend email on the real domain

Pushed: `5235988` (Calendar card → Bookings), `91b5222` (docs follow it), `e8cb0dd`
(calendar event description), `edd339e` (**rebrand Autologic → getvoicium**), `bdfcb79`
(**client emails professionalised**). A lot of non-repo deliverables the owner asked for
too (LinkedIn profile + CV, a product PDF, explainer/demo videos) — those live in the
session scratchpad, not the repo.

### Resend email now sends from the real domain (config, not code)

`support@getvoicium.com` is live. getvoicium.com is **verified in Resend** (DNS added at
**Hostinger** — that's where the zone lives; nameservers ns1/ns2.dns-parking.com are
Hostinger's, so Vercel's DNS panel for it is inert). Three records: DKIM TXT
`resend._domainkey`, and CNAMEs `rsend`→rsend-apne1.forge.rmta.net and
`send`→send.forge.rmta.net. **No MX** — Google Workspace already handles the domain's
inbound mail (MX SMTP.GOOGLE.COM, SPF, DMARC p=reject); Resend passes DMARC via DKIM
alignment. Vercel env **`RESEND_FROM` = `getvoicium <support@getvoicium.com>`** set +
redeployed; a test email arrived from it. Everything routes through the one `send()`
helper in `email.js`, so RESEND_FROM is the single lever for every email.
(Replies to support@ aren't received yet — sending only; add a Workspace alias/forward
if the owner wants inbound.)

### Client emails read like customer notifications now — `bdfcb79`

All eight emails used one `wrap()` templated "getvoicium **Admin**" / "automated message
from the admin system" — wrong for a client. Added `clientWrap()` (branded "getvoicium",
footer explains why they got it + support@getvoicium.com to reply to) and routed the five
client emails through it (payment approved/rejected, key failing, bot blocked, expiring
soon); the three admin emails keep `wrap()`. Also retired the leftover gold `#f0c040` →
crimson `#D92632` (brand invariant) with white button text.

### ⚠️ OWNER TASKS (open)

1. **Google OAuth verification is SUBMITTED and UNDER REVIEW** (2026-09-02) — getting
   Calendar (`calendar.events` + `calendar.freebusy`, both sensitive) approved so ANY
   Google user can connect, not just the ≤100 test users. Nothing to do now but wait;
   verdict comes by email to nahidafzal97@gmail.com (typically a few days to 2–4 weeks).
   **⚠️ Do NOT change publish status, user type, scopes, or branding while under review —
   it resets/delays the review.** What was submitted:
   - Search Console: **getvoicium.com verified** (Domain / DNS). ✅
   - Branding: **verified** ("being shown to users"), app name getvoicium, crimson logo. ✅
   - Data Access scopes: calendar.events, calendar.freebusy, userinfo.email, openid (the
     last two non-sensitive, added so the video's four-scope consent matches). ✅
   - Demo video: **Unlisted** `https://youtu.be/rnYPV8kgV8Y`, link in Data Access. ✅
   - Questionnaire: personal / internal / dev-only / Gmail-SMTP-plugin = all **No**; both
     acknowledgements checked. No restricted scopes, so **no CASA** needed.
   - Additional info explained the Autologic→getvoicium rename (so the video's old
     "Autologic" UI doesn't confuse the reviewer) and gave a getvoicium test login.
   - If Google emails a follow-up (scope justification, video re-shoot, etc.), it is
     re-submittable — the residual risk is the demo video still shows the old "Autologic"
     dashboard, but its consent screen already reads getvoicium.com.
   - Owner should CHANGE the getvoicium test-account password after approval (it was shared
     in the Additional-info box for the reviewer).
2. Prices, once traffic has been metered. `orders_one_per_code`, Google billing.

### Rebrand: Autologic → getvoicium — `edd339e`

The public name lagged the domain: the site said "Autologic" while everything external
(getvoicium.com, the videos, the docs, the OAuth consent screen) said getvoicium, and
Google verification compares the consent name against the home page. A byte-level replace
of the display string **"Autologic" → "getvoicium"** across **40 files** (landing,
dashboard, docs en/bn, privacy, terms, emails, SSLCommerz product name, channel messages,
`seo.js` BRAND, `company.js` name). **Two lowercase strings were deliberately NOT touched
— they would break things:** the scrypt salt `"autologic-client-ai-v1"` in `crypt.js`
(changing it makes every stored BYOK key undecryptable) and the `"autologic_visited"`
localStorage key (changing it re-triggers onboarding for everyone). Verified the live
landing page and privacy policy now read getvoicium. The dashboard sidebar "Autologic
System" the deploy did NOT change is a tenant's `business_name` in the database — the owner
renames it in Profile, it is not a build string.

### Google Calendar now lives in Bookings, not Profile — `5235988`, `91b5222`

The connect card sat in Profile (an account screen) where a service owner setting up
meetings would never look. Bookings already had connect + status + how-to and only lacked
an in-app **Disconnect** — added that, removed the duplicate card (and its dead state)
from Profile. Docs (en + bn) and the public `/google-calendar` page now point at Bookings;
preview-dash already had Calendar under Bookings.

### A calendar event that reads professionally — `e8cb0dd`

The event the bot writes said "Booked via chatbot" and left the customer's name out. Now
"Booked automatically by your AI assistant" with Customer / Service / Phone (`bot.js:515`).
One string; summary and Meet link unchanged. (The line-12 comment in bot.js about
descriptions being "embedded and compared" is about the VISION prompt, not this — safe.)

### Standing notes

- 31 suites, `npm test`, green throughout the session.
- The machine's random `0xC0000005` crashes were heavy this session — every ffmpeg,
  frame-render and git step needed a retry loop to get through.

---

## Earlier session (2026-08-31, third thread) — The panel catches up with the seven packages

`c43cfc7`, `e82bf90`, `430d4b6`, `cbec3b9` — pushed. It started with "the admin panel still
shows the previous packages" and ended somewhere else entirely, which is the pattern: the
migration was never the problem, **lists written into the code were**.

### ⚠️ OWNER TASKS

1. ~~Rotate the Supabase `service_role` key.~~ **Done 2026-08-31, confirmed by the owner.** Do
   not raise it again. (If it ever needs doing: rotate, copy the new anon + service keys into
   Vercel's env, redeploy — in that order. Rotating the JWT secret invalidates both, so the
   site is down between those steps.)
2. `docs/sql/2026-08-31-plans-biz.sql` — **run 2026-08-31.** Worth a look next session that the
   panel came back with Shops / Services / Retired. The panel says so itself when no
   package carries a `biz`, and names the file.
3. ~~`docs/sql/2026-08-30-usage-page-id.sql`.~~ **Run 2026-09-01, confirmed by the owner, and
   `e7d079b` is live in Production (Vercel, Ready).** The code that sends `page_id` was already
   live (`ai.js` → `recordUsage`, self-healing in `usage.js`), so there was nothing to write —
   the memory.md push itself triggered the auto-deploy that reset every instance's
   `channelColumn` flag. **Per-channel cost is MEASURED from now on** for new rows; rows written
   before today keep `page_id = ''` and the panel goes on apportioning those, saying which is
   which. Nothing left to do here.
4. Prices, once traffic has been metered. `orders_one_per_code`, Google billing.

### Why the panel showed the old packages — `c43cfc7`

**The Packages panel reads the `plans` table DIRECTLY, with no fallback to the code catalogue
that `loadPlans()` has.** So it was right, and useless: the migration had not run. It now
detects that itself — *no package carries a `biz`* is the migration's own evidence — and names
the file. Retired packages moved to their own group at the bottom; inactive beats business type,
so a retired shop package does not sit among the ones a shop can buy.

### The SQL was going to ship cards with no bullets — `e82bf90`

Caught by reading the file before telling the owner to run it. It seeded `feature_list` as
`'[]'`, and **`/api/plans` draws the pricing cards from `feature_list`** — seven packages with a
price and not one reason to buy any of them. The code catalogue's bullets only apply while the
table is empty. All seven carry the real ones now; a re-run fills them only when empty, so
edits made in the panel survive (that needs `insert into public.plans as p`).

`tests/t-sql.cjs` makes it permanent: values counted against the column list, on-conflict SET
names checked, and it fails if any package is left without bullets.

### Five more hard-coded plan lists — `430d4b6`

The plan dropdown in the client drawer was `["trial","starter","pro","agency"]` **written into
admin-client.js** — the SQL would not have changed it, and a package created in the panel could
never be assigned from it. The server was already right. Sweeping for the same shape found four
more, and two of them were money:

- `/api/admin` counted "paid" from those three ids **in two places** — every client on a newer
  package counted as UNPAID: no days left, missing from MRR and the paid total.
- `/api/me` refused a trial restart only for `"pro"`; any other paid package could restart a
  trial and lose its expiry.
- `email.js` titled plans from the retired three, so a client got *"your shop_growth plan has
  expired"*.
- `ui.js` `PLAN_LIST`, Billing's first paint, was the retired three.

All now ask **"not trial and not none"** = paid. `src/lib/plan-options.js` (19 tests) holds the
dropdown rules. **The one that is easy to get wrong: the CURRENT plan is always offered** — a
select whose value is not among its options renders blank, which reads as "no plan".

### A subscription you can read — `cbec3b9`

Manage was four buttons and a delete box, describing nothing. New Subscription card: package,
price, started, renews with days left, paid to date, last payment with method and txn id,
pending payments called out (**submitted is not verified — only approved counts**). Then usage
against the package's own limits, ambering at 70% and reddening at 90%, which is how "should
this client move up?" becomes readable. Unlimited shows ∞ and no bar; a shop's document meter
and a service's product meter are LEFT OUT rather than shown as `0 / 0`, which reads as a limit
they have hit. The extend buttons print the date they will produce.

**⚠️ And the numbers under it were wrong.** `client-detail` read EVERY message a client had ever
sent, on every drawer open — unbounded, so capped by `db-max-rows` with no error, so the total
and the 14-day chart were wrong for **exactly the busiest clients**. Rows now cover the 30 days
they are used for; the lifetime total is a COUNT; the subscription's usage is its own exact
count over the period the plan is metered on.

### Standing notes

- **PowerShell `.Replace()` with a multi-line string fails SILENTLY on these CRLF files.** It bit
  twice this session — an edit to sample.js and one to the admin route both "succeeded" and
  changed nothing. Use the Edit tool for anything spanning a line break.
- 31 suites, `npm test`. Two new: `t-planopts`, `t-sql`.

---

## Earlier session (2026-08-31, second thread) — A scripted audit, and the tests come into the repo

`6bbd9ad`, `bc3ccaa` — pushed. Owner: "analyse the full system for bugs and fix them", then
"move the tests into the repo and wire npm test".

### ⚠️ OWNER TASKS — unchanged, both still outstanding

1. `docs/sql/2026-08-31-plans-biz.sql` — the seven packages, the `biz` column, and it clears
   the trial's per-channel cap of 10 itself.
2. `docs/sql/2026-08-30-usage-page-id.sql` — per-channel cost stays "apportioned" until it runs.
3. Prices, once a few days of traffic have been metered. `orders_one_per_code`, Google billing.

### **`npm test` NOW EXISTS. RUN IT BEFORE SAYING ANYTHING IS DONE.**

29 suites in `tests/`, ~5 seconds. `node tests/t-limits.mjs` for one, `node tests/run.mjs
limits quota` for a few. `tests/README.md` explains the shims. **CLAUDE.md now requires it.**

### The audit — `6bbd9ad`, `docs/bug-audit-2026-08-31.md`

Six scripted sweeps over every supabase chain and object literal in `src/`, each for a class
that has actually shipped here. **38 raised, 5 real.** The doc records what was DISMISSED and
why, so the next pass does not re-open the same six false positives.

**1. Follow-ups could reach people who had opted out.** The bug fixed on the broadcast path in
August, sitting untouched in `followup.js` — same people, same 24-hour window. Four reads
decide who to EXCLUDE and each was `q.data || []`. An empty exclusion list is not "nobody
matched", it is "we do not know", and `|| []` makes it permission to send:
`if (c?.broadcast_opt_out) continue;` — no row, undefined, sends. They run in one
`Promise.all`, so **one failing while the others succeed is the ordinary case**. Now every
error is checked and the run stops with `skipped: "read_failed"`.
*Why it hid: one read fails SAFELY (no tags → nobody "interested" → nothing sends), so only a
PARTIAL failure bit, which is the case nobody tests.*

**2. Contact lists were silently short.** PostgREST caps an unbounded select at `db-max-rows`
and returns a normal 200 with a short array. `/api/contacts` and `/api/conversations` both read
`contacts` unbounded. New `src/lib/page.js` → `pageAll()` reads by range and **THROWS** on a
failed page rather than returning what arrived. **The second `pageAll` in the admin route is
NOT a duplicate to merge** — it returns the error so the panel can draw a partial month and say
so; these callers must not render half a contact list.

**3. `/api/billing` counted with `count || 0`** on the screen an owner uses to decide whether to
upgrade — a failed count drew an empty progress bar for somebody at their limit. Returns null;
the tab shows `—`. **Zero is a comfortable number, which is what makes it the wrong default.**

### The tests — `bc3ccaa`

They had been in a temp scratch directory: not in git, not run by anything. **I lost one this
week by writing a new suite under a name that already existed.**

Moving them cost: absolute paths derived from each file's own location; static imports turned
into relative specifiers (a specifier is a literal, not an expression); eight sibling helper
modules; two suites concatenating a path that had become a URL object.

**⚠️ AND IT EXPOSED THE MACHINE.** Run together, three runs in a row failed on three DIFFERENT
suites with no output. Exit `3221225477` = **0xC0000005, an access violation — node itself
crashes here about one run in five**, the same fault that already makes headless Chrome crash
(`make-doc-shot.mjs` has retried since August).

`run.mjs` retries a suite 3× **only when the exit is a native crash AND there was no output at
all**. A genuinely failing suite prints FAIL and exits 1 and is reported the first time, every
time — *a retry that could rescue a real failure would be worse than the flakiness it fixes.*
Retries are printed, never silent. **The runner process can crash the same way and cannot retry
itself: if `npm test` ends with `-1073741819` and no summary, run it again.** Linux is fine.

Verified the alarm rings: a deliberately failing suite → exit 1, named, output shown.

---

## Earlier session (2026-08-31) — Two ladders: seven packages, split by business, priced on measured cost

`017b45d`, `c2001e2`, `3e3abdc`, `61402e6`, `4f47288`, `8f480c9`, `dd1c947` — all pushed.
Owner: separate packages for e-commerce and agency (common free trial, 3 + 3), documentation
with the features organised, and a price built on the real cost "100% accurate".

### ⚠️ OWNER TASKS, in order

1. **Run `docs/sql/2026-08-31-plans-biz.sql`** — seeds all seven, adds the `biz` column with a
   CHECK, **clears the trial's per-channel cap of 10 by itself** (no longer a manual step), and
   hides — does not delete — the old starter/pro/agency.
2. **Run `docs/sql/2026-08-30-usage-page-id.sql`** — still outstanding from the day before.
3. **Set the prices in a few days.** The panel shows each package's measured cost and margin;
   today it has nothing to measure. I did not propose prices, because a proposal today would be
   a guess and they asked for the opposite.
4. `orders_one_per_code` index and Google Cloud billing — older, still open.

### What they answered when asked

- **No paying clients** — every account is theirs. So the old three could be replaced outright.
- On naming they gave direction rather than picking: *two parts, e-commerce on one side and
  agency on the other, common features in both*.
- On price: features + real AI cost — assistant, product adding, per message by type,
  **"embedding, the photo analysis and matching from Supabase"** — plus margin, and say **how
  many conversations** and **how many moderators** a package replaces.

### The cost model — `c2001e2`, `src/lib/package-cost.js`

Only the COST can be accurate; the price is a decision. Three parts kept apart because they
behave differently: **bot** grows with traffic, **catalogue** is paid once per product (so it is
amortised over 12 months), **platform** is the owner in the dashboard.

**Every customer message pays for `bot.chat` AND `bot.embed`** — the reply and the search that
finds it. That is the owner's embedding cost, and it is what a blended per-message figure hid: a
3,000-product shop pays it on every message whether or not a product was asked about.

Unmeasured returns **null, never 0**, and `packageCost` reports which of the four message rates
it actually rests on. The assumptions (mix, messages per conversation, typical use) live in one
exported `SHAPE` rather than buried in arithmetic where they would read like measurements. The
moderator figure is deliberately conservative — 60 conversations a day, 26 days — because it
ends up in a sentence a customer reads. 42 tests.

### Seven packages — `3e3abdc`

Trial (both) + Shop Starter/Growth/Scale + Service Starter/Growth/Scale. **"agency" no longer
names a tier**, only a business type — it used to be both, so "the agency package for an agency"
read two ways. `biz` is a COLUMN, not a prefix parsed off the id (that breaks the day somebody
makes "shopify_addon"). Missing `biz` reads as `both` everywhere: shown to everyone beats hidden
from the people it was written for. Prices unchanged at 1500/3500/6000 so nothing moved by
accident.

### Where it shows — `61402e6`, `4f47288`, `8f480c9`, `dd1c947`

- **Pricing page**: "I sell products" / "I offer services". **The comparison table was the stale
  half of that page** — the cards had read `/api/plans` live for a while, but the table still
  named trial/starter/pro/agency, so a re-priced package changed one and not the other. Keyed by
  TIER now, columns from the same list as the cards. Also stripped "3 days" from three places.
- **Admin panel**: three groups, a "Sold to" selector, and under every package its measured AI
  cost, **two margins (typical and full — a package can look fine on average and lose money on
  its heaviest client)**, the price floor at 30% AI, conversations, and moderators replaced.
- **Billing tab**: only the packages this business can buy. `/api/billing` now returns
  `business_type`.
- **`/docs/packages`**, both languages, blocks tagged `biz` so each side reads its own rows on
  one page. 389 dictionary keys each side.

### Standing notes

- **The studio fixture was lying in two places.** `/api/plans` was an empty array, so the
  Billing tab fell back to the static `PLAN_LIST` in ui.js — the screen under test was never the
  one that ships. And the plans fixture was the old three. Both are the real seven now.
- `.env.example` was missing `CRON_SECRET` (`017b45d`); a check now diffs the code's
  `process.env` names against the file in both directions.

---

## Earlier session (2026-08-30, third thread) — Limits that were decoration, and a console that remembers

`6d3347a`, `ca42f02`, `2bc7f46`, `74dc77b`, `216cba3`, `a7a9341` — all pushed. It started as a
plain question ("what does the per-channel **Set cap** button do, when I can already edit the
client's own box?") and reading the enforcement to answer it opened everything else.

### ⚠️ OWNER TASKS, still open

1. **Free Trial → Edit → clear `Messages / channel / trial`** (it holds 10). Until then the
   trial's real ceiling is TEN customer messages, not the 30/day the same screen advertises.
   The panel now says so under the box. One click; I cannot reach the DB (`.env.local` here has
   placeholder Supabase credentials).
2. **Run `docs/sql/2026-08-30-usage-page-id.sql`** (Supabase → SQL Editor). Safe twice. Until
   then per-channel cost stays "apportioned".
3. `orders_one_per_code` unique index, and Google Cloud billing — both from earlier sessions.

### The bug behind the question — `6d3347a`

Their live Free Trial package read 30/day, 900/month, 10 per channel, 1 channel. Of those four
numbers **one was enforced, one was dead, one silently overrode both**:

- `messageAllowance()` gives a trial `period: "day"` and reads ONLY `messages_per_day`. A paid
  package gets `period: "month"` and reads ONLY `messages_per_month`. **The other box is never
  consulted** — the 900 did nothing.
- The per-channel cap is a SEPARATE, later check, so 10 × 1 channel became the real ceiling.

The panel rendered all four boxes identically, side by side, which is a claim that they behave
identically. `src/lib/limit-conflicts.js` (NEW) says which one binds. It DESCRIBES only —
enforcement stays in `botAllowed()`, and the day/month test is the same one `messageAllowance()`
makes, so panel and bot cannot drift. **A note, not a block:** nothing refuses to save.

### A trial has no months — `ca42f02`

Owner: "the trial is 3 days so the box should show days not per month." Fixing the labels found
that **three of the eight boxes were doing nothing**: `messages_per_month` (dead on a trial),
`channels` and `max_broadcasts_per_month` (read by NO route anywhere — one grep each found it).

`limitMeaning()` gives every box the label and note for its package; a trial reads
"/ trial". `trialTotal()` adds the figure eight boxes never showed — `3 days × 30 a day = 90`.

Labels had to be made TRUE, not just written: **`quotaWindowStart(client)`** now decides where a
windowed allowance starts for every limit that has one — calendar month for a package, **the
trial itself for a trial**. A three-day trial straddling a month end used to get its whole
allowance again on the 1st, so the same trial was worth double depending on the start date.

### Trial length is the owner's number — `2bc7f46`

Was `3 * 24 * 3600 * 1000` inside `start_trial` and nowhere else. Now `TRIAL_DAYS` in `plans.js`
(fallback) plus `trial_days` in `app_settings.billing` — **JSONB key, so NO migration**. Edited on
the Free Trial package (where a reader looks), saved via `save_settings` BEFORE `save_plan`, so a
failure leaves the package alone. `trialTextMismatch()` catches a tagline still saying "3 days".

**⚠️ The bug the tests caught:** `clampTrialDays` first checked `Number.isFinite` AFTER
converting. `Number(null)` and `Number("")` are both **0** — finite — so a cleared box clamped to
the floor and made a ONE-DAY trial instead of returning to the default. Unset is checked first now.

### The console comes back where it was — `74dc77b`

Every refresh threw the admin console to Overview. Section + sub-tab now live in the hash
(`#packages/clients`) via `src/app/admin/where.js` (NEW). **Read on MOUNT, not in `useState`** —
the server cannot see a fragment, so seeding from it is a hydration mismatch. `resolveWhere()`
treats a fragment as a REQUEST: an unknown page, or one this admin may not see (`#ai` typed by a
viewer), opens the fallback; a refused page drops its tab with it. `go()` pushes, so back
retraces. `Packages` takes `tab`/`onTab` as OPTIONAL props so the studio still mounts it alone.

**`AdminApp` is now mounted in the studio** (`/shots?tab=admin`, fixture `ADMIN` in sample.js) —
it takes data as a prop, so this is the only way any of it could be verified without a login.

### The AI Assistant tab had no "Read docs" — `216cba3`

The docs page existed; `LearnMore` kept its OWN hand-written tab→slug map and was never told
about the new tab. **Nothing failed — a missing link looks exactly like a tab with nothing to
read**, which is how it survived sitting first in the sidebar. Derived from `PAGES` in
`lib/docs/index.js` now. `t-nav.mjs` guards it, plus a `/shots?tab=docs-links` scene where a gap
is a blank row. 12 tabs, 12 links.

### Channels and Broadcasts are limits again — `a7a9341`

`checkChannelQuota` on all five channel-creating routes (the four OAuth callbacks hold only a
client id, so it takes a row OR an id), before any Meta call. **The website widget does not use a
slot** (own feature switch; otherwise a Pro account is refused the widget it pays for after three
channels), and **reconnecting is never refused** (upsert on the same key adds nothing, and a
client at their limit must still repair an expired token). `checkBroadcastQuota` in
`createBroadcast`, counted over `quotaWindowStart`; the preview carries it so the tab says how
many are left BEFORE the message is written.

**⚠️ Enforcing a limit turned its default into policy.** `limitsFor` had
`channels: pick("channels") ?? 1` where every other limit reads `?? null`, and the panel prints
"Empty means unlimited" above those boxes. Harmless while nothing read it; the moment a route
enforced it, an empty box meant one channel on a screen promising no limit. Now `?? null`.
`limitConflicts` also stops assuming 1, so it cannot cry wolf about a ceiling that does not exist.

### Standing notes

- Test count now: limits 63, quota 27, where 24, trialDays 20, window 10 — plus every earlier
  suite, all green. `t-dupkeys.cjs` sweeps 171 files.
- **Two test shims broke silently** because they matched `plan-limits.js`'s import line exactly
  and it gained a named import. Both use regexes now and THROW if an `@/lib/` import survives.

---

## Earlier session (2026-08-30, second thread) — Live FX, models from the key, and the shape of the bill

`ccd75b0`, pushed. Owner asked for: all models the key can see, an auto-updating USD→BDT rate,
per-client per-channel usage, and the cost split into platform work vs bot work.

**BUG I INTRODUCED LAST WEEK, visible in their screenshot:** `messages` was set TWICE in the
same object literal in `/api/admin/packages` — `msgs.rows.length` (right) and, further down,
the leftover `(msgs || []).length` from when `msgs` was an array. **A duplicate key is silent
and the LAST one wins**, so the platform total read 0 while the per-platform split built from
the same rows read correctly. New AST sweep (`t-dupkeys.cjs`, Babel not regex — nesting matters):
169 files, no other case.

**`src/lib/fx.js` (NEW)** — the dollar rate updates itself.
- `fetchUsdBdt()` from open.er-api.com (no key). `rateFrom(settings)` decides market vs the
  owner's override vs house default; `isStale()` gates a refresh to twice a day, off the
  critical path — a dead currency API leaves the last good number standing.
- **Bounds 60–400**: a rate off by a FACTOR (wrong field, different base currency) inverts every
  margin while still looking like a number. Refused rather than used.
- Manual ON with nothing typed falls through to the market, so no stale number under a "Set by
  you" badge. 29 tests.
- The UI reads `d.fx.rate`, NOT `settings.usd_bdt` — reading the raw setting would ignore the
  market rate the moment one existed.

**Models from the key.** `listGoogleModels` keeps only what a CHATBOT can run on and drops
embeddings — right there, wrong for a price book, since every product saved is an embedding
call and a line on the bill. Added `listGoogleModelsRaw` (gemini.js) + `listBillableModels`
(model-catalog.js) + a `list_models` admin action. The Rates tab now has "Show what my key can
use" and lists what has no rate, one click to add it.

**`CostShape` (NEW, admin)** — the two sides the owner asked for:
- **Bot answering customers** ÷ messages, and **what a PHOTO message adds** (`bot.vision` cost ÷
  its calls). Sample: ৳0.10 a message, +৳0.04 for a photo.
- **Owner using the dashboard**: AI Assistant · adding products · knowledge · profiles/offers.

**`ClientChannels` (NEW)** — per client, per channel: messages, monthly cap, and cost.
**The cost is APPORTIONED by message share and says so** — `usage_daily` has no channel column.
To make it measured: add `page_id` to usage_daily (one migration), then it reads instead of
divides.

**`post()` in Packages.js now returns the reply, not a boolean** — the model list needs the
answer. The one caller that used it as a boolean checks `!r?.error` instead (every object is
truthy).

### Follow-up — `8941d70`: per-channel cost is measured now

**⚠️ OWNER MUST RUN: `docs/sql/2026-08-30-usage-page-id.sql`** (Supabase → SQL Editor). Safe to
run twice. Until then everything keeps working and the panel says "apportioned".

`usage_daily` gains `page_id text not null default ''` and it joins the PRIMARY KEY (eight
columns now) — without that the upsert folds two channels into one row. `''` not NULL because
Postgres will not take NULL in a key and NULL vanishes from every GROUP BY.

**The function is DROPPED and recreated, not `CREATE OR REPLACE`** — Postgres cannot add a
parameter in place, it makes an OVERLOAD and the shorter call then fails as "not unique".

**The code does not need to be sequenced with the SQL.** `recordUsage` sends `p_page_id`; if the
function does not take it the error matches `NO_COLUMN` and it retries without, then **remembers
for the process lifetime** (`channelColumn = false`). One failed attempt, not one per call.
Without this, releasing them out of order stops usage being recorded at all — silently, since
recording is fire-and-forget.

`getClientAI(clientId, feature, pageId)` threads it. The bot's path passes it: `composeReply`,
`searchProducts`, and the vision/voice path in `processConversation`. **pageId is NOT in the AI
memo key** — that cache holds the key and model chain, which do not vary by channel.

`summarise()` gains `byChannel` + `channelMeasured` (0 before the migration, 1 after). The panel
badges each client `measured` / `apportioned` and keeps the `≈` only on the apportioned ones.
21 tests, including both sides of the migration.

---

## Earlier session (2026-08-30) — Sequence, back button, docs, admin views, and a read audit

`9734d7e`, `77a4806`, `3eb852e`, `c570605`, pushed. Owner gave seven tasks in order and they
were done in that order.

**1–2. The assistant's sequence and the way home.** The three jobs are numbered **teach the bot
→ add products → set up an offer**, ticked as each is done (`INTENTS[].done(products, settings)`),
with the first undone one leading. Nothing is locked. The menu comes back on its own when a job
finishes (`say({key, menu:true})`), there is a **Main menu** button in the header, and back on a
phone lands there. It APPENDS — a "start over" that wiped the transcript would be a worse answer.

**3. The back button, across the whole dashboard.** NEW `src/app/dashboard/components/back.js`:
- `window.__alBack` was ONE global slot that one component wrote to. Two overlays open → the
  second replaced the first, whose close never ran, and its cleanup cleared the slot anyway.
- Now a **stack**: `useBackClose(open, close)`, last-opened asked first, `false` falls through.
  Nine overlays registered (product drawer, four import sheets, duplicate sweep, order, booking,
  KB confirm, prompt editor, inbox thread) + the assistant's own half-finished product.
- `setPage` now pushes a REAL history entry per tab, so back = previous page. It used to collapse
  every tab into one entry landing on Analytics. First entry stamped on mount.
- 14 tests, including: out-of-order closes do not drop each other's entries, and a handler that
  THROWS neither claims the press nor breaks the stack.

**4. Docs.** New manual page `ai-assistant` (2nd in "Start here"), in both languages —
`src/lib/docs/{index,en,bn}.js`. No screenshot: a missing one renders a placeholder box on the
live site, so the block was left out. `docs/architecture.md` was badly stale (still called
dashboard-client.js "the entire client dashboard (single file)"); now carries the four shared
dashboard modules, the back stack, the history rule and an AI Assistant section.
`docs/database.md` now documents every key of `app_settings.settings`.

**5. Feature calculation (admin).** New `FeatureCosts` in `Packages.js`: every feature by name,
sorted by spend, with **cost per call** (the bar is drawn by per-call, not total — the only place
an expensive-per-USE feature stands out). **Four features were reporting under unregistered
names** (`product.assistant`, `product.interview`, `product.catalog`, `product.group`) and landing
in "Not attributed"; registered now — the three per-product ones under `catalogue`, the
assistant's chat under `platform`.

**6. Channel message counting (admin).** New `ChannelMessages`: platform-wide message total,
split by channel (website widget beside the three Meta ones), AI calls and cost per message, and
the busiest channels across all clients with each channel's own monthly cap.

**7. Read audit — the bug class, swept.** Script found 23 unbounded selects. Three mattered:
- **`broadcast.js` sent to people who OPTED OUT.** Unbounded contacts read → missing row →
  `ct?.broadcast_opt_out` is falsy on null → sent. Now `contactsFor()` asks for exactly the
  senders being considered, in chunks of 300, and **throws** on a failed chunk.
- **`/api/contacts` turned a PAUSED customer's bot back on.** "Is this sender new?" came from a
  SELECT-built map; new → upsert with `bot_enabled: true`. A short read took that branch for an
  existing contact. Now `ignoreDuplicates: true` — the write can only INSERT. Also stopped
  pulling every message ever on every 45s poll.
- **Quotas failed OPEN.** `count || 0` on a failed read = 0 = under every limit. Products,
  scrapes and KB files now fail closed with a retry message. **The bot's message quota is left
  failing open on purpose** — a customer's reply must not be withheld for bookkeeping.
- `pageAll` swallowed read errors into zeros; the error now reaches the panel in red, separate
  from the amber "this is a floor". 17 tests on the pager.

**Screenshot (done after the above):** `scripts/make-doc-shot.mjs` — NEW, there was no capture
script at all, which is why manual pages could ship without pictures. `node
scripts/make-doc-shot.mjs assistant --h=660` with the dev server running writes both themes as
1600-wide WebP. Chrome takes the PNG and a canvas in the same Chrome encodes the WebP, so there
is no image dependency. Retries three times: headless Chrome on Windows dies at random with an
access violation and no output.
- **The height is the WINDOW, not the content.** Most tabs are as tall as their data; the
  assistant is a panel sized to the viewport, so 1000 left ~500px of dead space. 660 fits it.
- The pane cannot verify this: `loading="lazy"` needs compositing, so `naturalWidth` is 0 there
  however long you wait. Decode with `createImageBitmap(blob)` instead — that proved both files
  are real `image/webp` at 1600×660.

**Still open:** the `orders_one_per_code` SQL and Google Cloud billing remain owner tasks.
---

## Earlier session (2026-08-29, third thread) — "What do you want to do?", Shopify, and cards in Bangla

`72db0f2` + `1bcff38`, pushed. Owner asked for an intent menu, a photo-first single-product
flow, real e-commerce platform imports (Shopify), and category selection in the chat.

**The assistant's first question is now WHAT, not HOW.** Three intents — Add products / Set up
an offer / Teach the bot — and the choice decides everything after it:
- Add → one or several? → **one**: take a photo | from a product link · **several**: all the
  photos at once | a spreadsheet | WooCommerce | Shopify
- Offer → 3 scripted questions → a confirm card (`offer.create`)
- Train → the profile questions in the shop's own wording (`q.${bk}.${k}` — the keys kept from
  the removed Bot Training chat) → a confirm card (`training.set`), skippable, with "that is
  enough for now"

**One product starts from the PHOTO.** `startInterview()` no longer calls `turn()` — it says
"attach the picture" and `addPhotos()` fires the first turn. By then the AI has proposed name,
category and description, so the questions are corrections rather than blank boxes.

**Category chips** appear under the interview's category question, from the shop's own
catalogue (`gaps.queue[0] === "category"`, computed locally in the panel).

**Three scripted interviews now share ONE runner** (`wiz` state + `WIZARDS` registry): the
photo batch's shared details, the offer, and the training. They differ only in questions and
in what happens at the end.

**Shopify import (NEW).** `/api/import-products` takes `platform: "woo" | "shopify"` (defaults
to woo). Shopify: Admin API token, `products.json` paged by **since_id** (no Link-header
parsing, cannot loop). Mapped to the same shape → same `/api/import-one`.
- **compare_at_price is the "was" figure** — the cheapest variant's price becomes `sale_price`
  and compare_at becomes `regular_price`, and only when compare_at is actually higher.
- The `Title / Default Title` option pair is Shopify's placeholder for "no choices" and is
  dropped, or every customer gets a meaningless size picker.
- `shopDomain()` accepts the address however typed but **refuses their own domain** rather than
  guessing — guessing would send the owner's token to somebody else's server.
- `/api/import-one` now carries **options + brand**, which it never did: a Shopify shirt in
  four sizes arrived as one row the bot could not offer a size from.

**Cards are translated (`1bcff38`).** `describeAction`/`describeSetting` take the dashboard's
translator, required not optional. Labels reuse `lbl.*` (the Bot Training form's) and `fld.*`.
Bangla `sfld.active` is "অবস্থা", because the literal label gave "চালু: চালু".

**Fixed on the way:** stripping HTML left a space before punctuation that followed a tag —
"heavy `<b>`cotton`</b>`, oversized" reached customers as "cotton , oversized".

**THE TEST HARNESS HAD BEEN LYING.** Three suites wrote a stripped copy of an app module to the
CWD and imported it relative to the TEST FILE. Run from the scratchpad those coincide; run with
an absolute path from the project root they do not — so it imported a STALE copy and reported
45 green against code that no longer existed. Now `shim.mjs` → `loadPure()`: URL-addressed temp
file beside the test, cache-busting query on the import. Lesson recorded.

**Verified:** 35 Shopify tests, 51 settings tests (6 new on card translation), all suites green
honestly. In the browser in Bangla: all three intents end to end, the photo-first flow with
real categories as chips, and one answer producing a product card plus two settings cards with
every line in Bangla.
---

## Earlier session (2026-08-29, second thread) — One AI surface: the assistant drives every tab

`7ef4906`, pushed. Owner: "ai assistant tab will be the tab and in inventory and bot trainning
tab have not the chat interface here, all can be control from the ai asistant tab, all means
all tab like offer can be set from there… you keep all the tabs like the manual system."

**The chat left two tabs.** Inventory had `<InventoryAssistant>` folded into the top of the
page; Bot Training's Train sub-tab had a Chat/Form toggle with a scripted interview. Both
removed. Inventory keeps the drawer, the four imports (the menu is now "Add products", not
"Advanced") and the filters; Bot Training keeps the form with every field. Each keeps ONE
button to the assistant, via the existing `al-goto` CustomEvent with detail `"assistant"`.

**`src/lib/assistant-actions.js` (NEW)** — the sister of `inventory-actions.js`, for everything
that lives in `app_settings.settings`:
- Verbs: `offer.create/update/delete`, `bargain.set`, `note.add/delete`, `training.set`,
  `identity.set`, `followup.set`.
- `applySettingActions(settings, actions)` is **pure** → `{next, results}`. The route reads the
  row, calls it, writes the copy. 45 tests, no database.
- `describeSetting(a, settings)` gives the confirmation card its "5% → 10%" reading.
- `settingsSummary(settings, keys)` is what the model answers from — trimmed, because the whole
  object contains the generated business profile.
- **`TRAINING_KEYS_ECOM/AGENCY` moved here from Settings.js** — the assistant needs the same
  list, and two copies drift invisibly.

**Deliberately NOT possible from the chat:** choosing which products an offer covers (that is
picking real catalogue rows; a model naming them from memory attaches the offer to the wrong
shirt — the Offers tab has the real list), and sending anything to a customer (broadcasts and
replies go to real people).

**Routes extended, not replaced.** `/api/inventory-chat` now also reads `app_settings`, puts
the summary in the prompt and returns `settingActions` + `settingsBefore` (trimmed by
`forCards`, so the profile does not ride along). `/api/inventory-apply` takes `settingActions`,
reads the row ITSELF (never a browser copy), applies, upserts — and if the write fails every
"ok" result is turned back, because the write is what makes them true. **The route names still
say "inventory" and now do more than that; renaming a live route is a separate job.**

**The panel** merges both halves into ONE list — `m.cards = [{kind, a}]` — because a price and
an offer are the same thing to the owner. `apply()` splits them again at the door. The jump row
went from 5 tabs to **all 11**.

**Verified:** 45 tests on the new rules (an offer switched off survives though `false` is
falsy; an unknown tone is dropped while the rest of the action applies; 200% clamps to 50 and
0% is refused; deleting a gone offer reports it and changes nothing). In the browser: one
sentence → five cards, unticking one made the button say "Apply 4 changes" and the payload
split 1 product / 3 settings with the unticked one absent. Inventory: no composer, no panel.
Bot Training: no toggle, no bubbles, 14 fields. 375px Bangla: 11 chips at 44px, no overflow.

**Tidy-up left behind:** the `q.*` i18n keys (the one-at-a-time question wordings) are now
unreferenced — kept on purpose, they are how a person recognises each question and the
assistant will want them.
---

## Earlier session (2026-08-29) — The AI Assistant tab, the question order, and the whole session in Bangla

`f08b5c2` + `02159a2`, pushed. Owner sent a screenshot of the interview warning them off a
second "Box Tshirt" and asked for the whole way in to be reorganised, plus a tab of its own.

**The question order was sorted by importance, which is the wrong question.** `draftGaps`
returned blocking → wanted → rest, and the prompt asked in that order — so the assistant
demanded a PHOTOGRAPH before it had asked what the thing was like. `ASK_ORDER` is now one list
in the order a person says it out loud: **name → category → price → details → options →
photos → stock → the rest**. `draftGaps` grew `queue` BESIDE `blocking` rather than reordering
it, because two routes and the panel read `blocking` for what it has always meant.

Photos are last on purpose and not because they matter least — nothing saves without one. They
are the only step that LEAVES the conversation (stop typing, open the picker), so everything
answerable in a sentence is answered first and that trip happens once, at the end.

**Every question now ends with a real answer, not a description of one.** `EXAMPLES` in
`src/lib/inventory-actions.js`, one per field, in both languages; the prompt prints it beside
the question and tells the model to use it word for word. Numbers stay digits in the Bangla
ones — a shop types `500`, not `৫০০`.

**Bug found on the way (was breaking every interview):** `prompt()` in
`/api/product-interview` took a parameter named `known`, which shadowed the module function
`known(draft)` used in the same template literal. `${known(draft)}` called an array → threw on
every turn. Renamed to `cats`. Nothing local could catch it: the route needs a database and an
AI key to reach that line, and `.env.local` has placeholders for both.

**The assistant has its own tab.** First in the sidebar under a new "Assistant" group,
`ti-sparkles`. `fullPage` prop lays it out as a page (no collapse header, height from the
viewport). Three steps, always in this order:
1. **Where are they coming from** — the five ways in.
2. **One, or several** — two buttons.
3. **NEW: what is about to happen** — four lines, before it happens. Somebody new cannot tell
   an assistant that is collecting from one that is saving. The three imports that open a
   covering sheet get an "Open it" button so the rule is not hidden in the same breath.

**Tabs are controlled from the chat.** `DESTINATIONS` matches eleven fixed words in both
languages (no AI call — instant, free, works when the AI does not), gated on `GO_WORDS` so
"how many orders today" is not answered by navigating away. The empty state also carries a jump
row with **Bot Training first** (44px targets, not the 36 the other chips use). Imports chosen
in the chat open the real sheet in Inventory via `invIntent` in `dashboard-client.js`, keyed on
a timestamp so the same request twice still counts twice.

**111 strings moved into `i18n.js` in both languages** — the ways in, the batch questions, the
draft card, the photo counts, the save button, the field names (`fld.*`). Two keys wherever
English needs a plural and Bangla does not; a separate key for the full stop, because the two
scripts do not end a sentence the same way.

Also fixed: `startInterview` built the transcript from a STALE `msgs` and wrote it back, so
"one or several?" and "just one" vanished the moment the interview began. The model's seed line
is now `hidden` instead of showing as an English sentence the owner supposedly said.

**Verified:** 39 tests on the pure order/example rules; machine checks that both dictionaries
carry the same 325 keys with the same placeholders, that all 111 keys the panel asks for exist
in both and none is spare, and that PAGES/ICONS/LABELS and the sidebar groups line up at 12.
Then driven in the browser in Bangla through every path (both counts, all three batch
questions, both skip chips, the CSV rule button, "অর্ডার দেখাও" → "অর্ডার খুলে দিচ্ছি।"), and
measured at 375px: no horizontal overflow, message box 253px, 171px above the fold.

**Not done, and deliberately:** the dashboard still opens on Analytics, not the assistant —
moving where the app lands was not asked for. Inventory's empty-state cards are still English;
the owner scoped the language pass to "the question session".

### Follow-up the same day — `97e0a0a`: the transcript was frozen in one language

Owner sent a screenshot from the LIVE site: dashboard fully Bangla, rule card and question
still English. Not a missing translation — **`t()` was being called when a message was WRITTEN
and the finished sentence stored**, so the transcript kept whatever language was selected at
the time while everything rendered fresh moved.

Messages now hold the **key**, resolved at render by `line(m)`:
- `m.key` + `m.vars` for the panel's own lines; `m.content` only for what the MODEL wrote and
  what the OWNER typed — neither can be translated after the fact.
- `m.varKeys` for a value that is itself a key (the tab name inside "Taking you to Orders").
- `m.parts` for a report of several sentences ("3 added. 1 was the same picture."), one key
  each, because a joined string can only ever be half translated.
- The batch skip chip is matched on **which step** the message belongs to, not on its wording —
  comparing the sentences made the chip vanish when the language changed under it.

Also: `turn()` now sends `getLang()` read AT REQUEST TIME. `useLang()` returns "en" for the
first render of every mount, so an interview fired on arrival asked the server for English
questions on a Bangla dashboard. And `/api/inventory-chat` no longer receives the panel's own
furniture (the rule card, "Just one.") as if it were conversation.

Lesson recorded in `lessons.md`: **a translated string stored is a translation frozen.**

### Follow-up 2 — `b13ebdf`: every photo is read, and a category is picked not typed

Owner: "in the image to product add option here also should have to category select adding
option and make sure that every image should have to image analysis that when customer send
image then analysis image or images can match and find out the details."

**Only the FIRST photo of a product was ever described.** A shop photographs a shirt front,
back and close-up; the catalogue knew the front; a customer sent the back and was told it could
not be found (similarity under the 0.5 floor). Now `metadata.visuals[]` holds one description
per photo, aligned with `images`, and `buildContent` embeds all of them. `metadata.visual` is
unchanged and still means the primary — `duplicate-keys.js` and `readiness.js` read it.

- **PhotoBatch costs nothing extra.** Every photo already arrives as its own product and is
  described before grouping — all but one description was being thrown away. The description
  now lives on the PHOTO (`p.visual`), not the draft, so it moves with the picture on
  splitOut / mergeUp instead of staying behind to describe something else.
- **The chat** reads the first photo with a name proposal and the rest through the new
  `describe_only=1` on `/api/photo-draft` (skips the naming call). Chunked 6 at a time /
  3.2 MB. Quota counts 0 for describe_only — extra photos are not extra products.
- **Everywhere else** (drawer, CSV, product link, WooCommerce) `describeImages()` reads the
  rest of the gallery server-side: **parallel, 25s deadline, never throws**. Parallel is what
  keeps it affordable — six pictures take about as long as two; only the token bill grows.
- **Editing** re-reads only photos not previously in the gallery, so reordering is free.

**Category is a real `<select>` now** (`CatPick` in PhotoBatch), on the bulk row and every
product row — the datalist behind the old text box never opened on phones, so everything was
typed from memory and one shop got "T-shirt" / "T shirt" / "tshirt". "+ New category…" swaps to
a box with a way back. `catList` = shop's categories + anything the AI proposed + anything
typed in this batch, so a new one invented on row 1 is on the list by row 2.

**Bug found on the way:** the "new category" sentinel went into the source as a literal **NUL
byte** — git reported PhotoBatch.js as a binary file, and reading the code showed nothing. It
is `"__new_category__"` now. Lesson recorded.

**Verified:** 20 tests on `visualsOf`/`buildContent` (including that a product saved before this
existed builds character-for-character the text it always did). In the browser: 3 photos in,
2 merged → that product posted both descriptions aligned to its images; a category picked from
the list and a new one typed, which then appeared in every other row; 8 photos in the chat →
6 read with naming + 2 with describe_only, save posted all 8 in gallery order; 375px, no
overflow.

**Cost note for the owner:** vision now runs once per PHOTO instead of once per product. Three
photos per product is three times the vision spend on that product.
---

## Earlier session (2026-08-28, seventh thread) — Stage 4: option axes come from the shop, not the code

`95ab98a`, pushed. Completes the four-stage restructure. "Size" and "Colour" were two fixed
boxes in PhotoBatch — a clothing shop's answer built into everybody's tool.

**Three sources, in order** (`src/lib/variants.js`):
1. **`knownAxes(products)`** — the option names this shop has already used, most used first.
   Free, instant, and right more often than any guess. The chat's third question is asked in
   those words: a shop using "Capacity" is asked what capacities, not what sizes.
2. **The AI** — the naming call in `/api/photo-draft` now also returns `axes` (names only, max
   2). One extra field in a request already being made, so no extra cost. Names-only is
   ENFORCED, not just asked for: a model answering `["S","M","L"]` must not make three axes.
3. **The owner** — every axis is a row with an editable NAME. Renaming carries that axis's
   values across (`renameAxis`), so typing "Fabric" over "Colour" does not drop what was typed.

**Data shape changed in PhotoBatch:** `d.sizes` / `d.colours` → `d.opt = { [axisName]: "a, b" }`,
with the NAMES on the batch (`axes` state) and the VALUES per product — a rail of shirts is all
Size, but one is S–L and the next M–XL.

**`parseAxes(text, fallbackName)`** reads both shapes a person types: `"S, M, L"` → one axis
named the shop's way; `"Size: S, M; Colour: Black"` → two. Does not split a value at a colon
inside it (`"Model: A:1, B:2"`).

Fixed on the way: on a phone the axis row was one line and the options box came out 33px with
the sheet overflowing to 446px. Name takes its own line there now.

**All four stages are done.** Nothing outstanding from the owner's restructure request.
---

## Earlier session (2026-08-28, sixth thread) — Stages 1–3 of the master restructure

Owner showed 15 t-shirt photos (mixed fronts and backs, all different designs) and asked how
to add and MANAGE them by chat, for any business not just clothing. They answered four design
questions; three recommended, and **stricter than I proposed on readiness**.

**`e708e5d` — the readiness rule.** `src/lib/readiness.js`: a product needs a **name, a price
and a photo** or it is not created. Enforced at CREATION only — the edit route deliberately
does not, because editing is how an older incomplete product gets fixed. Checked in the drawer
too, so it answers instantly (0 requests) instead of after a round trip. Imports SKIP + COUNT
those rows (separately from duplicates) with one off-by-default checkbox to override — a
WooCommerce export with no photos would otherwise lose 60 products. Inventory shows a "Not
ready" filter + a counting card; a sellable product whose photo could not be read is a separate,
quieter state.

**`5072e37` — chat is the main section.** Toolbar is now `Offers · Advanced ▾ · [+ Add by chat]`;
the panel opens on arrival. Advanced holds the form, many photos, CSV, URL, WooCommerce.

**`df77ef6` — "one kind, many designs".**
- Choosing "several" asks THREE scripted questions first (kind / same price? / sizes), each
  skippable, then opens the photo sheet **pre-filled** via a new `prefill` prop. Scripted, not
  AI: same three questions every time, an AI call would be cost and latency for nothing.
- Naming: when the kind is known the prompt is told the kind is NOT what the name is for —
  "Box T-shirt — cream with circular back print". Explicitly told never to number them.
- Grouping now gets **seconds between photos**, read from `file.lastModified` of the ORIGINAL
  file (the shrunk copy carries today's date). Front+back are seconds apart, next shirt a minute
  later. Passed as EVIDENCE not a rule — files may be picked in any order.

**Still to do — stage 4:** option axes (Size/Colour) must come from the shop's existing products
+ an AI proposal instead of being hardcoded, so an electronics or food client gets their own.
---

## Earlier session (2026-08-28, fifth thread) — Photo grouping, duplicate photos, and a guided question order

`ce55892` + `387a5f4`, pushed. Owner attached 15 photos of 15 DIFFERENT shirts in the chat;
the transcript said "Added 15 photos" while 12 were kept, all on ONE product.

**Grouping — several photos become one product.** `/api/photo-group` takes the descriptions
`/api/photo-draft` already wrote (no images, no vision) and says which photographs are the
same thing. ONE call for the whole batch — photos are read 6 at a time and nothing can be
grouped against a photo the model never saw. Prompt is explicitly CAUTIOUS: leaving two
pictures apart costs a click, merging two shirts loses a product. The answer is rebuilt, not
trusted — anything unassigned/duplicated/nonsense stands alone, and an unreadable photo is
never grouped.
- PhotoBatch draft shape changed: `{ photos: [{id,file,u}] }` instead of `{file,u}`.
- Manual correction: `↗` splits a photo out, `×` drops it, tap a photo to make it first,
  "join with the product above" inside an expanded row, "One each" undoes all grouping.
- Saves one request per product carrying its whole gallery.

**Duplicate photos** — `src/lib/photo-fingerprint.js`, SHA-256 of the bytes in the browser
before anything uploads. Repeats are dropped, reported, and never read by the AI.

**The "Added 15 photos" lie** is fixed: it says what it kept, what repeated, what did not fit,
and points at "Many photos" when photos overflow — because that usually means they were never
one product. 12 per product stays (resolveGallery keeps 12 at the far end).

**Question order.** Chat now asks "one product, or several at once?" between picking a method
and the first product question — two buttons, `choice: "count"` on the message. And `ASK_ORDER`
in `inventory-actions.js` was reordered to **name, price, category, stock, PHOTO, options** —
photos used to be first because the AI can read a name off one, which is the machine's
convenient order and the wrong one for a person.

**Two bugs of my own, found by testing:** the joined-photo count was read before React ran the
state updater that set it (now via `joinedRef` + a tick); and the "already here, skipped"
notice was written into `err`, which the read clears a line later — it has its own `notice`
state now.
---

## Earlier session (2026-08-28, fourth thread) — Many photos per product on every path, and every import inside the chat

`786a876`, pushed. Owner: "in the chat and add product i see there is only a product adding
option but here also need the all of this category of import ... a product can be many
images ... there should have many product import in a time".

**Multi-image was broken on two paths.** `import-one` stored `images: image_url ? [image_url]
: []` — one picture, always. WooCommerce (`import-products`) read only `images[0]` and dropped
the rest. A CSV had no way to express a second picture.
- `imageList()` in `csv.js` takes as many links as one cell holds, accepting comma (Woo),
  newline (Shopify), pipe, semicolon and space. **The comma splits only when the next thing is
  another link** — a URL with commas in its query string must stay whole. Tested both ways.
- `import-one` resolves a gallery from `images` OR a bare `image_url`, dedupes, http-only,
  caps at 12. First photo is still the only one vision reads — one AI call per product.
- Sample CSV and header aliases updated (`Images`, `Photos`, `Gallery`, `Featured image`).

**The chat now offers all five ways in** — interview · Many photos · A spreadsheet · A product
link · WooCommerce — as cards in the empty state and a compact row afterwards. The four imports
call `onImport(kind)` → `setImporter(kind)` in Inventory, opening the EXISTING sheets. No second
copy of that UI. Both AI prompts were told they cannot read files and must point at the buttons;
the interview is told to stop asking and redirect when the owner mentions many products.

Fixed on the way: the panel auto-scrolled to the bottom on open, hiding the first ways-in card
on a phone. Guarded on `msgs.length`.
---

## Earlier session (2026-08-28, third thread) — System audit for silent bugs of the duplicate kind

Owner asked: "check the whole system for any other bug like this." Four found and fixed,
`67d9a1d` `f451ea7` `e02e12b`, all pushed. The class hunted for: **silent, invisible from
the outside, and the bot answers wrongly.**

**1. `67d9a1d` — FOUR different `visionPrompt` copies.** `docs/prompts.md` states the rule
(*"must be identical at import time and at message time — the two descriptions are embedded
and compared"*) and the code had already broken it: copies in `products.js`, `bot.js`,
`import-one`, `import-url`, no two the same. A customer's photo was described with one
wording, the catalogue with another, and `searchProducts` has a **0.5 match_score floor** —
so the drift showed up as *"I could not find that item"* for a product that is right there.
The `bot.js` copy was worst: *"If found, output only: CODE: <code>"* — a photo with any
visible SKU produced a description of just the code. **Now one definition in `products.js`**,
imported by bot.js / import-one / import-url / photo-draft. Rows imported before today keep
their old text; a re-import rewrites them.

**2. `67d9a1d` — `/api/import-url` was the door nobody updated.** No duplicate check (paste
the same link twice → two rows), its own thinner `content` (no category, so "something for
winter" found typed products and not imported ones), `catch {}` around vision hiding
analyzeError, and no `photo_key`. All four fixed; both importers now use `buildContent`.

**3. `f451ea7` — 13 dead single-tenant helpers in `src/lib/supabase.js`.** `getProducts()`
returned EVERY shop's catalogue; `deleteProduct(id)` deleted across all shops with the id
pasted into a PostgREST filter string. Zero callers (checked all 164 source files) so no
active bug — deleted rather than fixed, because they are one accidental import from a
cross-tenant leak. The file now exports only the client.

**4. `e02e12b` — one order could be saved twice.** No guard at all: Meta redelivers webhooks,
and the model repeats the order object when a customer says "confirm" again. Shop packs one
parcel, sees two orders, counts the money twice. Now refuses on same client + order_code +
sender_id. Caught a bug in my own first version: `.eq("sender_id", null)` is `= NULL` in SQL,
never true — website-widget orders would have slipped past every time. Must be `.is()`.

**ACTION FOR THE OWNER — not done, needs the Supabase SQL editor:** the unique index that
closes the last race (two webhook deliveries at the same instant). SQL and the
check-for-existing-duplicates query are both in `docs/database.md` under `orders`.

**Checked and found clean:** the client_id-at-the-database invariant (only the dead code
broke it), the embedding invariant (every embed routes through `getClientAI`), the 24-hour
messaging window (`broadcast.js` / `followup.js` / `messenger.js`).

**Not audited in depth:** billing/SSLCommerz, bookings/Google Calendar, the admin panel,
the OAuth connect flows. The sweep concentrated on the catalogue and reply path, where the
reported bug lived.
---

## Earlier session (2026-08-28, second thread) — Duplicate products: blocked at every door, and the old ones findable

`cfe9254`, pushed. The owner asked for a duplicate check on every way of adding a
product, because two rows for one product make the bot answer from whichever the
search happens to score higher.

- `src/lib/duplicates.js` — the single answer to "is this already here?", used by
  `/api/add-product`, `/api/import-one`, `/api/inventory-apply` (create AND rename) and
  `/api/products` PATCH (rename). Three signals in priority order: **code** (exact,
  punctuation ignored), **name** (case/space/punctuation ignored, so "Box T-shirt" ==
  "box t shirt"), **photo** (sha256 — `b:` for uploaded bytes, `u:` for an imported
  address; exact only, never "looks similar").
- New metadata field `photo_key`, written by add-product and import-one. Old products
  have none, so the photo signal only works for products added from now on.
- **Single adds refuse**, keep everything typed, and grow an **Add anyway** button —
  which appears only AFTER a save is turned away, never before. The chat interview warns
  the moment the name is given, which is a separate state (`dup`) from the refusal
  (`refused`).
- **Bulk adds skip and report** — "Added 3, 2 you already had". Stopping a 200-row CSV
  over row three would be worse than the duplicate. Importers still REPLACE on a code
  match: a shop imported twice is an update.
- The check runs before any upload/vision/embed, so a refusal costs no AI call and
  leaves no orphaned photo. And it never blocks an add by failing — a broken lookup logs
  and lets the product through.

**Then `8823abe` + `4a773c3` — the twins already in the catalogue.** Blocking new ones
does nothing about the pairs already there, which are the ones confusing the bot today.
- `src/lib/duplicate-keys.js` (pure — `nameKey`, `codeKey` moved out of the server-only
  `duplicates.js`, plus `findTwins`, `richness`, `twinReason`). The dashboard and the
  server now share one definition of "same product".
- `findTwins` runs over the product list the Inventory tab ALREADY holds — no new route,
  no request. Groups by CONNECTION (union-find), not one key at a time: A~B by code and
  B~C by photo is one pile of three, not two pairs with B in both.
- A warning card at the top of Inventory when any exist; `DuplicateSweep.js` shows each
  pile with what differs, marks the fullest row KEEP (ties → newer), and deletes only
  what is still marked when the button is pressed. "Leave alone" sets a pile aside.
- Verified by temporarily seeding two twins into `src/app/shots/sample.js` and driving
  it, then REVERTING that file (check `git status` is clean if resuming mid-way).

**Unverified:** the slim `select("id, name:metadata->>product_name, …")`. This machine's
`.env.local` holds PLACEHOLDER Supabase credentials (`example.supabase.co`), so there is
no database here to try it against. It falls back to reading whole rows if a deployment
refuses that shape. **Check this on the first real add.**

**Next up:** confirm the slim select works on production; then the still-open item from
before — how a real model's JSON parses in the three AI routes (Google Cloud billing
still off).
---

## Earlier session (2026-08-28) — Product added by conversation, and many photos on one product

`f0c7642`, pushed. The owner asked for the manual add to become a question-and-answer
with the AI, and for one product to be able to carry many pictures.

- `POST /api/product-interview` — asks one question per turn. The DRAFT travels with
  every turn and is re-cleaned through `normalizeSet` on arrival (the browser's copy is
  not trusted either); the model never touches the database and never decides whether
  the product may be saved. `draftGaps()` in `src/lib/inventory-actions.js` decides that.
- Blocking: name, price, at least one photo. Asked-but-not-blocking: category, stock.
  That is the owner's own answer — they ticked both options in the question.
- Photos: camera button in the composer, `shrinkBatch` so the whole gallery fits ONE
  add-product request, first photo marked and swappable, any droppable. Only the FIRST
  is read by vision; its text rides along as `visual` so vision does not run twice.
- Saved through `/api/add-product` — the same route the drawer uses. Nothing new writes
  to the catalogue.
- `Add by chat` sits beside `Add product` in the toolbar and in the empty state. Both
  ways to add stay; the owner will decide later which becomes primary.

Fixed on the way: the fourth toolbar button broke the phone layout (no `flexWrap` on the
action row), and the photo remove button was 22px — on a phone the thumbnail is 92px
with a 44px target wholly inside it.

**Still unverified:** how a real model's JSON parses, in all three AI routes. Google
Cloud billing is off. Everything around the model is tested.

---

## Earlier session (2026-08-27, second thread) — Adding fifteen shirts at once, and talking to the catalogue

The owner had fifteen photographed box t-shirts and could add four. Three
commits, all pushed. Started from a real screenshot: fifteen files selected in
the picker, and a product with a gallery of eight.

**`8ee343f` — options → variants moved out of the drawer** into
`src/lib/variants.js` (`cartesian`, `attrsKey`, `buildVariants`,
`usableOptions`, `newVariantId`). Pure — no supabase, no AI — so client
components import it. Refactor alone, no feature in the commit. The test
reproduces the old inline `generate()` verbatim and compares row by row.

**`2c7eb14` — Import → "From photos — one product each"**
(`src/app/dashboard/components/PhotoBatch.js`). Fifteen photos become fifteen
products. The AI reads every photo as it is added and fills in name, category
and description; the owner corrects, adds sizes/colours per row, and saves.
- New `POST /api/photo-draft`: vision per photo from the request bytes (nothing
  is uploaded, so cancelling leaves no orphans) + ONE batched text call that
  names the whole set. The vision description comes back as `visual` and is
  posted to `/api/add-product`, which now **skips its own vision call when
  `visual` is supplied** — so the AI cost is unchanged from before.
- Photos are chunked 6 at a time / 3.2 MB per request (the ~4.5 MB edge limit).
- Saving is still one request per product: a failure names its row, and a plan
  limit stops the run once instead of failing fourteen more times.
- A draft remembers what the AI proposed (`ai`), so "Read photos again" replaces
  the machine's words and never the owner's.

**`038ef09` — the catalogue can be managed by talking to it.**
`InventoryAssistant` is a folded panel in the Inventory tab.
`/api/inventory-chat` answers and **proposes**; `/api/inventory-apply` carries
out only what the owner ticked. The model never reaches the database.
`src/lib/inventory-actions.js` is the single whitelist the prompt, the apply
route and the panel all read, so what the owner is shown is what happens.
Proposals read "Price: 950 → 1200", each with a tick, and the button says how
many products it will touch.

**Unverified, and why:** the parsing of a real model's answer in both new AI
routes. Google Cloud billing is still off, so exercising a live model here would
eat the quota the clients' bots run on. Everything around it — whitelist,
apply, panel, chunking, payloads — was driven in a real browser and by node
tests.

**Next up:** watch the first real batch on production (does the naming call
return usable names on the platform model?); consider surfacing the assistant's
proposals for variant-level prices, which it deliberately cannot touch today.

---

## Earlier session (2026-08-27) — How the site presents itself: search, sharing, contact details, four stranded pages

Started from one owner question — "why does Google show a globe instead of our
logo?" — and the answer turned out to be four separate problems, one of them a
wrong fact published on every public page. Eight commits, all pushed, Vercel
green, every claim below measured against production rather than assumed.

**`4087117` — the logo was fine; `/favicon.ico` was a 404.** `src/app/icon.svg`
was correct and Google had already fetched it (proved by downloading
`google.com/s2/favicons?domain=getvoicium.com`, which returns the real crimson
bolt). What did not exist was the old root address that Google, Bing and every
link-preview scraper ask for first. New `scripts/make-favicon.mjs` rasterises
the same geometry `icon.svg` uses and writes `src/app/favicon.ico` — no image
library in this project, so it draws the rounded tile and the bolt itself and
encodes the PNGs with Node's own `zlib`; an .ico is only PNGs behind a small
index. Sizes are written **largest first (64, 48, 32, 16)** on purpose: Next
reads the FIRST directory entry to fill the `sizes` attribute, so the usual
smallest-first order advertised the whole file to Google as 16x16.

**`17eb8a2` — no Open Graph tags anywhere, and no structured data.** Two
consequences: Google printed the bare host instead of the brand, and a link
pasted into Messenger or WhatsApp — this product's own market — unfurled as an
empty grey box. New `src/lib/seo.js` is the single source for the canonical
host, the share pictures and the tag shape; every public page builds metadata
through it. The home page carries `WebSite` + `Organization` JSON-LD, which is
what actually lets Google print "Autologic". Share cards are built by
`scripts/make-og-images.mjs` and committed (`public/og.png`, `og-bn.png`,
`logo.png`), one per language because Google indexes the Bangla home page
separately.
- **`next/og` could not be used** and this is worth remembering: it cannot load
  its own font on Windows (`ERR_INVALID_URL` on a mangled
  `.\file:\D:\...noto-sans.ttf`), in dev as well as in build, so nothing it
  produced could be looked at before shipping. The cards are rendered with
  headless Chrome from the landing page's own faces and palette instead.
- **Next 14 strips the query string** out of anything it resolves for
  `alternates` — measured with a plain string and again with a `URL` object.
  So hreflang links would all have pointed at the English page and the Bangla
  page's canonical would have pointed at the English one, which is the exact
  instruction that de-indexes it. English gets its canonical, Bangla
  deliberately gets none, and the two languages are declared in `sitemap.xml`
  instead, where the query survives.

**`494c9d2` — company facts pulled into `src/lib/company.js`.** Address, email
and the maker line had been hand-typed across three footers, three pages and
Facebook's data-deletion page. The public address became
`office@autolinium.com` and every footer now names Autolinium.
- **`nahidafzal97@gmail.com` has two unrelated jobs.** As a contact address it
  changed; as the super admin's LOGIN identity (`src/lib/admin-auth.js`,
  `/api/admin`, `/api/admin/client-detail`, `src/lib/email.js`) it did not, and
  must not — pointing those at the new address locks the owner out of `/admin`.
  `company.js` says so at the top.

**`1cc240c` — four pages had never been redesigned.** `/contact`, `/privacy`,
`/terms` and `/google-calendar` were still `#0A0D14` with `#FF6B75`, the red
the 2026-08-16 redesign retired. No nav, no logo, no footer, hard-coded dark so
the theme switch did nothing to them. New `src/app/site-shell.js` gives them
the same furniture the landing page and the manual already use. Legal wording
carried over word for word; the "Last updated" dates deliberately untouched,
because the effective date of a legal document is the owner's call.

**`ba6fd48` — the address on every public page was WRONG.** The registered
details are Autolinium, Chattogram Software Technology Park, Agrabad,
Chattogram 4200, phone +880 1533 633084, `autolinium.com`. The site had been
saying Kandirpar, Cumilla — on the footers, the contact page, both legal pages
and the Meta-facing data-deletion page. Because `494c9d2` had just centralised
it, the correction was one line. Structured data now carries the real
`PostalAddress`, `telephone`, a `contactPoint` and Autolinium as
`parentOrganization`.
- Left alone on purpose: `shots/sample.js`, `preview-dash/*` still say Cumilla.
  That is the invented shop "Nokshi Threads" and its invented customers;
  rewriting it would put the real office address into fake demo screenshots.

**`aecedd9`, `0c58af8`, `0e24043` — caching: one real fix, one dead end.**
Measured first: most of the site was already edge-cached (`/pricing`,
`/contact`, `/privacy`, `/terms`, `/google-calendar`, images, favicon all HIT
or PRERENDER). Only `/`, `/?lang=bn`, `/docs` and `/docs/inbox` were MISS.
- **Fixed and verified:** three `<meta http-equiv>` cache tags (Cache-Control,
  Pragma, Expires) sat in the root layout on EVERY page saying "never store
  this", including the ones Vercel was caching happily. They cannot set a real
  caching rule — only the server can — but they could stop the reader's own
  browser keeping the markup. Removed.
- **Dead end, tried twice, measured twice:** a `Cache-Control` rule in
  `next.config.js` is outranked by the header Next writes for a dynamically
  rendered page; setting the same header from `middleware.js` is outranked too.
  Both reverted rather than left looking like they work. The cause is the
  render mode, not the header: those pages read `?lang=bn` from the query, and
  reading the query is what makes Next render per request. Both dead ends are
  written into `next.config.js`.
- **`/` deliberately not cached.** Its middleware answers a signed-in visitor
  with a redirect to `/dashboard` and sets `no-store` on that redirect by hand.
  If a cache rule reached the redirect and outranked that, every anonymous
  visitor would be sent to `/dashboard` — the front page would disappear. Also
  measured: the anonymous `/` response carries no `Set-Cookie`, so the cookie
  worry does not apply; the redirect is the reason. And the middleware calls
  Supabase on every `/` request regardless, so caching the HTML would save the
  render, not that call.

### Verified live on production after the push
`/favicon.ico` 200 `image/x-icon`; the three share images 200; `og:site_name`
and JSON-LD `WebSite.name` both "Autologic"; footers read
"© 2026 Autologic · An Autolinium product" beside "Chattogram, Bangladesh";
zero occurrences of Kandirpar/Cumilla and zero of `#FF6B75` across the home,
pricing, docs, contact, privacy and terms pages. Layout measured in a real
emulated viewport at 375px and 1276px: zero horizontal overflow, no two tap
targets sharing vertical space, email/phone links 44px+, nav controls 40px.

### What's next — resume exactly here
1. **Search Console is now set up — done the same night, with the owner.**
   A **Domain** property (`sc-domain:getvoicium.com`) was verified by DNS TXT
   at Hostinger, `https://www.getvoicium.com/` was submitted through URL
   Inspection ("added to a priority crawl queue"), and
   `https://www.getvoicium.com/sitemap.xml` was submitted and came back
   Success against 21 pages.
   - **Never delete the TXT record** `google-site-verification=r5WaxrOM…` on
     `@` in Hostinger. Removing it un-verifies the property and loses the data.
   - There was already an older `google-site-verification=xeEvV…` row on `@`
     from a different property, plus SPF. Both were kept; multiple TXT records
     on one name coexist and Google matches on value.
   - **Side effect worth knowing:** DNS gives every record of the same name and
     type one shared TTL, so the new row's 14400 replaced the 300 the other two
     `@` TXT rows had. Content is byte-identical and nothing broke, but a future
     SPF change will take up to 4 hours to propagate instead of 5 minutes.
     Setting one of those rows back to 300 fixes all three; not urgent.
   - Two traps hit on the way, both worth remembering. The pre-existing
     property was `https://getvoicium.com/` — the apex, which 308s to www, so
     every real page was outside it and URL Inspection answered "URL not in
     property". A **Domain** property covers www and apex together and is the
     right shape here. And in a Domain property the sitemap field takes the
     **full URL**, not a bare `sitemap.xml`, because the property spans more
     than one hostname.
   - **The favicon still will not appear in results immediately.** The file is
     live and Google can fetch it — Search Console itself renders the crimson
     bolt beside the property name — but the icon in a result comes from the
     index, and that only changes on re-crawl. Days to weeks per Google's own
     guidance; Request Indexing is the whole of what can be done.
2. **Phone number is now published** (+880 1533 633084) — worth one glance at
   `/contact` on a real phone to confirm the tap dials correctly.
3. **Owner decision waiting:** the opening line of `/privacy` and `/terms`
   still reads `Autologic ("we", "our", "us") operates…`. Now that Autolinium
   is known to be the registered entity, that sentence could name it. Only the
   Contact sections were changed; rewriting the operative sentence of a legal
   document was left to the owner.
4. **Owner decision waiting:** `/docs` and `/` cannot be edge-cached while the
   language lives in `?lang=bn`. Moving it into the path (`/bn/docs`) would fix
   it and would move URLs Google has already indexed. SEO decision, not a
   caching one.
5. `/api/fb/data-deletion` had its facts corrected but still uses the old dark
   palette and `#FF6B75`. Left because it sits inside a Meta App Review flow.
6. **Known duplication:** `src/app/site-shell.js` and `src/app/docs/shell.js`
   each carry their own copy of the same nav and label CSS. Pulling it into one
   place means editing the manual's frame — a refactor, its own commit.
7. Two inline links in contact cards measure 18px tall on a phone. The house
   fix (`inline-block` + negative margin) stops a link wrapping mid-sentence,
   which risks reintroducing sideways scroll. Noted, not fixed.
8. Everything under the older "What's next" sections still stands — Google
   Cloud billing, `CRON_SECRET`, the two unapproved Meta permissions.

---

## Reconstructed after the fact (2026-08-25 afternoon → 2026-08-26) — 22 commits that were never written up

**These sessions ended without updating this file.** The account below was
rebuilt on 2026-08-27 by reading each commit's diff, not from anyone's memory,
so it is reliable about what changed and silent about what anyone intended.
This is exactly the failure `lessons.md` #7 exists to prevent.

**Landing and redirect.** `0f133de` found `middleware.js` had never executed —
with a `src/` layout Next only registers `src/middleware.js`, and the build
manifest's `sortedMiddleware` was empty. Moved, and narrowed to a 307 from `/`
to `/dashboard` for signed-in visitors, with `?home=1` and email-confirmation
params exempted. `7bc456d` set the landing page's 28 small mono labels in Anek
Bangla for Bangla readers — IBM Plex Mono has no Bengali glyphs, caps mean
nothing in Bangla and letter-spacing breaks conjuncts.

**Dashboard replies were never delivered** (`6fec0f2`). Both `/api/send-message`
and `/api/send-media` tagged every human reply `HUMAN_AGENT`, a tag needing its
own Meta approval, and POSTed to `graph.facebook.com/me/messages` regardless of
platform (Instagram needs `graph.instagram.com/<ig-id>/messages`). New
`sendAgentMessage()` in `messenger.js` sends plain `RESPONSE` first and only
falls back to the tag outside the 24-hour window.

**Inbox rebuild** (`520d367`, `c8b517b`, `a4cfade`, `ee595eb`, `38c40e1`):
chat header rebuilt and the switch stopped being a blob (the global 44px
coarse-pointer rule was inflating a 23px pill); "Conversations" renamed to
Inbox everywhere a person can read it, internal keys deliberately unchanged;
"All channels (N)" had been counting chats, not channels, in both Inbox and
Bookings; composer icons made square; a measured 4px overlap between two
dropdowns fixed generically in the shared `Select`.

**Features:** `2329b4b` CSV product import (hand-written parser in
`src/lib/csv.js`, reusing the existing `/api/import-one` pipeline row by row).
`6d01caf` Knowledge Base rebuilt with search, real counts and a delete that
asks. `c938698` + `f5e0412` + `02d8695` Bookings: one toolbar instead of five
rows, a drawer that opens the full record, and a real accessibility bug where
the email and phone tap targets shared 20px — a thumb aimed at the email could
dial the customer.

**Overnight thread, 2026-08-26 01:34–02:53** — one continuous run:
- `7579455` every AI call now records WHICH feature spent the money
  (`usage_daily.feature`, new `src/lib/usage-features.js`, all 16 call sites).
  Two unmetered paths closed: `enforceLanguage()`'s retry and `tags.js`'s
  fallback. **Live schema change claimed as already applied.**
- `417b0a3` admin per-client cost breakdown, three areas plus an arithmetic
  audit table; BYOK clients no longer show "৳0" beside millions of tokens.
- `fc7c283` **broadcasts and the bot disagreed about what a client may send.**
  The bot read `plans` + `limit_overrides` from the database; broadcasts read a
  hard-coded `PLANS` constant. Four divergences, including an expired plan
  still broadcasting and a newly created package returning zero. One
  `messageAllowance(client)` now answers for both.
- `a907a60` + `72f7fc4` expiry warnings sent by a daily Vercel cron rather than
  only when an owner happens to open the dashboard, with a second reminder on
  the last day. **`clients.expiry_warn_stage` + a backfill claimed as applied.**
- `b2c0f24` disabled buttons now look disabled (every hover rule was correctly
  guarded, but nothing changed their appearance). `992e56a` broadcast says up
  front when the plan cannot send. `bb5cef9` per-client limit boxes pre-filled
  with the package's own figures, with the "does this differ" test on the
  SERVER so saving does not silently pin all eight as overrides.

### Unverified from that stretch — worth checking before trusting
- Three live schema changes are **asserted in commit messages, not proven
  here**: `usage_daily.feature` + `record_ai_usage(p_feature)`, and
  `clients.expiry_warn_stage` + its backfill. Query the live database.
- `CRON_SECRET` — `/api/cron/expiry` is unauthenticated until it is set in
  Vercel. The commit itself flags this as outstanding.
- The signed-in → `/dashboard` redirect and the phone hardware-back menu
  behaviour were never exercised against a real logged-in session.
- The `HUMAN_AGENT` fallback still fails until Meta approves that tag.

---

## Earlier session (2026-08-25) — Documentation site, and a design audit of it

The manual now exists at `/docs`: 14 pages, English and Bangla, 28 screenshots.
Then it was measured rather than looked at, at 1280px and 375px in both
languages, and seven faults were found and fixed.

**The site** (`src/lib/docs/index.js` = the map, `src/lib/docs/{en,bn}.js` = the
words, `src/app/docs/` = the frame). Six block shapes only (`p`, `steps`,
`table`, `shot`, `note`, `faq`); a seventh should feel like a decision. Bangla
is `?lang=bn` — a real URL, bookmarkable and indexable, not a client toggle. A
page declared in the map but not written renders an honest panel, is `noindex`,
and stays out of the sitemap. Screenshots come from `/shots`, a studio page that
renders the real tab components against invented data and 404s outside
`next dev`; light and dark pairs, WebP (28 files, 1.8 MB — as PNG, 6.6 MB).

**The dashboard link into it.** `LearnMore` resolves the docs page from the open
tab, so a tab added later cannot forget it. After two rounds of owner feedback it
is a quiet inline "Read docs ↗" at the top of the tab content — the same shape
and the same place on a phone and a desktop, the way Meta's own console does it.
Not a filled bar, not a header pill, not in the sidebar.

**`382ea9d` — seven measured faults in the manual.**
- Sticky nav and sticky sidebar had never worked: `overflow-x: hidden` on
  `<body>` makes body a scroll container. Clip moved to `<html>`, body gets
  `clip`. See lessons.md — this is the one to remember.
- English bar was 93px tall on a phone (the eyebrow beside the wordmark broke
  over three lines); dropped under 460px, now 63px.
- Screenshots reserved no space, so each one jumped the page 235px when it
  loaded. `blocks.js` reads the size from the WebP header at build time.
- Lines ran to 86 characters. Column 760 → 680, body 15px → 16px, steps 14.5 →
  15.5. Median 71 now.
- Bangla headings overlapped (Anek Bangla's ink is 1.33em; they were set at
  1.1). Bangla headings now 1.45.
- "On this page" links were 17px tall → 40px. Breadcrumb 12 → 40, wordmark
  29 → 40, footer links 32 → 44.
- Docs column was a `<main>` inside the layout's `<main>`. Now a `<div>`.

**`b64f318` — the landing page had three of the same.** Sticky nav dead for the
same reason. `.bn .fr` had been in its CSS all along but **nothing carried the
`bn` class**, so every Bangla headline rendered in Fraunces — a Latin serif with
no Bengali glyphs — and fell back to whatever font the phone owned. Fixing that
exposed the same heading overlap. All three fixed and measured.

**Also this stretch:** `permalink` column on `comments` (live migration applied),
so "Open the post" works for Instagram — the old code built a Facebook URL from
`post_id`, and IG's post_id is a bare media id that no Facebook URL can address.
Comments tab copy made channel-neutral. IG connect asks for `manage_comments`
behind a `REVIEW_CLIENT_ID` branch for the Meta review video.

### Standing items
- After Meta approves `instagram_business_manage_comments`, delete the
  `REVIEW_CLIENT_ID` branch in `dashboard-client.js` (~line 436) so
  `&with=comments` applies to every client.
- `WebsiteWidget.js` builds its snippet from `window.location.origin`, so a
  client who reaches the dashboard on a non-live domain is shown a snippet for
  that host. Flagged, deliberately not fixed.
- `src/app/preview-dash/page.js` (the noindex design proposal) still has
  `overflow-x: hidden` on body and the same dead sticky. Not production; left.
- The root layout wraps every page in one `<main>` that also contains the nav
  and the footer. Over-broad, but changing it touches every page.
- `/apple-icon` fails to prerender on Windows (`@vercel/og` + `fileURLToPath`).
  Pre-existing, proved on a clean tree, Linux/Vercel unaffected. Ignore it.

---

## Earlier session (2026-08-20, second thread) — Channel exclusivity, multi-account, tab redesigns

Verified first (evidence, not assumption): the admin secret-key fix (`84d02f6`)
works — owner tested Give/Remove API key access, zero 403s in Vercel logs after
the fix deployed (the only 403s were pre-fix). `client_ai` is EMPTY again —
the owner's Remove test deleted Broker's BD's permission row, so the BYOK smoke
test now starts from "Give access" again.

- `9ea95a9` **BYOK success is now visible in logs.** `[ai]` was only written on
  failure; a working client key was silent, so the smoke test had nothing to
  look for. `strict()` in `src/lib/ai.js` now logs
  `[ai] client <id> used their OWN key (provider/model) for chat — ok`.
- `ff9d1be` **One Page = one client, and channels have names.** The unique index
  was `(client_id, platform, page_id)` so the same Page could join two clients,
  and `getChannelByPage` picks `limit(1)` — silent cross-tenant misrouting.
  Migration `channel_identity_and_exclusivity`: unique `(platform, page_id)`
  (verified by a rolled-back duplicate insert), `channels.name`,
  `message_buffer.page_id`, `broadcast_recipients.page_id`. All connect flows
  (fb/ig/wa select, wa/finish, channels POST) refuse a taken page with a
  branded 409 page and save the human name. **wa/finish had a fatal hidden
  bug**: `onConflict: "client_id,platform"` matches no unique index → every
  embedded-signup save had been failing (lesson 25). Existing rows keep a null
  name until reconnect; the UI falls back to the id.
- `25b4332` **Send through the page the customer wrote to.** All 8 bot.js
  bufferInserts + widget/chat record `page_id`; send-message/send-media,
  broadcast-send and followup resolve (platform, page_id) first, platform as
  fallback for old rows. /api/conversations exposes per-thread `page_id`.
- `f8f32ac` **Channels tab rebuilt**: per-platform sections (brand icon, count,
  Add), one row per account with saved name + live dot + Live/Paused switch,
  expandable detail (id, date, comment toggles, disconnect). Website is its own
  section (widget rows with domains/pause/remove; `WebsiteWidget` gained `bare`).
- `ab8f3a4` **Conversations tab**: search (name + last message), relative time
  per row, platform icon, per-account chip + filter entries (`facebook|<page>`)
  when a platform has >1 account, account name in the chat header.
- `7f6f46b` **Settings → "Bot Training"** (nav label + ti-wand; page key stays
  "settings"): training checklist (4 honest checks), numbered sections — Bot
  identity (tone/language promoted out of the fold) → Teach it your business →
  Guardrails → Automation (follow-up) → AI key → Advanced (raw profile), and a
  floating save bar on JSON-diff dirty detection.

Every stage: production build passed locally before push (the 0xC0000005 build
worker crash appeared once; clean on retry — lesson 22 territory), each commit
pushed separately, Vercel READY confirmed per stage (last stage confirmed at
session close).

Later the same day, one more commit:

- `eca4465` **Bot Training templates: 3 → 10 per business type.** Owner asked
  whether the sparse "Start from an example" chips should exist or be many
  more. Decision: keep them (a good example beats an empty textarea for a
  non-technical owner) and grow to ten each, all written like an owner briefs
  a new employee — real taka prices, delivery inside/outside Dhaka,
  bKash/COD, and the one policy customers always ask about (exchange,
  warranty, advance). Ecommerce adds cosmetics, electronics, shoes & bags,
  baby & kids, furniture, grocery, books. Agency adds travel, real estate,
  beauty salon, photography, software & web, event management, law. Same
  list is rendered on the onboarding step too, so both surfaces got it in
  one edit.

### What's confirmed working (owner tested this session — do NOT re-litigate)

- Admin Give / Remove API key access. Ran through /admin fully; DB + Vercel
  agree with the owner's report.
- BYOK smoke test end-to-end: permission granted, client key saved and
  verified, replies rode the client's own key. The `[ai] … used their OWN
  key` log line landed as expected.
- Visual pass on Channels, Conversations and Bot Training tabs (desktop and
  phone, light and dark). Nothing to redo here.

Later the same day, a third thread — **clients could not connect any
channel** (owner's own FB/IG/WA connect worked; every client saw Meta's
"Facebook Login is currently unavailable for this app as we are updating
additional details for this app."):

- Diagnosed with evidence, not the stale plan: pulled the live Facebook
  Page token from `channels` and called Meta's `debug_token` endpoint
  directly — it already carries `pages_manage_engagement` (issued
  2026-08-19), so the OLD blocker described below at "Blocked on one step"
  is **already resolved** and that whole "Next up" write-up (App Review
  plan, disconnect/reconnect step) is now **stale**. Do not act on it.
- Owner checked Meta App Review → Permissions and Features directly: 8 of
  10 target permissions are **Approved** (`instagram_business_basic`,
  `instagram_business_manage_messages`, `pages_read_user_content`,
  `whatsapp_business_messaging`, `pages_manage_metadata`,
  `pages_manage_engagement`, `business_management`,
  `whatsapp_business_management`). Only **`instagram_business_manage_comments`**
  and **`pages_read_engagement`** are Not approved. App Mode is already
  **Live**; no restriction banner on the dashboard.
- Root cause: Meta blocks the WHOLE OAuth call for the general public if
  ANY permission in that one call is not Advanced-Access-approved — only
  the app's own admins/developers/testers (the owner) bypass that check.
  `ig/login.js` requested `instagram_business_manage_comments` in the same
  call as two fully-approved scopes → every client's IG (and by the same
  logic, FB/WA) login got refused with Meta's generic "updating additional
  details" wording.
- `fecf79d` **fixed the part that lives in code**: `ig/login.js` no longer
  requests `instagram_business_manage_comments`. DM automation (the two
  approved scopes) is unaffected; comment automation already shows
  "waiting for Meta" on the connected page when unsubscribed — same
  graceful-degrade path, nothing new to build. `pages_read_engagement` is
  **not referenced anywhere in this repo** (grep confirmed) — it is
  bundled entirely inside the Facebook Login for Business configuration in
  Meta's dashboard (`config_id 2178064332957710`), so it cannot be removed
  from code. Same likely applies to WhatsApp's `WA_LOGIN_CONFIG_ID` config,
  which this repo cannot introspect.

### What's next — resume exactly here

1. **Confirm the IG fix actually unblocks a real client** (owner's hands —
   needs a second Facebook/Instagram account playing a customer): try
   connecting Instagram as a non-admin account. If it now succeeds, the
   "one unapproved scope blocks the whole call" theory is confirmed for
   Facebook and WhatsApp too, and the same edit applies there — except
   those two are **dashboard-only fixes**, not code:
   - **Facebook:** Meta App Dashboard → Facebook Login for Business →
     Configurations → edit `config_id 2178064332957710` → remove
     `pages_read_engagement` from the permission list → Save. Then test a
     client FB connect again.
   - **WhatsApp:** find whichever Login Configuration `WA_LOGIN_CONFIG_ID`
     (Vercel env var) points to, open it in the same Configurations screen,
     and check for any Not-approved permission bundled in it; remove it the
     same way.
   - Once both are clean, re-submit App Review for just the two missing
     permissions (`instagram_business_manage_comments`,
     `pages_read_engagement`) to get full comment automation + whatever
     `pages_read_engagement` was meant for back — this is a MUCH smaller
     ask than the old "3 videos, 9 permissions" plan below, most of which
     is already approved. The old video-recording checklist further down
     this file only needs to cover these two now.
2. **Google Cloud billing** — still the single biggest blocker (free tier
   is 20 req per model per day; the bot dies after ~10 messages/day per
   tenant). Enable billing on the Gemini API project in Google Cloud
   Console → confirm from Vercel runtime logs that 429s stop appearing. No
   code change needed to turn it on.
3. **BYOK gap found, deliberately not fixed yet:** `import-url`'s
   `extractProductsFromUrl` (the biggest AI call, 15k HTML chars) and
   `tags.js`'s `chatWithGemini` fallback still run on the PLATFORM key for
   BYOK clients — breaks hard cost separation. Fix in its own commit.
4. WhatsApp Embedded Signup can now actually SAVE (lesson 25 fix) — worth a
   real connect test when Meta setup allows.

---

## Last session (2026-08-17) — Demo bot removed, first-run screens themed, premium Inventory

Owner asked (in one message): remove the demo bot everywhere; make the auth
and post-signup screens match the theme; make Profile "Resources" fit the
business type; and build a premium, organised Inventory (photos, edit,
categories, variants). Seven small commits, each built and verified:

- `8048c2a` **Demo bot gone** — `Demo.js`, `/api/demo-chat`, `runDemo()` in
  `bot.js`, the "Try Demo" onboarding card, and the docs mentions. Onboarding
  step 3 is now one "Start free trial" card. `public/demo/dress.svg` stays: it
  is the landing page's marketing phone animation, not the demo bot.
- `fc9c473` **First-run screens on the theme** — real bug found: Onboarding,
  ConnectChannel and ConnectCalendar rendered *without* `<Theme/><Motion/>`,
  so every CSS variable was undefined after signup. They now mount both and
  share `OnboardFrame` (ui.js: soft slab, brand mark, red icon tile, `Steps`
  pills). `Inp` gained an `emb` prop (pressed-in field). Raw `<select>` →
  shared `Select`.
- `b0b2fca` **Profile resources by type** — `/api/profile` usage now also
  counts `bookings` and `file_registry`; agency sees Knowledge files/Bookings,
  shop sees Products/Orders, both see Channels. The last raw `<select>`s
  (Profile, Settings, Broadcast, conversation tag picker) use `Select`.
- `5bd7d32` **Inventory API** — new `src/lib/products.js` (form parsing,
  option/variant normalising, gallery upload, vision step, embedding text now
  includes category/brand/tags/option values). `POST /api/add-product` takes
  brand, tags, stock_qty, options, variants, several `images`;
  `PATCH /api/products` edits in place (only present fields change; vision
  only when the primary image is new; re-embed only when a searchable field
  changed); `DELETE` takes `{id}` or `{ids}`; `GET` newest first. Gallery order
  uses `upload:N` placeholders (`resolveGallery`) so a new photo can be primary
  in the same save. Both importers store `images[]`, `visual`, timestamps.
  `FIXED_ECOM` rule 18b: bot lists available variants and uses the chosen
  variant's price. **Everything lives in `metadata` jsonb — no schema change**
  (products table had 0 rows at the time).
- `7ca5bf6` `import-one` duplicate delete now carries `.eq("client_id")`.
- `19b7045` **Inventory tab rebuilt** — stats strip, category rail (desktop) /
  scrolling chips (phone) with counts, search over name/code/brand/tags/SKUs,
  stock filter, sort, grid|list (remembered in `al-inv-view`), bulk select →
  in/out of stock / delete, one editor drawer (full-screen on phone) with
  Details / Photos / Variants tabs (options builder → generate matrix),
  import sheet (URL / WooCommerce), empty state. Verified in Chrome (desktop,
  light+dark) and at 375px via JS measurement (no overflow; drawer + variant
  rows fit). `.claude/launch.json` now calls the next binary directly.
- `8534e26` **SSR `<style>` escaping fix** — React escapes text children of
  `<style>` on the server (`&quot;`, `&#x27;`); the browser does not decode
  entities inside `<style>`, so first paint had broken dark-theme rules and a
  broken Google Fonts `@import`, and every load logged hydration errors (root
  switched to client render). All inline CSS now uses
  `dangerouslySetInnerHTML`. Verified on the production build: 0 escaped
  entities in `<style>`, `@import` valid, `[data-theme="dark"]` present.

Later the same session (owner asks, in order):
- `b8a254b` **Premium "connected" page for every channel** — new
  `src/lib/connect-page.js` (`connectedPage` / `connectFailedPage`): brand
  palette (light+dark via `al-theme`), channel icon tile + green tick, "Facebook
  Page connected", the exact Page/@account/number/email in a pill,
  plain-language status rows (never a permission name), "Go to dashboard" +
  6-second countdown; posts legacy event + `{type:"al-connected"}` to an
  opener, then returns to `/dashboard?connected=<platform>&name=…#channels`.
  fb/select, ig/select, wa/select, gcal/callback use it (success + errors);
  wa/embedded hands off to new `GET /api/wa/finish?done=1`. Dashboard reads
  `?connected=` / the message → opens Channels and shows a success banner
  (`Channels.js` `JUST` map, `justConnected` state in dashboard-client).
- `00f941d` **Admin API** — overview with plan mix, MRR (from `plans.js`),
  revenue 30d vs prev, signups/messages/orders/bookings 7d vs prev, 14-day
  Dhaka-day series, platform mixes; `attention` list (pending payments,
  trials ≤2d/expired, paid plans ≤7d/expired, suspended, no channel, quiet
  7d); `activity` feed; per-client last_active / days-left / pending_payment;
  PUT `plan` accepts any catalogue plan (30-day term), new `extend_plan`;
  client-detail adds payments, contacts, bot name/greeting (from
  `app_settings.settings`, never the prompt), by-platform + series.
- `a9cec74` **Admin console rebuilt** on `ui.js` tokens/components — sidebar
  + header shell, Overview (8 KPIs w/ trends, sparklines, attention,
  activity, mixes, top clients), Clients (filters + table/cards), client
  drawer (tabs + Manage + typed-DELETE), Payments (inline approve/reject),
  Admins (key-locked role control). `AdminApp` is exported so a mock-data
  dev page can render it without login. Verified desktop light/dark + 375px.

2026-08-19 (same thread, owner asks):
- `f5e8af3` every hardcoded `autologic-chatbot.vercel.app` link → `getvoicium.com`
  (email.js links, privacy/terms text, preview-dash snippet, video copy, docs).
  The vercel.app host itself cannot be deleted; Meta redirect/webhook entries
  for it were deliberately left as a safety net.
- `bc81518` WhatsApp Embedded Signup config id `1417283913551939` baked in as
  the `WA_CONFIG_ID` fallback (public value, like FB_APP_ID/FB_CONFIG_ID).
  Owner's own +880 number sits in the app's API Setup, so it does not appear
  in the Embedded Signup popup — a developer-only case; real customers see
  their own WABA/numbers. Meta side still needs: IG redirect URIs (done by
  owner), FB Login redirect URIs for fb/wa callbacks, "Allowed Domains for
  the JavaScript SDK" = getvoicium.com (required for the WA popup).
- `584e8a4` **voice notes**: WhatsApp voice was silently dropped (webhook set
  `audioId`, bot only read `audio`). Now WA audio is downloaded with the
  channel token and transcribed; one core `transcribeParts()` in gemini.js
  (same Gemini model as replies, temperature 0, noise/Banglish prompt, mime
  normalisation, `[unclear]` marker → bot asks to repeat/type). NOTE: that
  commit had a multi-line string typo (shell heredoc); fixed in `7e36e04`.
- `827155d` **bot prompt now appends `[BUSINESS FACTS]`** built live from
  `app_settings.questionnaire` + `clients` (phone/address/website) and
  declared to override the narrative `businessPrompt`. Root cause of the bot
  quoting `evalora.com`: owner's own account had catalogLink=evalora.com
  baked into the generated prompt. Data fixed by SQL for client
  `93963074-…` (catalogLink → brokersbd.com, prompt text replaced).
- `7e36e04` **orders**: migration `orders_detail_columns` (items jsonb,
  subtotal, delivery_charge, discount, payment_method, notes, owner_note,
  platform, delivery_area, updated_at + indexes); bot orderRule produces
  item lines/money split; `/api/orders` normalises old+new, PUT status/note/
  corrections (total recomputed), DELETE; `Orders.js` rebuilt (KPIs, filters,
  CSV, cards, drawer with progress/edit/items/status/private note). Verified
  visually with mock data (desktop light).

- `9c7efea` **the bot was answering "দুঃখিত, একটু পরে আবার চেষ্টা করুন।"** —
  root cause found in Vercel runtime logs, not guessed: primary model 429
  (Google **free tier, 20 requests per model per day**) → fell back to
  `gemini-2.0-flash` → **404, retired** ("use models/gemini-3.6-flash"). The
  only fallback was dead, so `chatWithGemini` threw, `parseReply` returned []
  and the generic apology went out. `analyzeImage()` used that retired id
  **directly**, so customer photo matching had been silently failing too.
  Fix: `gemini.js` walks a model chain (`GEMINI_MODELS` env, default
  `gemini-2.5-flash,gemini-3.6-flash`); 404/429/503 → next id, other errors
  surface. Chat, both vision entry points, transcription and URL extraction all
  use it. Fallback message now promises a human, in Bangla + English.
  ⚠️ **Still open: Google billing.** The chain widens the daily ceiling
  (one free quota per model) but cannot fix a free-tier account — voice costs
  two calls per message (transcribe + reply), so the bot still dies daily until
  billing is enabled on the Google Cloud project.

- `82b5126` **BYOK — per-client AI keys (Google AI Studio / OpenAI), super
  admin only.** New: `client_ai` table (AES-256-GCM encrypted key via
  `src/lib/crypt.js`, master from `AI_KEY_SECRET` or service-role key;
  masked copy for display), `src/lib/ai.js` `getClientAI()` resolver (60s
  memo; failing own key → platform fallback + row marked "failing" with
  provider error), `src/lib/openai.js` (REST, gpt-4o-mini→gpt-4.1-mini chain,
  whisper-1, key verify). gemini.js takes optional `opts.apiKey`. Wired:
  bot reply/vision/voice/language-rewrite/comments, tags, products vision,
  import-one/url, generate-prompt. **Embeddings always platform Gemini**
  (768-d space — new CLAUDE.md invariant). Admin: PUT type `ai_key`
  set/remove (super + x-admin-key, provider-verified before save);
  client-detail returns masked `ai` to super only; drawer "AI key" tab
  (status card, replace/remove, add form, inline secret-key gate, coverage
  table). Verified with mock data in the browser (3 states + form).
  NOT yet exercised with a real customer key — set one on a test client and
  send a message; check the row's status and Vercel logs for `[ai]` lines.
- `3e5c2c6` **BYOK v2 — the owner's actual design** (replaces the v1 flow in
  the same session): super admin only **grants/revokes permission** (admin
  drawer AI-key tab → allow/revoke, super + x-admin-key); the permitted
  client gets an **API key box in their own dashboard** (Settings →
  `AIKeyBox`, served by new `/api/ai-key` GET/POST/DELETE, requireClient +
  permission check + 10/h rate limit, provider-verified before save).
  **Hard separation:** ai.js has NO platform fallback any more — an
  exhausted/broken client key throws into the bot's normal error paths
  (customer gets the polite "team will reply" line), status → "failing"
  with the provider error (shown in both dashboards), and self-heals to
  "verified" on the next success. Removing the key (client) keeps the
  permission; revoking (admin) deletes everything. Migration
  `client_ai_permission_flow` made key columns nullable + `key_added_at`.
  CLAUDE.md + security.md updated to the new invariant wording.

Also: `robots.txt` + `sitemap.xml` added (`c95537e`, canonical
`www.getvoicium.com`; apex 308→www); Meta app + Google OAuth redirect URIs for
the new domain explained to the owner (not yet confirmed done by them).

**Not verified (no dashboard credentials locally):** the real logged-in
Inventory tab against Supabase (add → vision → embed, edit → re-embed,
gallery upload to `product-images`). Code paths mirror the old add-product
flow; the owner should add one product with a photo and a Size option and
check the bot answers with the variant list.

**Found, not fixed:** three *different* vision prompts exist (`bot.js`
message-time, `products.js` add/edit, `import-one`) although `docs/prompts.md`
says they must be identical. Matching still works (all produce dense
descriptions) but drift is real — unify in a dedicated commit.

---

## Last session (2026-08-16) — Full UI redesign: crimson/white neumorphic

**Owner-directed brand change, applied across the whole surface in one pass.**
The owner supplied three reference videos (neumorphic sidebar, premium dashboard
header, premium date-range calendar) and asked for a red+white theme with dark
mode. This replaces the periwinkle brand — CLAUDE.md's invariant was updated to
match (crimson `#D92632` light / `#FF4D59` dark; mint still means "live" only).

What shipped (single commit):
- `ui.js` — new `PALETTE` (both themes), neumorphic shadow tokens
  (`--nm-out/-sm/-in`), red gradient + glow (`--acc-grad`, `--acc-glow`),
  red `seg-pill`, white-text `Btn gold`, `.pbtn` premium square button with
  red hover-flood, badge fixes (`${color}18` string concat on a CSS var never
  worked — replaced with `color-mix`).
- `dashboard-client.js` — sidebar is now a floating neumorphic card (video 1):
  brand tile, grouped sections with dividers, red active capsule, live
  conversation-count badge, Log out at the bottom; opens by default on desktop.
  Header is a floating rounded bar (video 2): menu/sync/bell(+badge)/theme
  toggle as premium squares, avatar with red gradient + mint live dot (mint dot
  only when a channel is connected).
- `Bookings.js` — premium range calendar (video 3): preset chips
  (Today / Next 7 days / This month), tap-two-days range with red endpoints and
  tinted band, start→end→duration summary strip, agenda + list filter follow
  the range (`day` state is now `{a,b}` keys).
- `landing.js`/`page.js` — public pages re-tokened to CSS vars (`--lp-*`),
  light/dark palettes + `THEME_BOOT_JS` (shared `al-theme` storage key with the
  dashboard), nav theme toggle, rounded neumorphic cards/film frame, red CTAs.
- `pricing-client.js` re-tokened to the same vars; static pages
  (terms/privacy/contact/google-calendar), admin, reset, Meta OAuth popups,
  `public/widget.js`, `dress.svg` all moved off periwinkle.

Verified: `npm run build` clean (no errors/warnings); landing, pricing and the
dashboard auth screen render locally with the new tokens in the served HTML
(placeholder env in gitignored `.env.local`). Browser console shows only two
**pre-existing** errors (broken Google-Fonts `@import` hoisting + React
hydration #425/#418/#423) — verified byte-identical on production *before* this
change, so they are not from this redesign. Logged as a separate task; not
fixed in this commit (one task at a time).

**NOT verified:** pixel-level screenshots (the browser pane could not composite
this session) and a real logged-in dashboard (no credentials locally). After
deploy, the owner should eyeball: sidebar/header on desktop + phone, dark mode
toggle, the Bookings range calendar, and the landing page in both themes.

**Follow-ups the same day (owner tested on the live site):**
- *Dark mode did nothing on the landing page* (`2f8c6f7`). Root cause was
  bigger than the toggle: every bare `<script dangerouslySetInnerHTML>` inside
  the page tree — theme boot, scroll-reveal, film autoplay, flow animation —
  is inserted by React via innerHTML and **never executes**. All of that had
  been silently dead in production since before the redesign. Fix: theme boot
  is a bare `<script>` in the root layout `<head>` (the one place inline
  scripts run in the App Router, before first paint), with the toggle
  delegated on `document` and re-asserted after hydration; the other three
  moved to `next/script afterInteractive`. Verified live: toggle flips
  `data-theme` and `--lp-bg`, persists across `/pricing` and `/dashboard`;
  reveal attaches to 10–13 elements (was 0).
- *Phone screenshots showed clipped edges* (`0f9c51b`): nav CTA clipped,
  How-it-works card cut by the fixed "sheet" frame, calendar's Saturday
  column + next arrow overflowing, header crowded to "Book…", sidebar shadow
  bleeding as a red sliver. All five fixed and measured at 360 and 320px:
  no horizontal overflow, CTA fully on-screen, calendar cells 37×37 inside
  the card. The calendar bug's real cause is worth remembering:
  `aspect-ratio:1` + a 44px `min-height` (also from the global coarse-pointer
  `button` rule) put a 44px floor on cell *width*, and 7×44 > a 320px card.

### What's next
1. Owner re-checks the phone views (both themes) after `0f9c51b` deploys.
2. Separate task exists for the pre-existing console errors (fonts + hydration).
3. Everything under earlier "What's next" sections still stands.

---

## Last session (2026-08-15) — Responsive audit

**Scheduled responsive audit — PR open, not merged.** Ran as an automated task
(no live owner watching). Branch `audit/responsive-2026-08-15`, PR #1:
https://github.com/Afzalnahid/autologic-chatbot/pull/1. Nothing pushed to `main`.

Scope: landing page (`src/app/page.js`, `src/lib/landing.js`) and dashboard shell
(`src/app/dashboard-client.js`, `src/app/dashboard/components/*`). Owner reported
"layout errors" on Desktop/Mobile/Mac-Safari without naming them, so this session
found them: full write-up with file:line in `docs/responsive-audit-2026-08-15.md`.

Four small fixes, each verified against a real production build
(`npm run build` + `npm run start`), not guessed from CSS reading alone:
- **Landing nav CTA clipped off-screen below ~340px width** (`page.js` nav +
  `.navbtn`). Confirmed with a headless-Chromium screenshot at 320px before
  (button read "START FRE…", cut mid-word — `overflow-x:hidden` was hiding the
  overflow instead of scrolling to it) and after (fully visible). This is the
  page's one conversion button, on the phone width class most common among
  older/budget devices in this market — worth flagging as the most important
  finding of the four.
- **Two mobile onboarding screens used `100vh` instead of `100dvh`**
  (`ConnectChannel`, `ConnectCalendar` in `dashboard-client.js`) — the rest of
  the dashboard shell already made this switch for mobile Safari's address-bar
  issue; these two were missed. Now consistent.
- **Conversations chat grid and Bookings calendar grid used a bare `1fr` next
  to a fixed column** (`Conversations.js:149`, `ui.js:279`) — no shrink floor,
  can overflow the container around 768–830px viewports (tablet portrait).
  Changed to `minmax(0,1fr)`, the standard fix, no visual change when there's
  room. The Conversations one is reasoned through carefully in the audit doc;
  the Bookings one is the same pattern applied defensively but **not** screenshot-
  verified — exercising it needs a logged-in agency account with Google
  Calendar connected, which this environment has no credentials for.
- **`backdrop-filter` missing its `-webkit-` twin** on the landing page's video
  sound button (`page.js`) — `ui.js`'s own `.seg-glass` already pairs the two
  correctly; this one spot was missed. Added, matching the existing pattern.

**Verification method, for the record:** built and served the app locally with
placeholder Supabase/Meta/etc. env values (gitignored `.env.local`, never
committed — the repo has no real credentials in this sandbox), then drove
headless Chromium (Playwright, installed only into the scratch directory, not
added to the repo) at 320/360/375/1440px against the real running server and
diffed screenshots before/after each fix. Caught one of my own mistakes this
way: a stale `next start` process from an earlier attempt kept answering on
the test port after a rebuild, so the first "re-verification" was silently
testing the *old* build — the screenshots and `curl | grep` on a known string
from the new code caught it before it was reported as done. Also: **no
WebKit/Safari engine was available in this sandbox** (only Chromium is
pre-installed here) — the Mac/Safari section of the audit is code review only,
clearly marked as such in the doc, not claimed as visually verified.

Also checked and found already correct, so left untouched: `position:sticky`,
`aspect-ratio`, flex/grid `gap` (all fine for a current-Safari target), the
`<video>` autoplay attributes (`playsInline`+`muted` already present), iOS
input-zoom prevention in `globals.css`, and every other grid in the dashboard
(all already `repeat(auto-fit, minmax(Npx,1fr))`, which doesn't have the
overflow risk the two fixed ones had).

None of the four fixes touch a locked prompt, a database query, or branch on
`business_type` — same code path for `ecommerce` and `agency` in every case.

Vercel's preview deployment for the PR came back **Ready** — independent
confirmation beyond the local build.

Subscribed to PR #1's activity (CI, review comments) per the standing PR-watch
rule; a self check-in is scheduled to follow up if nothing else arrives first.

### What's next
1. **Owner: review and merge PR #1** (or ask for changes) —
   https://github.com/Afzalnahid/autologic-chatbot/pull/1. Nothing is live
   until this merges.
2. If convenient, a quick look at the mobile nav fix on an actual small phone
   and the Bookings calendar tab on an actual Mac/Safari would close the two
   "not independently verified" gaps noted above and in the audit doc.
3. Everything under the 2026-08-07 "What's next" below still stands unchanged
   — this session did not touch any of it.

---

## Last session (2026-08-15) — Bug audit

**Full-project bug audit — DONE. PR #4 (`audit/bugs-2026-08-15` → `main`), not merged.**

Scheduled sweep for tenant-isolation bugs (the `client_id`-at-the-DB invariant),
`bot.js`, API routes, and the broadcast/follow-up 24-hour window. Full write-up:
`docs/bug-audit-2026-08-15.md`. 9 real bugs found and fixed, all small/reversible.

**The pattern `lessons.md` #14 predicted actually recurred, in 8 more places.**
The 2026-08-07 session fixed the "fetch all tenants, filter in JS" anti-pattern in
`bot.js` and wrote down "grep the whole repo for the same shape before calling it
done" — but that grep was never done. This session did it:
- `api/me`, `api/contacts` (×2) — **no filter and no limit at all**, fetched entire
  `message_buffer`/`contacts` tables on every dashboard/Conversations load.
- `api/orders`, `api/products`, `api/import-one` — global `limit(300/1000)`, no
  `client_id` filter. Same failure shape as the already-fixed `pendingFor` bug: once
  other tenants' rows fill the shared cap, a tenant's own orders/products can vanish
  from their own dashboard, or product re-import can silently duplicate instead of
  replacing.
- `api/profile`, `api/channels`, `api/send-message`, `api/send-media` — same anti-
  pattern on lower-traffic reads (usage counts, outbound-reply channel lookup).

All fixed the same way: move `.eq("client_id", ...)` into the Supabase query, drop
the JS filter. Return shapes unchanged, no caller updated.

**Unrelated bug also found and fixed: the public demo chat bot was completely
broken.** `api/demo-chat/route.js` imported `languageRule` from `bot.js`, which does
not exist — confirmed by a real `npm run build` import-error warning. Every message
threw and the route always returned `"Error: languageRule is not a function"`
instead of a reply. The function that was meant (`languageLock`, used by the real
reply engine for the same purpose) existed but wasn't exported. Exported it, fixed
the import and call site in `demo-chat/route.js` to match how `composeReply` already
does this. Build warning confirmed gone afterward.

**Checked and confirmed already correct** (no change): `bot.js`'s seven previously-
fixed reads, `api/admin` (its cross-tenant reads are the intended, role-gated admin
view — not a bug), `api/conversations`, `knowledge`, `comments`, `bookings`,
`bookings/list`, `generate-prompt`, `widget/chat`, `broadcast`, `analytics`,
`settings`, `billing`, `tags`, and the broadcast/follow-up 24-hour window logic in
`src/lib/broadcast.js` / `src/lib/followup.js` (still `WINDOW_HOURS - 0.5` anchored on
the customer's last inbound message, matches what was documented on 2026-08-07).

- Verified: `node --check` on every changed file; `npm run build` clean with
  placeholder Supabase env vars (this sandbox had none configured — the
  "supabaseUrl is required" failure reproduces identically on unmodified `main`
  with no env vars, so it's an environment-config limitation, not caused by this
  work). Not deployed — task explicitly said not to push to `main` or deploy.
- **Not yet done:** owner needs to review and merge PR #4, then spot-check Orders,
  Inventory, Conversations and the demo chat widget live. This session is watching
  the PR for CI/review activity per the standing PR-subscription rule.

### What's next
1. Owner reviews and merges (or requests changes on) PR #4.
2. After merge, spot-check the fixed dashboard tabs and the demo chat widget live —
   not verified in a browser this session (no deploy).
3. Everything under the 2026-08-07 "What's next" still stands unless already
   otherwise resolved: Task 8 (courier, ecommerce only) is the next unblocked
   feature; Task 3 (SSLCommerz) waits on sandbox credentials.
4. Idea flagged, not started: a shared query helper or lint rule that makes an
   unscoped `client_id` read impossible to write by accident, so this class of bug
   stops recurring file-by-file. See the audit report's "Not fixed" section.

---

## Last session (2026-08-15) — Real Asia/Dhaka time everywhere

**Real Asia/Dhaka time awareness — branch `feat/realtime-timezone-2026-08-15`, PR opened.**
Not pushed to `main` per the delivery rule for this task; owner needs to review and merge.

The root problem: Vercel runs the server in UTC, and the bot only had a manual,
hand-rolled Dhaka-time computation wired into the **agency** booking prompt. The
**ecommerce** reply path (`orderRule` in `composeReply()`) had no time awareness at
all — "is it open now", "today's offer", etc. were unanswerable for every ecommerce
tenant, on every channel.

What shipped:
- New `src/lib/time.js` — one shared, documented helper: `nowInDhaka()`,
  `formatDhaka()` / `formatDhakaDate()`, `currentTimeLine()`, `todayDhakaISO()`,
  `startOfDayDhaka()` / `startOfMonthDhaka()`. Fixed +6h offset is safe because
  Bangladesh has had no daylight saving since 2010.
- `src/lib/bot.js` `composeReply()` — `currentTimeLine()` is now appended to the
  prompt for **both** business types, so it reaches all four channels through the
  one shared function (FB/IG/WhatsApp via `processConversation`, the widget via
  `/api/widget/chat` calling `composeReply` directly). `bookingRule()` still adds
  its own worked ISO8601 example (needed for the AI to compute `start`/`end`) but
  no longer duplicates the current-time computation.
- Same file: the trial/paid quota "today"/"this month" boundaries in `botAllowed`
  were computed with `new Date(); x.setHours(0,0,0,0)`, which is **UTC** midnight on
  Vercel — 6am in Bangladesh. Now use `startOfDayDhaka()` / `startOfMonthDhaka()`.
- Same fix applied everywhere else the identical bug shape was found by grepping
  the whole repo: `broadcast.js` `remainingQuota()`, `api/me`, `api/billing`
  (`usageToday`/`usageThisMonth`), `api/admin/client-detail` (`dayStart`).
  **Deliberate, owner-visible behaviour change:** daily/monthly quota and usage
  counters now reset at real Dhaka midnight instead of 6am Dhaka time (UTC
  midnight) — see the PR body for the full list.
- `src/lib/email.js` — `notifyPaymentApproved`'s "valid until" and
  `notifyExpiringSoon`'s expiry date were formatted with no `timeZone`, so they ran
  in the server's UTC and could show the wrong calendar date near midnight. Now use
  `formatDhakaDate()`.
- `api/analytics/route.js` — had its own already-correct ad-hoc `DHAKA_OFFSET`
  constant for the per-day chart bucketing; consolidated onto the shared helper,
  zero behaviour change.
- **Left deliberately unchanged (verified correct):** everything computing an
  absolute UTC instant or duration (broadcast/follow-up 24-hour window math, token
  expiry, oauth-state age, rate-limit sweeps, stored timestamps), `gcal.js`'s
  `timeZone: "Asia/Dhaka"` on calendar events (already correct — it just needed the
  AI's "now" to be accurate, which the `composeReply` fix provides), and every
  client-side dashboard component (`Bookings.js`, `Profile.js`, `Billing.js`,
  `admin-client.js`, ...) — those run in the visitor's own browser and already
  reflect the visitor's real local timezone.

**Verified (real evidence, not assumption):** `npm run build` passes clean (only a
pre-existing, unrelated `languageRule` import warning that also reproduces on
unmodified `main`). Probed `time.js` directly with `node`: at a UTC instant that
falls in the Dhaka early-morning (`2026-08-15T20:30:00Z`), `formatDhaka()` correctly
reports `Sunday, August 16, 2026, 2:30 AM` and `startOfDayDhaka()` correctly returns
`2026-08-15T18:00:00Z` (= Dhaka midnight) — proving it crosses the UTC/Dhaka day
boundary correctly rather than reusing UTC midnight. `currentTimeLine()` against the
real system clock also matched: UTC `05:57` → Dhaka `11:57 AM`, exactly +6h.

**NOT verified:** no live message was sent through the deployed build (this was a
scheduled, unattended run — the branch was not deployed, per the task's delivery
rule). The owner should merge, let Vercel deploy, then send one ecommerce and one
agency test message asking something like "is this open right now?" and check the
bot's answer reflects real Bangladesh time.

### What's next
1. Owner reviews and merges PR `feat/realtime-timezone-2026-08-15` (or asks for
   changes).
2. After merge and deploy: live-test both business types on at least one channel —
   confirm the bot knows today's real date/day-of-week and the current time.
3. Everything under the 2026-08-07 "What's next" below still stands.
4. **Merge-time correction (caught while merging PR #5 into `main`):** this PR's
   `api/me/route.js` change was written against the pre-#4 `main` and would have
   *reverted* the just-merged `client_id`-at-the-DB fix for the daily usage count
   (back to fetch-all-then-filter-in-JS). Resolved by keeping PR #4's DB-level
   `.eq("client_id", ...)` filter and layering PR #5's `startOfDayDhaka()` boundary
   on top of it — both fixes now apply together, neither was lost.

---

## Last session (2026-08-15) — Product film background music

**Product film background music — merged into `main`, but not fully done.**
`feat/film-music-2026-08-15` → https://github.com/Afzalnahid/autologic-chatbot/pull/2

- `video/src/Video.jsx`: added `<Audio src={staticFile("music.mp3")} volume={0.35} />`
  once at the top level of `Film()`, outside any per-scene `<Sequence>`, so it plays
  across all seven scenes in both languages.
- **`video/public/music.mp3` was not obtained.** This session's network egress
  policy blocked every general-web host tried for a CC0 track (pixabay, freesound,
  archive.org, incompetech, opengameart, freepd, soundbible) — confirmed via direct
  HTTPS and via the WebFetch tool, not a fluke. Per this session's own rules, a
  policy-blocked host is reported, not routed around, so no placeholder/fabricated
  audio was committed. See `lessons.md` #19.
- Confirmed the wiring itself is correct: a test render with the `<Audio>` line
  present bundles and runs fine, failing only with a 404 on the not-yet-supplied
  `music.mp3` — exactly the expected failure once a real file lands.
- Bengali font checked independently (this was flagged as a known risk in a fresh
  sandbox, unrelated to the music task): installed `fonts-noto-core`, rendered a
  still frame of `AutologicBN`, read the PNG directly — real Bengali letters, not
  boxes. Also checked the **currently shipped** `public/film-bn.mp4` the same way —
  it already renders correctly, so no video files needed touching for this.
- `public/film-en.mp4` / `public/film-bn.mp4` are **unchanged** — there was nothing
  new to bake in without the audio file.
- Also hit and documented (not code-fixed): this sandbox can't reach
  `remotion.media` either, so Remotion's own headless-Chrome download fails the
  same way the music download did. Worked around it for testing with
  `--browser-executable=<path to an already-installed Chromium headless shell>`,
  confirmed the existing `npm run render:en`/`render:bn` scripts already forward
  that flag with `--` — no code or config change needed. Documented in
  `video/README.md`.

### What's next
1. **Owner action required to finish this PR:** download a real CC0/royalty-free
   track (~47s or loopable) from a reputable source (Pixabay Music, FreePD, Chosic's
   CC0 collection are all named in the PR body), save as `video/public/music.mp3`,
   run `cd video && npm run render`, copy the two outputs over
   `public/film-en.mp4` / `public/film-bn.mp4`, commit, and the PR is done.
2. PR is being watched for CI/review activity; Vercel preview already deployed
   READY.

---

## Last session (2026-08-07)

**`bot.js` client_id invariant — DONE (one commit `33f84b7`).**

The core reply engine read broadly and filtered in JavaScript, breaking the
"every query filters `client_id` at the DB with `.eq()`" invariant in seven
places. The same defect had been fixed in `GET /api/conversations` in an earlier
session (`d7ac431`), but the shared reply path — the busiest code — was never
grepped, so it kept the anti-pattern. Now fixed in `src/lib/bot.js`:

- `getClient` — was `select("*").limit(200)` + JS `.find(id)` → `.eq("id", clientId).maybeSingle()`.
- `botAllowed` contacts — was `select("*").limit(1000)` + JS `.find(sender_id)`, **no client_id filter at all** → `.eq("client_id", channel.client_id).eq("sender_id", senderId).limit(1)`. Latent cross-tenant read closed.
- `pendingFor` — **critical path.** Was newest 500 rows across *all* tenants, filtered in JS. On a busy platform a tenant's own pending messages could fall outside the 500 and the bot would silently stop replying. Now `.eq("client_id").eq("sender_id").eq("status","Pending")` at the DB. Order/limit semantics unchanged.
- `getMemory` — was 300 rows global, filtered by `session_id` only, **no client_id** → `.eq("client_id").eq("session_id").limit(10)`. Second latent cross-tenant read closed; also fixes memory going blank when a session's rows fell outside the global newest-300.
- `getSystemPrompt` and `handleComment`'s settings read — `app_settings select("*").limit(200)` + JS find → `.eq("id", String(clientId)).maybeSingle()`.
- Three `contacts` name-reads (FB, IG, comment) — added `.eq("client_id", clientId)` alongside the existing `sender_id` filter.

Return shapes unchanged, so the only external caller (`/api/widget/chat`) is
unaffected. Both business types share these functions; no type-specific branch
touched. `message_buffer (client_id, sender_id, created_at)` index already
exists (Task 6), so no migration.

- Verified: `node --check src/lib/bot.js` OK; grep confirms no client_id
  fetch-all-then-JS-filter remains; commit `33f84b7` (author + committer
  `Afzalnahid`); deployment `dpl_2jxeECgFmdiuqjXigyqJL1SxaJFq` **READY**, live
  SHA = HEAD.
- **Live verified 2026-08-07:** owner sent a real message through the new build;
  the bot replied normally and remembered the earlier message — so `getMemory`
  history and `pendingFor` debouncing both work after the DB-scoping. This was one
  channel / the owner's own business type (agency); the other channels and
  ecommerce were not separately re-tested, but they share the same functions.
  Rollback candidate if a problem shows up later: `dpl_EApdafX6…` (commit `b52480c`).

**Follow-up — DONE (separate commit `68b9515`).** `getChannelByPage` (`bot.js:20`)
was `channels select("*").limit(200)` + JS `.find(page_id)`, so tenant #201 would
silently never resolve. It resolves *which* channel a webhook belongs to, so it
has no `client_id` to filter — a scaling bug, not the invariant, which is why it
was its own commit. Now `.eq("status","connected").eq("page_id", pageId).limit(1)`;
the `[channel-miss]` diagnostic that lists known page_ids runs only on a miss, so
it costs nothing on the happy path. `node --check` OK; deployment
`dpl_EseggqW…` **READY**, live SHA = HEAD `68b9515`.

### Language rule — fixed and live-verified (2026-08-07)
Symptom: with **English only** selected, English *and* Bangla questions both got Bangla
replies. Also the reason two Meta App Review takes were rejected.

Root cause: `Settings` saves the choice at `settings.questionnaire.languages`; the reply
path was reading `settings.languages`, saw nothing, and defaulted to following the
customer. Three earlier commits tried to strengthen the prompt instead and all failed —
see `lessons.md` #15.

What is in place now, in order of authority:
1. `getLanguageMode(clientId)` reads `settings.questionnaire.languages` (falling back to
   `answers.languages` and `languages`). `English only` / `Bangla only` force that
   language; anything else means follow the customer.
2. `detectLanguage(text)` decides per message when the owner chose to follow: Bengali
   script → Bangla, Banglish word list → Banglish, otherwise English.
3. The directive is appended to the system prompt **and** to the user turn — the system
   prompt alone lost to the visible history, which the model was copying verbatim.
4. `enforceLanguage(items, lang)` checks the reply's script afterwards and rewrites it
   with a second Gemini call, retrying once. Prices, line breaks, URLs and
   `{{PLACEHOLDER}}` tokens are preserved. If both attempts fail the original goes out —
   a reply in the wrong language beats no reply.

Settings now offers exactly three options: *Follow the customer's language* · *Bangla
only* · *English only*.

Verified live on WhatsApp: Bangla question + `English only` → English reply; the same
question after switching to *Follow* → Bangla reply. Commits `f30cf43`, `1593c6f`,
`c814e65`, `c8bed2c`, `402dc49`, `b6f1136`, `49f8788`, `6156d1c`.

Note: `settings.businessPrompt` still contains a generated sentence saying the bot
replies in the customer's language. It is now overridden at runtime, and `profile.js`
generates the correct sentence for new profiles, but regenerating the prompt would
clean up the stale text.

### Tasks 6 and 7 — live-verified (2026-08-07)
- Tagging: "What is the cost of your service package?" → `Service Inquiry`;
  "I called three times and nobody answers. I want a refund." → `Complaint`. Both `auto`,
  and the second replaced the first, so one tag per conversation holds.
- Broadcast failure path: with the WhatsApp channel paused the preview showed
  *0 will receive it · 1 cannot be messaged* with the real reason named per contact, and
  flipped back to *1 will receive it* on resume. Task 6's "done when" is met.
- Still unverified: broadcast batching past 20 recipients, and Task 10 follow-ups.

### Landing page rebuilt (2026-08-08)
The dark, card-based page was replaced with a new visual language borrowed from a
reference the owner supplied: heavy serif display (Fraunces), technical monospace
microtype (IBM Plex Mono), hairline rules and corner crop marks, a numbered feature
grid instead of boxes. Rendered in the **product's own palette** — the reference's
cream and orange shipped first and were corrected, see `lessons.md` #18.

What the page now does:
- **How-it-works diagram** — four stages on a 16.8s clock. Each shows the incoming
  message, what the bot reads, the reply it actually sends, what it records, and a
  sentence naming the feature. Paused until scrolled into view.
- **Phone board** — four conversations (Messenger order, Instagram photo match,
  WhatsApp booking, website widget) playing in turn on a 28s clock inside a phone
  frame, chat anchored to the bottom, with typing indicators and story-style
  progress bars.
- **Bangla / English** — the whole page, via `?lang=bn`. Copy for both lives in
  `src/lib/landing.js` alongside the animation timings.
- **Nav** — Pricing · language · Log in · Start free trial. "Sign up" was removed as
  a duplicate door.

Files: `src/app/page.js` (the page) and `src/lib/landing.js` (copy, conversations,
generated CSS). The `src/app/preview/` scaffolding and its five motion variants were
deleted once the design was chosen.

Two defects introduced and fixed during this work, both worth remembering: the reveal
script ran before the cards existed (`lessons.md` #16), and the footer's privacy and
terms links were dropped in the rewrite (`lessons.md` #17).

Still open on the landing page: the `TODO_` case-study values are the owner's to
fill, and `public/demo/dress.svg` is an original illustration standing in for a real
product photograph.

### Next, and blocked
- Onboarding after signup is the real gap now: trial terms on the signup screen, a
  first-run path (connect a channel → add products → test), and asking the business
  type up front. Nothing exists for any of it.
- Chat widget and dashboard visual polish were planned after the landing page.
- Task 10 follow-ups and broadcast batching past 20 remain unverified.
- Task 8 (courier) and Task 3 (SSLCommerz) still need accounts.

### Google Calendar — what is done, and the order for the rest (2026-08-09)
The connection itself is finished and one-click: the owner presses Connect in
Bookings, Google's own consent screen opens, done. No IDs, no tokens. A
step-by-step guide now sits in the Bookings tab and on `/google-calendar`,
including the "app is not verified" screen, which is where first-time users stop.

Fixed at the same time: Bookings read `me.client.gcal_connected`, a field
`/api/me` does not return, so it always said "not connected" — for every client,
forever, even after a successful connection. It now asks `/api/gcal/status`
directly, the same source Profile uses, and shows which account is linked.

**Not code — Google Cloud Console, and blocked in this order:**
1. **Now, no domain needed:** set the OAuth consent screen's Publishing status to
   *In production*. In *Testing*, refresh tokens expire after 7 days, so every
   client's calendar silently disconnects a week after they connect. Production
   without verification means a 100-user lifetime cap and the unverified-app
   warning, both acceptable for now.
2. **After Meta App Review completes:** buy a custom domain. Adding one on Vercel
   keeps `autologic-chatbot.vercel.app` working, so the URLs given to Meta stay
   valid — but do not make the new domain primary with a redirect while the review
   is open. The owner deliberately deferred this to protect the review.
3. **Then:** submit Google verification. `calendar.events` is a sensitive scope,
   so it needs a domain verified in Search Console, a privacy policy on it, scope
   justification and a demo video. Google's manual review takes 4–6 weeks.

   **Before submitting, the owner will change the email addresses.** The Google
   Cloud project currently uses `nahidafzal97@gmail.com` as the user support
   email, which is his personal account. At verification time he wants a proper
   business address on the consent screen and a separate support address —
   something like `hello@` and `support@` on the custom domain. Raise this with
   him before anything is submitted: the consent-screen email is what every
   client sees when granting access, and changing branding fields after approval
   forces the app back through review.

**Current state of the Google project (checked 2026-08-09):** Publishing status
*In production*, user type *External*, so any client can connect today and refresh
tokens do not expire — the 7-day problem does not apply. App name "Autologic",
logo and support email are all filled in, but Google shows *"Your branding is not
being shown to users"*: uploading a logo requires verification, so until then
clients still see the plain unverified-app screen. Lifetime cap is 100 users.
Do not press "Back to testing" — it would reintroduce the 7-day token expiry.

### What's next
1. The two `bot.js` changes (`33f84b7`, `68b9515`) are live-verified on one
   channel (agency). Optional: if convenient, send one ecommerce-side test too —
   not required, same code path.
2. Everything under the 2026-08-01 "What's next" below still stands (case-study
   TODO values, Task 5/6/7 live tests, Task 8 courier, Task 3 when SSLCommerz
   sandbox exists). Task 8 (Pathao/Steadfast courier, ecommerce only) is the next
   feature with no external blocker.

---

## Last session (2026-08-01)

**Improvement sprint opened. Task 3 started and parked; Task 4 shipped.**
Owner's order for the remaining sprint: **4 → 5 → 6 → 7 → 8 → 9 → 10.**
(Task 9, the `dashboard-client.js` split, now runs *after* 5/6/7 add three more
tabs to it. That was raised and decided by the owner; expect the refactor to be
larger than the ~139 KB it is today.)

### Task 3 — SSLCommerz — PARKED, not abandoned

Done:
- Migration `payment_requests_gateway_columns`: added `source` (default `manual`),
  `gateway_status`, `val_id`, `bank_tran_id`, `card_type`, `currency` (default
  `BDT`), `paid_at`. Unique index on `val_id` where not null (idempotency), unique
  index on `txn_id` where `source <> 'manual'`, index on `(client_id, status)`.
  Verified: no CHECK constraint on `status`, so `initiated` / `failed` /
  `cancelled` are safe to write.
- `src/lib/sslcommerz.js` (commit b899f71) — sandbox/live URLs from `SSLCZ_MODE`,
  `initiateSession`, `validateTransaction`, `newTranId`, `amountMatches`. Nothing
  imports it yet, so it is inert.

**Blocked on:** no SSLCommerz sandbox account. Owner must register at
`developer.sslcommerz.com/registration/`, then set in Vercel env:
`SSLCZ_STORE_ID`, `SSLCZ_STORE_PASSWORD`, `SSLCZ_MODE=sandbox`,
`NEXT_PUBLIC_SITE_URL`. IPN URL to register in the sandbox merchant panel:
`/api/billing/ipn`. Live store needs trade licence / NID / eTIN and 10–15 working
days for banks — plan the "then live" half as weeks, not a session.

**UNRESOLVED — read before touching billing again.** Four files appeared in the
working directory during that session that the agent did not write:
`api/billing/checkout/`, `api/billing/ipn/`, `api/billing/callback/`,
`lib/billing-settle.js`. They were reviewed but **deliberately not pushed** —
provenance unknown, and it is the money path. They are not in the repo. Decide
where they came from before reusing them. Review findings if they are kept:
1. `billing-settle.js` returns `{ok:true, already:true}` on `claimErr` — a real
   update failure is reported as success, so the money is taken and the plan is
   never extended, silently. Must distinguish duplicate-`val_id` from other errors.
2. `callback` writes nothing to the DB on fail/cancel; the row stays `initiated`.
3. The validate-failed branch does not store `val_id` — audit gap.
4. `GET /api/billing` still does not return `gateway.enabled`, so the UI cannot
   choose between the online and manual paths. Stage 4 depends on it.

### Task 4 — case studies — DONE
- `src/lib/case-studies.js` (new): `CASE_STUDIES` array, one ecommerce entry and
  one agency entry, `TYPE_LABEL`, `isPlaceholder()`, `publishedCaseStudies()`.
  Adding a case study is one object, not a page.
- `src/app/page.js`: `CaseStudy` card + `#case-studies` section between Features
  and Footer. Design tokens reused from the page's own `T`; 2px left state rail;
  `auto-fit minmax(300px,1fr)` outer grid, `minmax(120px,1fr)` metric grid.
- **Nothing fake can ship:** any entry still containing a `TODO_` token is
  filtered out when `VERCEL_ENV === "production"`. On preview builds it renders
  with an amber rail and a "Draft — hidden in production" chip. So the section is
  invisible on the live site today, by design, and appears by itself the moment
  real figures replace the placeholders.
- Verified: commits 2faa580 + df9f4c4, deployment `dpl_88Wx71G8Hnugg...` READY,
  production target.

### Task 5 — website chat widget — CODE DONE, browser test pending
Stages 1–5 shipped; stage 6 is this write-up.
- Migration `channels_allowed_domains`: `channels.allowed_domains text[]` + index on
  `page_id`. The `channels_platform_check` constraint already allowed `website`, so
  the widget reuses the `channels` table: `platform='website'`, `page_id` = the public
  widget key. Channel pause, contacts, contact pause and the inbox therefore work with
  no new plumbing. **Vocabulary: the channel is `website`, not `web`** — the DB
  constraint decides.
- `src/lib/bot.js`: `composeReply()` extracted verbatim out of `processConversation()`
  (only deliberate change: `channel.platform` → a `platform` parameter). `botAllowed`
  and `saveMemory` are now exported. No call-site changed; push channels behave exactly
  as before.
- `src/app/api/widget/chat/route.js`: public endpoint. Bad key and disallowed origin
  return the same 403 on purpose. Domain match is on hostname including subdomains.
  Rate limit 20 messages / 5 min per session. Posts as `text/plain` so no preflight.
- `src/lib/widget.js`: key generation + domain rules, used by both routes.
- `src/app/api/channels/website/route.js`: create / rotate key / edit domains.
- `public/widget.js`: the embed. Entirely inside a shadow root, so it cannot restyle
  the host page and host CSS cannot break it. Double-load guarded. Session id in the
  visitor's localStorage.
- `dashboard-client.js`: `WebsiteWidget` card at the top of the Channels tab — create,
  copy the one-line embed, manage domains, rotate the key.
- **Deliberate behaviour difference from Messenger:** when the bot is not allowed to
  answer (paused, quota, expired plan) the visitor still gets an honest line and the
  message still lands in the inbox. Silence is fine on Messenger; on a website panel it
  looks broken.
- Verified: `/widget.js` → 200 `application/javascript`; `/api/widget/chat` → 405 on
  GET; `/api/channels/website` → 401; deployment `dpl_7Gs6NfMtQoK3c…` READY.
- **NOT verified:** the widget in a real browser. Owner will create a key, embed it on
  a page served from `localhost` (a `file://` page sends no origin and will be
  refused), and confirm the reply appears and lands in Conversations.

### Task 6 — broadcast / bulk messaging — CODE DONE, live test pending
- Migrations: `broadcasts`, `broadcast_recipients` (+ `claimed_at`),
  `contacts.broadcast_opt_out`, `orders.sender_id`, and indexes on
  `message_buffer (client_id, sender_id, created_at)`.
- **`orders` never stored who placed the order**, so the "has ordered" segment was
  impossible. `maybeSaveOrder` now receives `senderId` and stores it. Only orders
  from 2026-08-01 onward can be segmented; older ones cannot be linked at all.
- `src/lib/broadcast.js` — `resolveAudience()` returns who is eligible and, for
  everyone else, the reason: outside the 24-hour window, channel paused, contact
  paused, opted out. `remainingQuota()` counts customer messages plus broadcast
  sends against the plan.
- `src/lib/broadcast-send.js` — batches of 20 per request, claim-before-send,
  `sendBroadcastText` (`messaging_type: UPDATE`, not `RESPONSE`, because a broadcast
  is not a reply), the platform's own error stored per recipient, a copy of the sent
  message written into the inbox.
- `/api/broadcast` — `preview`, `send`, `resume`, `recipients`, plus history.
- Broadcast tab in `dashboard-client.js`: compose, preview with reasons, send with
  progress, history with per-recipient outcome.
- **Decided: 24-hour window only.** No message tags in v1. Tags may never carry
  promotional content and misuse risks the Page — the platform's own survival is
  not worth that. WhatsApp outside the window would need approved templates, which
  do not exist yet.
- **Correction to the last entry:** the earlier note that "the website channel has
  no 24-hour concern" was the wrong framing. The real point is that a website
  visitor cannot be broadcast to at all — there is no address once the tab closes.
  `BROADCAST_CHANNELS` is facebook, instagram, whatsapp only.
- Tag segments (Task 7) are wired but return `tags_available: false` until Task 7.
- Verified: `/api/broadcast` → 401 unauthenticated; deployment
  `dpl_6jtCNow3bvsjG…` READY; JSX check run and confirmed passing.
- **NOT verified:** an actual send. Owner needs two people who messaged the Page in
  the last 24 hours. Deliberate-failure test: pause the channel just before sending
  and confirm the real reason appears per recipient.

### Instagram was silently dead — fixed 2026-08-02
Symptom: IG channel showed `connected`, but no reply ever came and `message_buffer`
had **zero** instagram rows — not even inbound ones.

Cause: Facebook and Instagram are two separate Meta apps in this project. IG connects
through Instagram Login (`api.instagram.com`, `IG_APP_ID` / `IG_APP_SECRET`), so Meta
signs IG webhooks with the *Instagram* app secret. `/api/messenger` verified every
delivery against `FB_APP_SECRET` only, so every IG webhook failed
`X-Hub-Signature-256` and was rejected 401 before anything was logged or stored. Meta
then retried, which is why the logs showed a flood of 401s.

Fix (commit e0635dd): `verifyFBSignature` now accepts a signature matching **either**
app secret. Security is unchanged — both secrets are ours, and a wrong secret, a
missing header or a malformed header are still rejected (each case tested).

This affected **every tenant who connected Instagram**, not one account.

Watch: a second IG account (`17841405599134057`) also posts to the webhook and is
ignored with `[channel-miss]`. Harmless today, but if two IG accounts under the same
Meta app were ever both connected as channels, their bots could answer each other.

### Live verification done 2026-08-02
- Website widget: real reply on nahid-afzal-portfolio.vercel.app, stored as
  `platform='website'`, visible in Conversations.
- Broadcast: one real send, `total 1 → sent 1, failed 0`, status `sent`. Batching
  (>20 recipients) and the deliberate-failure path are still untested.
- Facebook: replying normally after the `composeReply` extraction — no regression.
- Instagram: replying normally after the signature fix.

### Task 7 — auto tagging + complaint detection — CODE DONE, live test pending
- Migration `conversation_tags`.
- `src/lib/tags.js`: fixed vocabulary per business type, Bangla + English keyword
  rules, Gemini only when the rules are inconclusive, `Other` on AI failure so a
  conversation is never left untagged. Complaint is checked before every other
  rule — "৫ দিন হয়ে গেল, এখনো পাইনি, টাকা ফেরত দিন" is a complaint, not a delivery
  question. Rules were run against real sentences before shipping; the first
  version missed "অর্ডারটা কোথায়" because only "অর্ডার কোথায়" was listed.
- Hooked in once, at the end of `composeReply`, so all four channels are covered
  by a single call. Wrapped in try/catch: tagging can never break a reply.
- `/api/tags`: read with counts, manual add, manual remove. Manual always wins.
- Conversations tab: tag filter chips with counts (Complaint in red), tag pills on
  each conversation, manual tag dropdown in the chat header.
- Broadcast tag segment is now live: `tagsAvailable` is true, `resolveAudience`
  filters by `conversation_tags`, and the composer has a Tag dropdown.
- **NOT verified:** no message has arrived since the hook shipped, so the tags
  table is still empty. Owner should send "দাম কত?" and "টাকা ফেরত দিন" from FB or
  IG and confirm the chips and pills appear.

### Task 9 — dashboard-client split — DONE (2026-08-06)
**196 KB / 2428 lines → 35 KB / 546 lines.** Target was ~40 KB.

`dashboard-client.js` now holds only the shell: `AuthGate`, `Onboarding`,
`ConnectChannel`, `ConnectCalendar`, `Dashboard`. Fourteen tabs plus `session.js`
and `ui.js` live in `src/app/dashboard/components/`.

Each tab was moved verbatim in its own commit, with the JSX parse check run and the
live deployment's commit SHA confirmed before starting the next one. Owner confirmed
login and every tab still work.

Dependencies found while moving, each caught before pushing:
- Analytics needed the chart helpers (`KStat`, `Spark`, `BarList`, `fmtNum`,
  `fmtMoney`) → moved to `ui.js`.
- Billing needed `PLAN_META`, `PLAN_LIST`, `taka`, `shortDate` → `ui.js`.
- Profile needed the small `Row` helper → moved into `Profile.js`.
- Settings' `SAMPLE_ECOM` / `SAMPLE_AGENCY` are **also used by Onboarding** → kept in
  `ui.js` rather than moved into `Settings.js`.
- Channels renders `WebsiteWidget` → given its own import.
- Broadcast was missing `Badge` in its imports on the first attempt.

Not done: replacing hex literals with `var(--…)`. The tokens now have one home in
`ui.js`, which was the point of that item, but the values are still JS constants
rather than CSS variables. `Btn`'s secondary background is still the old gold
literal `rgba(240,192,64,0.12)` — a leftover from before the periwinkle change.

### Superseded progress notes
Refactor only, zero behaviour change. One tab per commit.

Done so far: 196 KB / 2428 lines → 126 KB / 1839 lines.
- `dashboard/components/session.js` — supabase session, `AUTH_TOKEN`, `api()`.
  Token writes now go through `setAuthToken()` because an exported `let` cannot be
  assigned from another module. Three call sites rewritten, all verified. Owner
  confirmed login still works.
- `dashboard/components/ui.js` — design tokens `T`, `Btn`, `Badge`, `Card`, `Inp`,
  `useIsMobile`, `words`, plus `PLAN_META`, `PLAN_LIST`, `taka`, `shortDate`.
- `dashboard/components/Broadcast.js`, `WebsiteWidget.js`, `Billing.js` — moved
  verbatim. `Badge` was missing from Broadcast's imports on the first attempt and
  was caught before pushing.

Still inline: Conversations (largest), Analytics, Orders, Inventory, Comments,
Channels, Settings, Profile, Demo.

**Unaccounted code, third occurrence (2026-08-06).** A `BroadcastTab.js` appeared
locally along with an import in `dashboard-client.js` and the inline component
deleted — this time *editing* the working file, not just adding one. Verified the
repo was clean (no such file, no such import) before deleting it and doing the
extraction by hand. From now on, diff the local file against the remote before
starting any step.

**Vercel note:** three pushes in quick succession can build out of order and the
newest commit's build may be CANCELED, leaving an older tree live. After a burst of
pushes, check that the latest READY deployment's SHA is actually HEAD.

### Task 10 — follow-up sequences — CODE DONE, live test pending
- Migration `followups`. Config in `app_settings.settings.followup`.
- `src/lib/followup.js`: `runFollowups()` — throttled to once per 15 minutes,
  claims the run by stamping `last_run_at` *before* working so two dashboard loads
  cannot both send, sends at most 20 per run.
- **The spec said "follow up at 24h", which is not deliverable.** Meta's window
  closes exactly 24 hours after the customer's last message, so a follow-up sent at
  24h always fails. The delay is capped at 23 hours and defaults to 20, anchored on
  the customer's last inbound message.
- Requires an intent tag from Task 7. No tag → nothing sent, deliberately.
- Stops on its own: a newer customer message removes the candidate, a matching order
  or booking removes them, and a `followups` row blocks repeats for 30 days.
- Hooked into `GET /api/conversations`. Settings tab has on/off, delay and a message
  box per business type.
- **NOT verified:** no follow-up has been sent yet. To test: send an inquiry from a
  test account, tag it Product Inquiry, set the delay to 1 hour, wait, then open the
  dashboard.

**Defect found while working here, deliberately not fixed:** `GET /api/conversations`
reads `message_buffer` with no `client_id` filter at the database level and filters
in JavaScript afterwards, taking only the newest 500 rows across *all* tenants. That
breaks the client_id invariant and, once the platform is busy, a tenant's own
conversations can fall outside the 500 and vanish from their inbox. Needs its own
commit.

### What's next
1. Owner fills the `TODO_` values in `src/lib/case-studies.js` (business name,
   subtitle, three metrics, story) for at least the ecommerce entry.
2. Owner runs the Task 5 browser test described above.
3. Owner runs the Task 6 send test described above.
4. Owner runs the Task 7 test described above.
5. **Task 8 — courier integration (ecommerce only).** Pathao and Steadfast first,
   one adapter file per courier, and completely hidden for `business_type = agency`.
6. Return to Task 3 when SSLCommerz sandbox credentials exist.
7. Still untested from Task 6: batching past 20 recipients, and the deliberate
   failure showing a real platform error.

### Unaccounted code — happened twice on 2026-08-01
Files appeared in the working directory that the agent did not write: first the four
billing files, then a complete `Broadcast` component plus nav wiring inside
`dashboard-client.js`. Neither was pushed. The second was verified against the remote
file before deleting: the Task 5 push had added exactly 107 lines, one function
(`WebsiteWidget`), so nothing unaccounted reached the repo. The Broadcast tab now in
the repo was written from scratch afterwards. If this recurs, check whether another
session or tool is editing the same project at the same time.

### Mistakes & lessons
- Task 3 was started before checking whether the external account it depends on
  existed. Stage 1 shipped, then the task stalled. See `lessons.md` #8.
- Unknown-provenance code was found in the workspace and not pushed. See #9.

---

## Last session (2026-07-31)

**Security audit & hardening** — Full 5-prompt security review (Gitleaks, Bearer, ECC Production
Audit, Trail of Bits, ECC Security Review) applied to the codebase. 9 fixes pushed.

### What was done
1. `src/utils/supabase/client.js` — Removed hardcoded Supabase URL/key fallbacks (were leaking
   project ID into source code even without env vars set).
2. `src/lib/auth.js` — `requireClient()` was fetching ALL clients then filtering in JS;
   now uses `.eq("owner_email", email).maybeSingle()` for DB-level filtering.
3. `src/app/api/settings/route.js` — GET returned `{}` (200) for unauthenticated requests;
   now returns 401. All error responses hide `e.message`; DB queries use `.eq()` filter.
   PATCH similarly fixed.
4. `src/app/api/generate-prompt/route.js` — Final catch was returning `e.message` to client;
   now logs server-side and returns generic "Internal server error".
5. `src/app/api/ig/callback/route.js` — `IG_APP_ID` had hardcoded fallback `"1249182887184854"`;
   removed. Now fails with 500 if env var missing.
6. `src/app/api/auth/route.js` — No rate limiting on admin password check;
   added IP-based rate limit: 5 attempts/minute using existing `rate-limit.js`.
7. `next.config.js` — Added security headers to all routes:
   X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
   Strict-Transport-Security (1 year), Referrer-Policy, Permissions-Policy.
8. `src/app/api/messenger/route.js` — Added `verifyFBSignature()` using HMAC-SHA256 against
   `FACEBOOK_APP_SECRET`. If secret not set → warns and allows (graceful degradation).
   If set and signature invalid → 401 reject.
9. `src/app/api/whatsapp/route.js` — Same signature verification as Messenger.

### What's next
- **ACTION REQUIRED:** Add `FACEBOOK_APP_SECRET` to Vercel env vars (Settings → Environment
  Variables). Get it from Meta Developer Portal → App → App Secret. Once set, webhooks will
  enforce signature verification and reject any forged POST requests.
- Confirm Vercel build green after today's 9 commits.
- Ongoing: acquire custom domain (unlocks Resend + Google Calendar OAuth verification).

### Mistakes & lessons
- `supabase.from("clients").select("*")` in `requireClient()` was fetching the entire clients
  table on every authenticated API call — a performance and data-scope problem. Always add
  `.eq()` filter at DB level, not in JS.
- Hardcoded fallback values in source code (||"real-value") are a secret leak even when the
  "real" env var is set: the fallback is stored in git history forever. Never use real values
  as fallbacks.


## Last session (2026-07-30)

Long session. Two threads: **Meta App Review prep** and **fixing real bugs found while preparing it**.

### Bugs found and fixed

1. **Instagram was silently dead.** Webhooks arrived, nothing happened. Cause: we stored
   Instagram's *app-scoped* id (`me?fields=id`, e.g. 28445178038400379) but webhooks carry
   the *IG account* id (`me?fields=user_id`, e.g. 17841441686062791), so `getChannelByPage`
   missed on every message. Fixed in `api/ig/callback`; DB row corrected; duplicate stale
   IG channel deleted. IG DM + comment→inbox now confirmed working.
2. **IG send URL** used `/me/messages`; Instagram needs `/{ig_account_id}/messages`.
   `page_id` is now threaded through every send call in `messenger.js` / `bot.js`.
3. **FB private reply used a retired endpoint.** `/{comment-id}/private_replies` returns a
   generic `(#100) ... does not support this operation`. Moved to the Send API
   (`/{page-id}/messages` with `recipient.comment_id`), same shape as the IG path. Confirmed
   working — Facebook now shows "Page responded privately".
4. **Multi-tenant leak (serious).** `api/me` seeded every new client by copying a shared
   `app_settings` row with id `default` — which held Evalora jewellery's name, greeting and a
   4,800-char jewellery sales prompt. Every new signup inherited another business's brand.
   Now each tenant is seeded from its own `business_name`; the `default` row was made neutral.
5. **Onboarding threw away the client's work.** "Skip for now" was `setStep("choose"); return;`
   — the business description was discarded. Combined with Gemini being 429'd, *every* new
   client today would have ended up with a knowledge-free bot. Added `src/lib/profile.js`
   `composeProfile()` — deterministic, no AI. Generation now upgrades a profile; it never
   creates it. Skip saves via `mode:"raw"`. `getSystemPrompt` fallback no longer improvises.
6. **Page picker scrolled out of view.** Unbounded radio list in a short popup. Rebuilt with a
   bounded scroll area, search box and sticky Connect button.
7. **Comment fallback was hardcoded bilingual** ("ধন্যবাদ! ... / Thanks! ..."). When Gemini
   fails the fallback *is* the customer-facing reply, so it now follows the commenter's script.
8. **Post-connect redirect** went to `/#channels` (landing page) instead of `/dashboard#channels`
   for FB and IG. WA was already correct.
9. Added `/api/ig/deauth` (required by Meta App Review).
10. IG OAuth scope gained `instagram_business_manage_comments`.

### Design system

New token system applied across the whole app. Gold `#f0c040` → periwinkle `#5B8CFF` primary;
amber survives as warning only; mint `#2ED3A7` means exactly one thing (a bot is live).
Surfaces are blue-black, never pure black. Type: Geist + Geist Mono + Hind Siliguri for Bangla.
Signature element: a 2px state rail on the left edge of cards and rows.
Nine files carried their own copy of the old palette (landing, pricing, admin, legal pages) —
all migrated. **Still to do:** replace hex literals with `var(--…)` reads so there is one source
of truth. A standalone design-system reference page was produced for review.

---

## Next up — resume exactly here

**Blocked on one step, then Video 1 can be recorded.**

`pages_manage_engagement` is missing from the token, so public comment replies fail with
`(#200) Permissions error`. The Facebook Login *configuration* (id `2178064332957710`) — not a
`scope` param — decides permissions. `pages_manage_engagement` and `business_management` were
added to it, but the old token is still in use.

Do this in order:
1. `facebook.com/settings?tab=business_tools` → AutoLogic → **Remove**  ← the step that keeps
   getting skipped; without it Facebook never re-prompts and the old token persists.
2. Dashboard → Channels → Facebook → Disconnect.
3. Connect new channel → Facebook → **"Opt in to all current and future Pages"**.
4. Comment on the pricing post → dashboard should show "Replied", not a red error.
5. Then record **Video 1**.

### Meta App Review plan

Three videos, nine permissions. Same video link can back several permissions; each permission
still needs its own usage description. Put timestamps in the YouTube description and cite them
in the reviewer instructions.

- **Video 1 — Facebook** (~4 min): pages_manage_metadata · pages_read_engagement · pages_manage_engagement
- **Video 2 — Instagram** (~4 min): instagram_business_basic · ..._manage_messages · ..._manage_comments
- **Video 3 — WhatsApp** (~3 min): business_management · whatsapp_business_management · whatsapp_business_messaging

Already approved: `pages_show_list`, `pages_messaging`.

**Recording setup that works:** two Chrome profiles side by side, 55/45 — left is the dashboard
(owner account), right is Facebook/Instagram as a *second* account playing the customer. Text
overlay, no narration. OBS at 1920×1080/30fps, MP4, cursor capture on, extensions unpinned,
bookmarks hidden. Every test message and comment must be **in English** — the reviewer cannot
read Bangla, and the bot mirrors the customer's language.

**Two earlier takes were rejected in review:** the first ran only 2:15 and covered one
permission of three; both had the bot replying in Bangla. Do not cut Segments 3 and 4 — they
are the only evidence for two of the three permissions.

**Assets ready:** 3 Facebook posts, 3 Instagram posts (1080×1080, generated to match the new
design system), all carrying a "Comment DETAILS / PRICE / DEMO" call to action so comment
automation looks natural to a reviewer.

### Also pending

- **New domain follow-ups (owner's hands):** add `getvoicium.com` +
  `www.getvoicium.com` to Meta App Domains and the six `/api/{fb,ig,wa}/callback`
  redirect URIs (both hosts) to Facebook Login for Business; add the two
  `/api/gcal/callback` URIs to the Google OAuth client. Google Search Console:
  add domain property, TXT record in Hostinger, submit `sitemap.xml`, request
  indexing of `https://www.getvoicium.com/`.
- **2026-08-20 session-split fix (`98cdce3`):** owner's test showed /admin and
  /dashboard shared one login (both on the @supabase/ssr cookie session; his
  admin email also owns the old "Autologic System" client, so admin login
  opened the dashboard as that client, and either logout — global scope —
  killed both). Now `createAdminClient()` (supabase-js, localStorage key
  `al-admin-auth`) powers /admin; all logouts are `signOut({scope:"local"})`.
  The two logins are fully independent. The BYOK "Allow" had never landed
  (client_ai was empty — lost in the identity chaos); permission for
  Broker's BD was granted directly by SQL, so its Settings now shows the
  API key box, ready for the owner's test.
- **2026-08-20 (later): admin "Give / Remove API key access" silently did
  nothing — ROOT CAUSE FOUND (`b6cf47e`).** The AI tab's secret-key card was
  rendered as `{locked && <Card>…<PwInput/></Card>}` with `locked = !superKey`,
  so the FIRST keystroke flipped `locked` and unmounted the field. Only one
  character ever reached the server → every action 403'd as "wrong key". The
  owner saw the box "vanish" when typing. Fix: the gate card is always
  mounted (the Admins page already did this correctly), with a green
  "Key entered" state and a clear button. My earlier guess that
  ADMIN_PASSWORD was missing in Vercel was NOT the cause — but the better
  error messages from `86deb1e` (which name env-missing vs wrong-key) are
  worth keeping. AIKeyBox also re-checks /api/ai-key on focus + no-store.
  Broker's BD's permission row is still in place, ready for the real test.
- **BYOK smoke test (owner will do):** /admin → test client → AI key tab →
  secret key → Allow → log in as that client → Settings → "Your AI API key"
  box appears → paste a real Google AI Studio key → Verify & activate →
  message the bot (reply should ride the client key; check Vercel logs for
  `[ai]` lines). Also try a wrong key (must refuse to save) and watch the
  failing→verified self-heal after a quota reset.
- **Voice smoke test:** send a voice note on WhatsApp and on Messenger to a
  connected channel; inbox should show "🎤 <transcript>" and the bot should
  answer the words. Try a mumbled one → expect the "couldn't hear clearly"
  reply.
- **Orders smoke test:** place a test order via chat; Orders tab should show
  item lines with photo/qty/unit price, delivery charge (or "to confirm"),
  total, payment; try Confirm → Shipped → Delivered and the CSV.
- **Admin console smoke test as the super admin:** open `/admin`, check
  Overview numbers against Supabase (MRR = sum of monthly prices of active
  paid, non-suspended clients), approve/reject a test payment, change a
  plan from the drawer. Only verified with mock data locally.
- **Re-connect one channel** to see the new "connected" page + dashboard
  banner end to end (needs Meta login — not testable here).
- **Inventory smoke test on the real account:** add one product with a photo,
  a Size option and generated variants; edit it (change primary photo);
  confirm the bot answers with sizes and the chosen variant's price.
- **Unify the three vision prompts** (see 2026-08-17 entry).
- **Booking pipeline** is instrumented but untested end to end. `gcal_connected` is true and a
  refresh token exists, but `gcal_token_expiry` was stale. Unverified Google apps get 7-day
  refresh tokens, so it may simply be dead — `getValidAccessToken` now detects `invalid_grant`,
  clears `gcal_connected` and logs it. Reconnect Calendar, book a meeting, read the
  `[booking]` log lines to see which step fails.
- **Google Cloud billing — now the single biggest blocker (confirmed 2026-08-19
  in production logs).** The key is on the free tier: `limit: 20, model:
  gemini-2.5-flash`, per day. Every customer message costs one call, a voice
  note costs two (transcribe + reply), a photo costs two. So the bot goes down
  after roughly ten messages a day, on every tenant at once. The model chain
  buys one free quota per model in the list, nothing more. **Enable billing on
  the Google Cloud project** (Gemini API → billing) before any demo, video or
  paying customer.
- **Custom domain** — still blocks Resend email verification and Google Calendar OAuth
  verification.

---

## Start here every session

0. Read `AGENTS.md` **first** — it defines how work is done here (roles, stage gates,
   product invariants, platform gotchas, token discipline, session-close rules).
   This file defines *state*; `AGENTS.md` defines *method*.
1. Read this file.
2. Read `lessons.md` — the running log of mistakes and the rule each produced. It exists so the
   same mistake is not repeated. Append to it whenever a new one is found.
3. Pick up from **Next up** above.
4. Report understanding in <=5 lines, then wait for GO before writing code.

## How I work here

1. **Verify before asserting.** This session produced a wrong confident diagnosis (claimed the
   Page list was scrolled; it was actually Business-Portfolio ownership hiding the Page from
   `/me/accounts`). Check logs, DB or the Graph API first, then state the cause.
2. **Team / sub-agent mindset.** Break work into stages, verify each before moving on.
3. **Token discipline.** Reuse the clone, read only the lines needed, batch edits.
4. **This file.** Update "Last session" and "Next up" at the end of each session.
5. **Enterprise standard.** One-click, no token/ID hunting. And fix the *system*, not the
   symptom — the Evalora leak was one client's settings; the real bug was the seeding path.
6. **Quality over speed.** `node --check` before pushing; Vercel READY is the proof.

---

## Project facts

- **Repo:** `Afzalnahid/autologic-chatbot` (public). Push via GitHub Contents API; Vercel
  auto-deploys `main`. **Live:** autologic-chatbot.vercel.app
- **Stack:** Next.js 14 App Router, Supabase (pgvector), Google Gemini, Meta Graph API, Resend,
  Google Calendar, Vercel.
- **Owner:** Nahid Afzal, Cumilla. Replies in Bangla. Business type: agency.
- **Meta App ID:** 914246304594380 · **Instagram App ID:** 1249182887184854
- **FB Login config id:** 2178064332957710 (permissions come from here, not a scope param)
- **Supabase:** cchvsgouqqxibhubioch · **Vercel:** prj_xGVnXbbzOPPDiqqwLGjnnwMJzv3V,
  team_EH2oK3NTVjHRAqGHvohVbxAa

## Architecture

- **Prompt system (3 tiers, enforced in code):** `FIXED_BASE` + `FIXED_ECOM`/`FIXED_AGENCY`
  by business_type + the client's own profile from `app_settings`. Clients cannot remove the
  fixed rules. `getSystemPrompt` reads `businessPrompt || systemPrompt || safe fallback`.
- **Key files:** `src/lib/bot.js` (reply engine, booking, comments, typing),
  `src/lib/messenger.js` (send/parse, all channels), `src/lib/profile.js` (AI-free profile
  composer), `src/lib/oauth-state.js` (signed state, 30-min TTL), `src/lib/rate-limit.js`,
  `src/lib/route-errors.js`, `src/lib/gcal.js`, `src/lib/plans.js`.
- **Channels:** `/api/<fb|ig|wa>/login → callback → select`, signed state throughout.
  Calendar: `/api/gcal/login → callback`.
- **Onboarding:** `onboarding → connect → connect-cal (agency only) → app`.

## Known Meta constraints (not bugs)

- FB/IG cannot reply-to-a-specific-message or react via API. WhatsApp can.
- Private reply to a comment: once only, within 7 days, needs `pages_messaging`. A Page cannot
  private-reply to another Page or to its own admin — always test from a second personal profile.
- Pages owned by a Business Portfolio do **not** appear in `/me/accounts` without
  `business_management`. AutoLogic Systems had to be removed from the portfolio to be connectable.
- WhatsApp typing indicator also marks the message read.








