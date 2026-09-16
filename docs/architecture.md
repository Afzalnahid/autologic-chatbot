# Architecture

Autologic is a multi-tenant SaaS AI chatbot platform. One deployment serves every
business ("client"); all data is separated by `client_id`.

Live: https://www.tellmoreai.com

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes and UI in one deployable unit |
| Hosting | Vercel | Git push → deploy, serverless functions |
| Database | Supabase Postgres + pgvector | Relational data and vector search in one place |
| Storage | Supabase Storage | Product images, logos, knowledge files |
| Auth | Supabase Auth (email/password) | Session handling, JWT verification |
| AI | Google Gemini | Chat, vision, audio transcription, embeddings |
| Channels | Meta Graph API | Facebook, Instagram, WhatsApp |
| Website chat | `public/widget.js` | One-line embed on the tenant's own site |
| Broadcasts | `src/lib/broadcast.js` + `broadcast-send.js` | Segment → 24-hour window check → throttled batch send |
| Calendar | Google Calendar API | Meeting booking with Meet links |
| Email | Resend | Admin and billing notifications |

Runtime dependencies are deliberately few (`package.json`): the Supabase and Gemini
SDKs, plus `cheerio` (product scraping), `pdf-parse` and `mammoth` (document parsing).
No UI framework, no chart library — all UI is hand-written React with inline styles,
which keeps the dashboard bundle small (~89 kB).

---

## 2. Runtime shape

```
Customer (Messenger / Instagram / WhatsApp)
        │  webhook POST
        ▼
/api/messenger  /api/whatsapp        ← channel webhooks
/api/widget/chat                     ← website widget (request → response)
        │  writes to message_buffer, then calls the bot
        ▼
src/lib/bot.js                        ← the core engine
        ├─ resolve channel → client    (channels.page_id → client_id)
        ├─ plan / quota gate           (auth.js + plans.js)
        ├─ media understanding         (gemini.js: vision, audio)
        ├─ retrieval                   (products or knowledge_base, pgvector)
        ├─ prompt assembly             (locked core + business profile)
        ├─ Gemini chat completion
        └─ send reply                  (messenger.js → Graph API)

`composeReply()` is the part that produces the answer — retrieval, prompt assembly,
Gemini, order/booking side effects. `processConversation()` wraps it for the push
channels (batching, typing, Graph send); `/api/widget/chat` calls it directly and
returns the items to the browser. Every channel therefore shares one engine.

**Pause / hand-off.** A conversation's bot can be switched off (`contacts.bot_enabled`,
the chat's "Live" toggle) or a whole channel (`channels.bot_enabled`). While off, an
incoming message is still saved (`status: "Pending"`) and the owner is still notified,
but no reply is generated. A human reply — from the dashboard box (`/api/send-message`)
or typed in the Messenger app / Business Suite / Page Inbox (an `is_echo` webhook) —
marks that contact's Pending customer rows `Replied`, so the backlog cannot pile up.
An echo is dropped only when its `app_id` is one of OUR Meta app ids (our own send,
already stored); Meta's own tools stamp their app id on a human's reply, so "has an
app_id" alone never means "ours" (`parseMessengerEvent`, `OWN_APP_IDS`). As a second
guard, an echo whose text the bot or dashboard already wrote to that thread in the
last 5 minutes is ignored (`handleIncoming`). Meta's own *instant reply / away
message* echoes the same way (same app id) seconds after the customer wrote: it is
stored in the thread but treated as AUTOMATED (`src/lib/echo-rules.js`
`isAutomatedEcho`: within 20 s of the newest customer message and no business reply in
the previous 10 min) — the customer's rows stay Pending so the bot still answers, and
it is kept out of the bot's memory. Meta delivers a field only when BOTH
subscriptions carry it: the Facebook APP's Page subscription (App Dashboard →
Webhooks, `/{app-id}/subscriptions`) and each Page's (`/{page-id}/subscribed_apps`,
set at connect). The admin console's *Meta webhooks* page (`/api/admin/webhooks`,
super admin + secret key to change) shows the app-level list and re-subscribes with
the required fields (`messages, messaging_postbacks, message_echoes, feed`) when one
is missing — server-side, the app secret and verify token never reach the browser.
The same page covers **WhatsApp** (`whatsapp_business_account`: `messages,
smb_message_echoes` — a reply the owner types in the WhatsApp Business app on their
own phone arrives as a coexistence `smb_message_echoes` webhook; `parseWhatsAppEvent`
returns it flagged `echo`, customer = `to`, and `handleIncoming` stores it as the
business's turn exactly like a Messenger echo; `history` and `smb_app_state_sync` stay
ignored) and **Instagram** (`instagram`: `messages, comments` on the Instagram app —
Instagram has no echo field; the account's own outgoing messages, including hand-typed
replies, ride `messages` with `is_echo`). When the owner switches the bot
back ON for a conversation (`/api/contacts` PUT), if the last message is still an
unanswered customer message the bot answers it then (`processConversation`, gated by the
same `botAllowed` checks).

Business owner (browser)
        │
        ▼
/dashboard → src/app/dashboard-client.js
        │  fetch with Supabase JWT
        ▼
/api/*  → requireClient() → service-role Supabase client
```

