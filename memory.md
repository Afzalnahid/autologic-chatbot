# Autologic — Working Memory

Update the top two sections after every session.

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

- **Booking pipeline** is instrumented but untested end to end. `gcal_connected` is true and a
  refresh token exists, but `gcal_token_expiry` was stale. Unverified Google apps get 7-day
  refresh tokens, so it may simply be dead — `getValidAccessToken` now detects `invalid_grant`,
  clears `gcal_connected` and logs it. Reconnect Calendar, book a meeting, read the
  `[booking]` log lines to see which step fails.
- **Google Cloud billing** — Gemini is 429ing. Comment replies are landing on the fallback
  rather than real AI output. Fix before recording if the videos should show the bot at its best.
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
