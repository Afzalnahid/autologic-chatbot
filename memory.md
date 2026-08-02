# Autologic — Working Memory

Update the top two sections after every session.

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