---

## 3. Directory map

```
src/
├── app/
│   ├── page.js                 Public landing page (server-rendered)
│   ├── pricing/                Public pricing page
│   ├── privacy/ terms/ contact/ google-calendar/
│   ├── docs/                   The public manual (content in src/lib/docs/)
│   ├── shots/                  Screenshot studio, dev-only (404 elsewhere)
│   ├── dashboard/              Route wrapper + components/ (one file per tab)
│   ├── dashboard-client.js     The dashboard SHELL: auth, onboarding, routing
│   ├── admin/                  Admin console (separate RBAC)
│   ├── reset/                  Password reset
│   └── api/                    All backend routes (see §4)
├── lib/
│   ├── bot.js                  Message pipeline + locked prompts
│   ├── products.js             Product shape, vision, gallery, embedding
│   ├── inventory-actions.js    What the assistant may change about a product
│   ├── assistant-actions.js    What it may change about the bot (offers, training)
│   ├── readiness.js            Name + price + photo: the rule for "can be sold"
│   ├── duplicates.js           Refuse the same product twice (code > name > photo)
│   ├── variants.js             Option axes and their combinations
│   ├── docs/                   The public manual's copy (en.js / bn.js / index.js)
│   ├── gemini.js               All AI calls
│   ├── messenger.js            Outbound Graph API sends
│   ├── knowledge.js            Document parsing, chunking, RAG
│   ├── gcal.js                 Google Calendar OAuth + events
│   ├── auth.js                 requireClient(), plan checks
│   ├── plans.js                Plan catalogue (single source of truth)
│   ├── widget.js               Widget key + allowed-domain rules
│   ├── broadcast.js            Who may receive a broadcast, and why not
│   ├── broadcast-send.js       Claim-before-send batching, real platform errors
│   ├── case-studies.js         Landing-page case studies (placeholder-guarded)
│   ├── sslcommerz.js           Payment gateway init + validation
│   ├── email.js                Resend notifications
│   └── supabase.js             Service-role client
├── utils/supabase/             Browser + middleware clients
└── middleware.js               Session refresh only, no redirects
```

`dashboard-client.js` is intentionally one large file. It is a single-page app with
shared theme constants and helper components (`Card`, `Btn`, `Inp`, `Badge`); splitting
it would add import churn without changing the bundle.

---

## 4. API surface

**Client-facing** (all require a Supabase JWT, scoped by `requireClient`):
`me`, `profile`, `profile-logo`, `settings`, `products`, `add-product`,
`import-products` (WooCommerce **and** Shopify, chosen by `platform`),
`import-one`, `import-url`, `orders`, `conversations` (the chat LIST — a recent
window across the account), `conversations/messages` (the FULL history of one
chat, loaded when it is opened, so a long thread keeps every message),
`contacts`, `channels`, `knowledge`, `bookings`, `analytics`, `billing`,
`generate-prompt`, `send-message`, `send-media`.

**The AI Assistant** (same JWT, same scoping): `inventory-chat` (answers and
proposes), `inventory-apply` (carries out what was confirmed),
`product-interview` (one question at a time), `photo-draft` (reads photos before
anything is saved), `photo-group` (which pictures are the same product).

**Channel webhooks** (no JWT — verified by Meta signature/token):
`messenger` (direct messages **and** Facebook Page comments via the `feed` field),
`whatsapp`, `telegram`.

**OAuth flows**: `fb/login`, `fb/callback`, `fb/select`, `fb/data-deletion`,
`ig/login`, `ig/callback`, `ig/select`, `gcal/login`, `gcal/callback`, `gcal/status`.

**Admin** (separate role check against `admin_users`): `admin`, `admin/client-detail`.

**Utility**: `auth`.

