# Autologic — Working Memory

Update the top two sections after every session.

---

## Last session (2026-08-20, second thread) — Channel exclusivity, multi-account, tab redesigns

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

### What's next — resume exactly here

1. **Google Cloud billing** — the single biggest blocker (free tier is 20
   req per model per day; the bot dies after ~10 messages/day per tenant).
   Enable billing on the Gemini API project in Google Cloud Console → then
   confirm from Vercel runtime logs that 429s stop appearing. No code
   change needed to turn it on; may want to raise the model chain once real
   quota exists.
2. **BYOK gap found, deliberately not fixed yet:** `import-url`'s
   `extractProductsFromUrl` (the biggest AI call, 15k HTML chars) and
   `tags.js`'s `chatWithGemini` fallback still run on the PLATFORM key for
   BYOK clients — breaks hard cost separation. Fix in its own commit.
3. WhatsApp Embedded Signup can now actually SAVE (lesson 25 fix) — worth a
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