**Web push** (owner's phone/browser alerts, live in production): `push/subscribe`
(save/remove a device subscription), `push/test` (send a test to the caller's own
devices — kept for diagnosis, no longer surfaced in the dashboard: the Profile card is
one "Notifications" row with an on/off switch, owner's rule 2026-09-11). `src/lib/push.js` sends via VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` +
`VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`) to every subscription in `push_subscriptions`;
`public/sw.js` shows the notification and, on tap, opens the tab it is for. A push
fires for a new order, a new booking and a conversation-start/handover — all
fire-and-forget, so a failed push never breaks the thing that triggered it. The
notification's `url` carries the target tab as a hash (`/dashboard#orders`,
`/dashboard#conversations`); the service worker changes the hash **and** posts the
tab to the running app, because an already-open dashboard ignores a hash-only
change on its own.

**Product photos go up one at a time.** Vercel refuses any request over ~4.5 MB
at the edge, before our code runs — so a 12-photo product saved in one request
died, and the dashboard could only say "check your internet" (fetch got no
response at all). Now every save path (the AI Assistant, the Inventory editor,
the many-from-photos batch) uploads photos 2..N through `product-photo` (one
file → its public URL, stored by `uploadProductImage` at `<clientId>/<file>` so
the delete-cleanup guard recognises it) and sends `add-product` / `products`
PATCH the URLs, which they already accepted. The FIRST photo still travels as
bytes: the server's photo-based duplicate check hashes those bytes and must keep
working. `src/app/dashboard/components/photo-upload.js` holds the shared uploader
(each photo remembers its URL, so a retry after a dropped connection sends only
the missing ones) and `PHOTO_MAX_BYTES`; a photo over that could not be shrunk in
the browser, and the screens now refuse to save, say so, and offer "Shrink
photos" (the 640px rung) — instead of firing a request the platform is certain
to reject. `shrink-image.js` also falls back to `toDataURL` where an Android
WebView's `toBlob` returns null.

**The notification feed** (`notifications`, GET): everything worth the owner's
attention, assembled in one place on the server and scoped by `client_id` —
customers waiting for a person (`contacts.needs_human`), recent public comments
(`comments`, the ones the bot could not answer marked urgent), orders, bookings,
and system alerts (plan lapsed/expiring, own AI key failing, message limit
near/hit, a channel whose token expired, a payment decision). Messages waiting
for a reply are not in it — the shell already holds live conversations (10 s)
and the bell merges them. The shell polls it every 30 s. Each item is
`{ key, type, level, icon, title, body, time, target, id }`; keys AND times are
stable while a fact holds (an expiry date, the start of the metering window),
never "now", so a poll cannot make a read alert look new. The bell
(`NotificationsBell.js`) groups items into *Needs you / Customers / Business*,
keeps Facebook-style read state per device (a watermark moved by "Mark all as
read" + the keys tapped since + when each key was first seen, so a brand-new
alert with an old fact-time is still unread), and opens the exact item.

**Inbox read state (Messenger's rule).** A conversation is *unread* when its newest
customer message is newer than the last time this device opened it and newer than the
last "Mark all as read" — a bot or dashboard reply does not make it read
(`src/lib/convo-read.js`, pure; `dashboard/components/convo-read.js` is the
localStorage store `gv-convo-seen` / `gv-convo-seen-all` + `useConvoRead()`, with one
window event so every reader re-renders). Unread rows are bold with a dot in the inbox
list; the sidebar Inbox badge counts the same set; opening a chat marks it seen up to its
newest customer message (again when a new one lands while it is open); the bell's "Mark
all as read" also clears the inbox.

**Deep links — `#tab:id`.** A navigation target is `tab` or `tab:id`:
`#conversations:<sender_id>` opens that customer's chat, `#orders:<id or code>`
opens that order. Push payloads, the bell (`onNavigate(tab, id)`), the service
worker's `gv-navigate`, the native app's notification tap (`al-goto`) and a
cold-start hash all speak this form; the shell (`splitSpec`, `goTo`, `focus`)
sets the tab and hands `focus={tab,id,ts}` to `Conversations` / `Orders`, which
select the item as soon as their list holds it. The address keeps only the tab.

**Hand-off — "this customer needs a person".** The bot was always told to
promise a team member and nothing recorded it. Now `src/lib/handoff.js` (pure,
tested): the model ends a hand-off reply with `[[HANDOFF]]` (FIXED_BASE rule 11;
`extractHandoff` strips it before the customer sees anything), and `wantsHuman`
reads the customer's own words (EN/BN/Banglish: human, manager, owner, call me…).
`composeReply` returns `handoff`; `processConversation` and the widget route
call `flagNeedsHuman`, which flips `contacts.needs_human` ONCE (atomic update on
`needs_human=false`) and then pushes + emails the owner. Cleared when the owner
replies (`send-message`) or flips the bot switch for that customer (`contacts`).

**Owner emails for business events** (`email.js`): `notifyNewOrder`,
`notifyNewBooking` (money — one email each, no throttle), `notifyNeedsHuman`
(once per hand-off), `notifyChannelExpired`. `emailOwner()` in bot.js looks the
address up and imports the module lazily. Push now also fires for the bot going
quiet for a billing reason (same once-a-day gate as the email) and for an own
AI key failing (same once-per-outage flip), and for website-widget
conversations, which used to produce no push at all.

**Channel token check** (`cron/channels`, daily 04:30 UTC, `vercel.json`):
Facebook Page tokens only, and only Graph's own error code 190 counts — flips
`channels.status` to `"expired"` atomically, pushes + emails once. The Channels
tab shows an expired row in red with a Reconnect button; the normal connect
flow upserts a fresh token and `"connected"`. Instagram/WhatsApp tokens are not
probed yet (different hosts; a wrong verdict would be worse than none).

**Native push** (the installed Capacitor app, whose WebView cannot do Web Push):
`push/register-native` saves/removes an FCM device token in a separate table,
`fcm_tokens` (its own table because an FCM token has none of Web Push's
p256dh/auth). `src/lib/fcm.js` sends through the FCM HTTP v1 API, authorised by a
Firebase service account in one env var, `FIREBASE_SERVICE_ACCOUNT` (missing →
`fcmEnabled()` false and every send is a quiet no-op); it mirrors the web
payload, prunes a token FCM reports UNREGISTERED, and never throws. **`notify()`
in `push.js` is the single call the bot makes** — it fans out to BOTH Web Push
and FCM in parallel, so the three triggers (order, booking, message) and the test
route reach every device an owner has, browser or app, through one call. On the
web side `src/app/dashboard/components/native-push.js` uses the Capacitor
PushNotifications plugin (injected into the remote page inside the app) to ask
permission, register the token, and follow a tapped notification to its tab;
`PushToggle` branches to it when `isNativeApp()`. Firebase config for the app
lives in `mobile/google-services.json` (not a secret — it ships in every APK).
A device's FCM token belongs to whoever registered it last (`unique(token)`
upsert), so it must be re-bound on every account change: `rebindNativePush(clientId)`
runs at the end of `loadMe` after each sign-in (permission checked, never
requested — a silent device stays silent), re-registering the token onto the
current account; `unbindNativePush()` runs on logout (both the menu button and
the back-out-of-signup path), deleting the token so the account just left stops
pushing to this phone. The token is mirrored to `localStorage` (`gv_fcm_token`)
so logout can still un-register it after a reload. Without this, logging into a
second account on a phone left the token tied to the first, and that first
account kept receiving this phone's notifications.

**Installable app (PWA).** TellMore AI is a Progressive Web App: on a phone it can
be installed to the home screen and opens full-screen, like a native app, and the
*same* web app is packaged into a Play Store / App Store build with no separate
mobile codebase. Three pieces make that work:

- `src/app/manifest.js` — the Web App Manifest (name, icons, `display: standalone`,
  brand colours), served by Next at `/manifest.webmanifest`. `start_url` is
  `/dashboard`, so an installed app opens straight into the owner's dashboard.
- `public/sw.js` — besides push, it has a no-op `fetch` handler. That handler is
  what makes the app *installable* (a browser offers "Add to Home Screen" only for
  a site with a service worker that handles fetch). It deliberately never caches:
  a logged-in dashboard must always be served fresh, or one owner could see
  another's cached data.
- `src/app/layout.js` — registers the service worker for **every** visitor (not
  only those who turn on push) and sets `appleWebApp` so iOS opens the icon
  full-screen. The apple-touch icon comes from `src/app/apple-icon.js`.

Two shell behaviours matter once it runs as a full-screen app:

- **Full-bleed screens.** On a phone the open inbox chat and the AI Assistant
  fill the display edge-to-edge — the shell header and page padding are dropped
  and each screen carries its own header (with a menu button back to the
  sidebar). Every bottom-anchored composer adds `env(safe-area-inset-bottom)` so
  it clears the phone's navigation bar, whether that is three buttons or a
  gesture pill. `fullBleed` in `dashboard-client.js` gates all of this.
- **The app has its own login.** A Trusted Web Activity shares the origin's
  cookies with the phone's Chrome, so someone signed in there would otherwise
  land in the dashboard without ever signing into the app. In app mode
  (`display-mode: standalone`, iOS `navigator.standalone`, or an `android-app://`
  referrer) the shared session is ignored until the owner signs in from inside
  the app once — marked by `gv_app_signed_in` in localStorage, set on sign-in
  and cleared on log out. A plain browser tab is unaffected.
- **A reload stays put.** The active tab lives in the URL as `#tab`; on mount
  the shell reads it back, so pull-to-refresh (or the app reopening) returns to
  the same tab instead of Home. The mount `replaceState` keeps the fragment —
  passing `""` there would strip it and send every reload to Analytics.

Store packaging is done with **PWABuilder** (pwabuilder.com): point it at
`https://www.tellmoreai.com`, it reads this manifest and produces a signed Android
`.apk`/`.aab` (a Trusted Web Activity wrapping the live site) and an iOS package —
no Android Studio or Mac build tooling on the developer's machine. (The Android
TWA this produced is retired — the app is now the Capacitor shell in `mobile/` —
so its Digital Asset Links file was removed with the move to tellmoreai.com.)

---

## 5. Two bot modes

`clients.business_type` decides everything downstream:

| | `ecommerce` | `agency` |
|---|---|---|
| Knowledge source | `products` (vector) | `knowledge_base` (vector) |
| Locked rules | `FIXED_BASE + FIXED_ECOM` | `FIXED_BASE + FIXED_AGENCY` |
| Conversion | Orders | Bookings + Google Meet |
| Dashboard tabs | Inventory, Orders | Knowledge Base, Bookings |

---

## 6. Multi-tenancy

Every tenant-owned table carries `client_id`. Isolation is enforced in the API layer:
`requireClient()` resolves the JWT to exactly one client row, and every query filters
on that id. RLS is enabled on all tables as a second line of defence — see
[security.md](./security.md).

An incoming webhook has no JWT, so the tenant is resolved from the channel:
`channels.page_id` (or WhatsApp phone number id) → `client_id`.

---

## 7. Deployment

Push to `main` on `Afzalnahid/autologic-chatbot` → Vercel builds and deploys to
production. There is no staging environment; changes are validated locally with
`npm run build` before pushing.

Environment variables are listed in [security.md §2](./security.md).

### Scheduled work

One cron job, declared in `vercel.json`:

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/expiry` | `0 4 * * *` (10:00 Dhaka) | Emails every owner whose trial or plan ends within 3 days. |

Two reminders go out per plan period, not one: the first on entering the last
three days, the second on the final day. One warning followed by three days of
silence and then a dead bot was a poor way to treat someone who simply had a
busy week, and the last day is when a renewal actually gets done. Which
reminders have been sent is tracked by `clients.expiry_warn_stage` against the
date in `expiry_warned_at` — see [database.md](./database.md).

Everything else that looks like a background job is triggered by a request
instead — broadcasts continue in batches as the dashboard calls back, follow-ups
run when the dashboard is opened, and the metering is written inline with each
AI call. This is the only clock in the system.

`/api/cron/expiry` should be protected by a `CRON_SECRET` environment variable
on the Vercel project: Vercel sends it as `Authorization: Bearer $CRON_SECRET`
and the route rejects anything else. **If the variable is not set the endpoint is
open** — deliberately, because a cron that 401s until someone remembers a second
setup step is a cron that silently never runs, which is the exact failure this
job exists to fix. It is safe to call twice: `warnIfExpiringSoon` records the
expiry date it warned about, so a repeat run sends nothing.

The warning also fires when an owner opens their dashboard (`/api/me`). That
used to be the ONLY trigger, which meant an owner whose bot was quietly working
— and who therefore had no reason to log in — got no warning at all before it
stopped. It is now a safety net for a missed cron run, not the mechanism.

## Message limits — which box actually applies

The admin panel shows five message boxes side by side, and they do not all
apply at once. Two rules decide which number a customer really meets, both
enforced in `botAllowed()` (`src/lib/bot.js`):

**A plan is metered either by the day or by the month, never both.**
`messageAllowance()` gives a trial `period: "day"` and reads only
`messages_per_day`; every paid package gets `period: "month"` and reads only
`messages_per_month`. The other box is dead — a number typed into it changes
nothing.

**The per-channel cap is a separate, later check.** So a small figure there
quietly becomes the real ceiling (`messages_per_channel × channels`) however
large the headline says. It counts only customer messages carrying that
channel's `page_id`, so one busy Page cannot eat another's allowance, and
hitting it stops that channel alone — the client's other channels keep working
and they are emailed once a day at most.

The precedence for the cap is `channels.msg_limit_monthly` (the **Set cap**
button, one channel) → the client's `limit_overrides` (their every channel) →
the package → unlimited.

### The window a "per month" allowance is counted over

`quotaWindowStart(client)` (`src/lib/plan-limits.js`) answers this once for
every windowed limit — the per-channel cap and website scrapes both read it. A
calendar month for a package sold by the month; **the trial itself for a
trial**. A three-day trial that straddled a month end used to have its whole
allowance reset on the 1st, so the same trial was worth twice as much depending
on the day it began.

### How long a trial runs

The owner sets it in the panel, on the Free Trial package itself — **Packages →
Free Trial → Edit → "How long the trial runs (days)"**. `trialDays()`
(`src/lib/plan-limits.js`) reads it and `start_trial` in `/api/me` uses it.

It is stored as `trial_days` in the `billing` row of `app_settings`, beside the
exchange rate, **not** as a column on the `plans` table. There is exactly one
trial package, and a key in a JSONB column that already exists needs no
migration run before the box does anything. The panel therefore saves it with
`save_settings` before `save_plan` — two stores, so two writes, the length first
so a failure leaves the package alone.

`clampTrialDays()` in `src/lib/plans.js` bounds it to 1–90 and is applied in the
panel *and* the route. Unset is checked before the arithmetic, because
`Number(null)` and `Number("")` are both `0`, which would clamp a cleared box to
a one-day trial instead of returning it to the `TRIAL_DAYS` default. Every
failure to read — missing row, unreadable table, a value typed as "soon" —
falls back to `TRIAL_DAYS`: a trial that cannot work out its own length must
still start. Changing the length only affects trials started afterwards; anyone
already on one keeps the `trial_end` they were given.

The length flows into every trial label, so the wording follows it rather than
repeating it. `trialTextMismatch()` also checks the owner's own prose — the
tagline and the pricing bullets — for a "N day" that no longer matches, because
changing the box does not change what a customer reads on the pricing page.

### The own-key (BYOK) price list

A client who brings their own AI key covers their own AI cost, so every paid
package carries a second, lower price for them: `byok_monthly` / `byok_yearly`
on the `plans` table (and `byokMonthly` / `byokYearly` on the code constant in
`src/lib/plans.js`). A package with neither has no own-key discount, so a BYOK
client simply pays the standard price — the trial and any custom package are
safe by default.

**One function decides the amount.** `priceForClient(plan, cycle, ownKey)` in
`src/lib/plans.js` returns the BYOK price when the client has a key *and* the
package sets one (`> 0`), and the standard price otherwise — it never hands the
lower price to a client without a key, and never returns `0` for a package that
left BYOK blank. Both the screen and the charge call it, so they cannot
disagree. `planPrices(plan, cycle)` behind it reads both the camelCase constant
and the snake_case table row.

**"Has their own key" is the same test the bot routes on.**
`clientHasOwnKey(clientId)` (`src/lib/ai.js`) mirrors `getClientAI`'s own check
— a saved Google key in `client_ai` (`api_key_enc` set, `provider = "google"`)
— without decrypting it. A key that is currently *failing* still counts: they
are a BYOK client whose key needs fixing, not a platform-key client, so their
price must not jump back up. It fails closed (standard price) on any error.

`/api/billing` GET returns `own_key`, so the dashboard Billing tab shows the
reduced prices (standard struck through) with a short "you're on your own key"
note. Both purchase paths — manual (`POST /api/billing`) and online
(`/api/billing/checkout`) — price the payment request with `priceForClient` from
the live key status, server-side, so the amount cannot be forged. The public
pricing page has no client to check, so it keeps the standard price as the
headline and shows the own-key figure as an informational line. The owner edits
the two prices per package in **Packages → Edit → "Own-key price (BYOK)"**.
Initial prices were seeded by `docs/sql/2026-09-10-byok-prices.sql`.

### What a plan includes, and how much is left (entitlements)

"Which client is on which package, which features that package has, and how much
of each allowance is used" is answered by **one shared assembler** so the admin
and the client can never see different numbers for the same account.

- **`src/lib/features.js`** (no imports, so any bundle can use it) holds
  `FEATURE_DEFS` — the one labelled list of the capability switches (vision,
  voice, kb, calendar, comments, widget, broadcast, followup, byok), each tagged
  with the business type it applies to — plus two pure helpers: `featureList(features, biz, {ownKey})`
  (the capabilities relevant to a business type, each on/off; unknown defaults on,
  like `can()`; `byok` is the one per-client override — a client actually running
  on their own key shows "Use your own AI key" ON even when their package's byok
  flag is off, since the super admin can grant a key on any tier) and
  `shapeMeter(key, label, used, limit)` (null limit = unlimited, null used = "—" never 0).
- **`src/lib/entitlements.js`** adds the usage half: `usageMeters(client, limits)`
  runs one cheap count per meter in parallel (messages, products *or* documents by
  business type, channels, broadcasts, website imports), each failing soft to null,
  and `entitlementsFor(client)` returns `{ planId, planName, period, features, meters }`.
  Fine for ONE client; never called per row of the admin list.

Where it surfaces:
- **Admin client list** (`admin-client.js` `ClientTable` + `FeatureChips`) shows each
  client's package and its features as icon chips, read from the catalogue `/api/admin`
  now returns (each plan's `features` map) — no per-client query, so the list stays cheap.
- **Admin client drawer** (`client-detail` `subscriptionOf` → the `Subscription` card)
  shows the features list plus used/remaining meters for all six allowances.
- **Client dashboard** — `/api/billing` returns `entitlements`, and the Profile tab's
  "Your package" card renders the meters (with "N left") and the capability features.

Feature on/off ticks are drawn neutral, never mint — mint means "a bot is live" and
nothing else. Usage bars follow the app's existing green→amber→red convention.

### Channels allowed, and broadcasts

Both were set in the panel, saved, returned by `limitsFor()` — and read by
nothing, until 2026-08-30. A trial limited to one channel could connect five.

`checkChannelQuota(clientOrId, platform, pageId)` is called by every route that
creates a channel: `/api/channels` and the four OAuth callbacks (`fb/select`,
`ig/select`, `wa/select`, `wa/finish`). Those callbacks hold only the client id
they signed into the state parameter, which is why it takes a row *or* an id.
It is checked before any Meta call, so a refusal costs nothing.

Two decisions inside it:

- **The website widget does not use a channel slot.** The allowance is about
  Facebook Pages, Instagram accounts and WhatsApp numbers — what the packages
  describe. The widget has its own switch under "What is included", and letting
  it consume a slot would charge a client twice for something already on.
- **Reconnecting is never refused.** The row is upserted on
  `(client_id, platform, page_id)` so it adds nothing to the count, and a client
  at their limit must still be able to repair a channel whose token expired.

`checkBroadcastQuota(client)` is called from `createBroadcast()`, the only place
a broadcast is created, and counted over `quotaWindowStart` like every other
windowed limit. The preview carries `broadcast_limit` / `broadcasts_used` so the
Broadcast tab says how many are left *before* the message is written.

**`limitsFor()` now returns `channels: null` when the box is empty**, not `1`.
The panel says "Empty means unlimited" over these boxes and every other limit
reads `?? null`. While nothing enforced this figure the two could disagree
harmlessly; enforcing it made an empty box mean "one channel" on a screen
promising no limit.

### Saying it where the number is typed

None of this was visible where the numbers are typed, and a Free Trial package
was found in production selling "30 a day" while a per-channel cap of 10 ended
the trial at ten messages. `src/lib/limit-conflicts.js` holds the descriptions:
`limitMeaning()` gives each box the label and note for its package — a trial has
no months, so its boxes read "/ trial" — `trialTotal()` gives the figure the
boxes never showed (`3 days × 30 a day = 90`), and `limitConflicts()` covers
what a single label cannot, the arithmetic across two boxes.

It only describes. Enforcement stays in `botAllowed()` and the quota gates, and
the day/month test is the same one `messageAllowance()` makes, so the panel and
the bot cannot drift apart. It is a note, not a block: the owner may mean an odd
combination, so nothing refuses to save.

## Broadcast rules

A broadcast may only reach someone whose last inbound message is within Meta's
24-hour standard messaging window. Outside it, only non-promotional tagged
messages are permitted and misuse risks the Page, so this build simply never
sends there — people outside the window appear in the preview with the reason,
and are not sent to.

The website channel cannot be broadcast to at all: once the visitor closes the
tab there is no address to send to.

Sending is done in batches of 20 per request. Each recipient row is claimed
(`pending` → `sending`) before the send, so two overlapping requests cannot
double-send, and the dashboard calls back until the broadcast is finished. No
cron is involved.

## Dashboard structure

`src/app/dashboard-client.js` holds only the shell: `AuthGate`, `Onboarding`,
`ConnectChannel`, `ConnectCalendar` and the `Dashboard` component that owns the
shared state and routes between tabs.

Every tab lives in `src/app/dashboard/components/`:
`InventoryAssistant` (the AI Assistant tab), `Analytics`, `Billing`, `Bookings`,
`Broadcast`, `Channels`, `Comments`, `Conversations`, `Inventory`,
`KnowledgeBase`, `Orders`, `Profile`, `Settings`, `WebsiteWidget`.

The **AI Assistant** is a plain conversation — no menu of buttons. The owner just
says what they want and `/api/inventory-chat` understands it: it answers, asks
back when unsure, and PROPOSES changes (products, offers, bargaining, notes,
training, identity) as cards the owner confirms; `/api/inventory-apply` carries
them out. Anything that needs a surface text can't fill — attaching a photo,
reading a file, connecting a shop, setting a picture — the model asks for by
setting a `ui` value in its reply (`add_photo`, `import:photos|csv|url|woo|shopify`,
`overview`); the panel opens that screen (the guided add interview, `PhotoBatch`,
`ImportSheet` from `Inventory.js`, or `CategoryOverviewSheet` from
`CollectionOverview.js`) as an OVERLAY on the assistant, never by switching tabs.
So "add a power bank", "set a 10% Eid offer", "teach the bot we deliver free over
2000", "set the power bank overview image" all just work by saying them. Only an
explicit "take me to X" navigates. The Inventory, Offers and Bot Training tabs are
where those changes are then viewed and hand-edited.

**It has an agency twin.** A service business has no catalogue — its bot answers
from the **knowledge documents** it uploads plus the Bot Training answers — so for
`business_type === "agency"` the route swaps the catalogue for the knowledge-base
documents (`file_registry`) and uses `agencyPrompt`: the same offers / notes /
training / identity / follow-up settings (which already feed the agency bot's
prompt through `businessFacts` in `bot.js`), but no products, and its one `ui`
token is `import:docs`. In `InventoryAssistant`, an agency's 📎 attach uploads a
PDF/Word/text file straight to `/api/knowledge` (reported in the chat), the example
prompts are about teaching and training rather than adding stock, and the guided
photo interview is never used. So a service owner runs the whole thing by chat too
— "set our services and pricing", "add our rate card" (attaches the document),
"set the bot's tone to friendly".

Four modules are shared by all of them:
- `session.js` — the supabase client, the auth token and the `api()` fetch helper.
  The token is written through `setAuthToken()` because an exported `let` cannot be
  assigned from another module.
- `ui.js` — design tokens `T`, the `Card` / `Btn` / `Inp` / `Badge` primitives,
  `useIsMobile`, the stat and chart building blocks, the plan catalogue and the
  money and date formatters. **This is the single source of truth for the design
  system**; tabs must not redefine colours locally.
- `i18n.js` — every visible string, in English and Bangla, behind `useT()`. A
  string hardcoded in a component is a string the language switch cannot reach.
- `back.js` — the back-button stack. Anything that opens ON TOP of a page
  (a drawer, a sheet, a confirmation) calls `useBackClose(open, close)`, and the
  shell asks the stack before it moves the page. The last thing to open is the
  first to be asked.

**History.** Every tab visited is one `pushState` entry, so the phone's back
button retraces the pages the owner actually saw. Overlays are not entries: they
are handled by the stack above, which is why one press closes a drawer and the
next leaves the tab.

## The AI Assistant tab

One place from which the whole dashboard is driven by conversation, and the only
AI surface in the app — Inventory and Bot Training are hand-driven forms.

It opens on three jobs, in order: **teach the bot → add products → set up an
offer**, ticked as each is done. Everything it changes goes through the same
propose-then-confirm contract:

| Piece | Where | What it holds |
|---|---|---|
| `src/lib/inventory-actions.js` | shared | What may be changed about a PRODUCT, the ask order, `draftGaps` |
| `src/lib/assistant-actions.js` | shared | What may be changed about the BOT — offers, bargaining, notes, the profile answers, identity, follow-ups — and `applySettingActions`, which is pure |
| `/api/inventory-chat` | server | Reads the catalogue AND `app_settings`, and returns words plus proposals. Never writes |
| `/api/inventory-apply` | server | Carries out only what the owner confirmed. The model never reaches it |
| `/api/product-interview` | server | One question at a time for a single product. The draft travels with every turn and is re-cleaned on arrival |

Two things are deliberately out of reach: choosing which products an offer covers
(that is picking real catalogue rows, and a model naming them from memory attaches
the offer to the wrong one), and sending anything to a customer.

The route names still say "inventory" and now do more than that; renaming a live
route is a separate job from making it work.

## Follow-ups

A follow-up goes to someone who showed interest and never converted, once, and only
while Meta's window is still open. Because the window closes 24 hours after the
customer's last message, the delay is capped at 23 hours — a literal "24 hour"
follow-up could never be delivered.

Eligibility is deterministic: the conversation must carry an intent tag from Task 7
(ecommerce: Product Inquiry or Order · agency: Service Inquiry or Booking), have no
matching order or booking, no follow-up in the last 30 days, no contact pause, no
opt-out, and a live channel. No tag means no evidence of interest, and nothing is
sent.

Evaluation is lazy: `runFollowups` is called from `GET /api/conversations`, claims
its run by stamping `last_run_at` before doing any work, and does nothing if it ran
within the last 15 minutes. No cron is involved.
