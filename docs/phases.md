# Phases

Development history and roadmap. Updated as work lands.

---

## Phase 1 — From workflow to product ✅

The platform began as n8n workflows serving a single jewelry shop (Evalora). This
phase rewrote it as a real multi-tenant application.

- Message pipeline moved from n8n into `src/lib/bot.js`
- Multi-tenant model: every table keyed by `client_id`, channels resolved by page id
- Supabase Auth signup/signin, onboarding, dashboard
- Facebook one-click page connect (OAuth → page select → webhook subscribe)
- Product inventory: manual upload, single URL scrape, WooCommerce bulk import
- Gemini vision analysis at import so photos become searchable text
- Realtime conversation inbox

## Phase 2 — Two business types ✅

- `business_type` splits the product into `ecommerce` and `agency` throughout
- Knowledge Base: PDF/DOCX/TXT upload, chunking, embedding, RAG retrieval
- Google Calendar OAuth, availability check, event creation with Meet links
- Bookings table and dashboard tab
- Instagram and WhatsApp channels alongside Facebook
- Per-channel and per-contact pause for human handoff

## Phase 3 — Operations ✅

- Admin console with RBAC (`super` / `full` / `editor` / `viewer` / `pending`)
- Client detail view, trial extension, suspend, delete
- Email notifications via Resend (admin signup, approval)
- Auto-refresh and strict no-store caching across admin surfaces
- Accessibility and contrast fixes, silent polling to cut request volume

## Phase 4 — Security hardening ✅

- Removed every hardcoded secret and every secret fallback from the codebase
- Rotated the exposed Facebook App Secret
- Webhook verify token moved to environment only
- Storage bucket cleanup on file delete
- RLS enabled on all tables as defence in depth

Detail: [security.md](./security.md)

## Phase 5 — Public presence ✅

- Server-rendered landing page (previously the site was a login wall)
- Privacy Policy, Terms, Google Calendar disclosure, Contact pages
- Google OAuth consent screen branding and verification submission
- Signup-first for new visitors, login-first for returning ones

## Phase 6 — Prompt system ✅

- Locked rules split into `FIXED_BASE` + `FIXED_ECOM` / `FIXED_AGENCY`
- Questionnaire-driven AI prompt generation, editable by the client
- Read-only display of locked rules in Settings for transparency
- Greeting and bot name wired into the live bot (they had been saved but ignored)

Detail: [prompts.md](./prompts.md)

## Phase 7 — Analytics ✅

- `/api/analytics`: conversation sessionization (6-hour gap), growth vs the previous
  period, revenue parsing, top products and services
- Dashboard: KPI cards with trend arrows, message volume chart, conversation health
  (bot-resolved / handoff / unanswered), customer mix, channel split, peak hours,
  top queries
- No chart library — hand-written SVG keeps the bundle at ~89 kB

## Phase 8 — Billing ✅

- Plan catalogue in `src/lib/plans.js`: Trial, Starter ৳1,500, Pro ৳3,500,
  Agency ৳6,000; yearly billed as ten months
- Public pricing page with comparison table and FAQ
- Dashboard Billing tab: plan status, usage bar, payment submission
- Manual bKash/Nagad/Rocket flow with transaction id
- Admin payment queue: approve extends the plan, reject notifies the client
- Per-plan message limits and expiry enforced in `botAllowed()`

## Phase 9 — Onboarding ✅

- Free-text business description became the primary input; nine fields collapsed
  into an optional section
- Example chips show what a good description looks like (not templates)
- Generated profile shown for review and editing before it goes live
- Merge-safe `PATCH /api/settings` so partial saves stop overwriting other settings

---

## Phase 10 — No more silent failures ✅

Previously, when a plan expired or a quota ran out, `botAllowed()` returned a bare
`false` and the bot went silent — the owner never knew, the customer got nothing,
and a paying opportunity was lost quietly.

- `botAllowed()` now returns a reason (`trial_expired`, `plan_expired`,
  `quota_daily`, `quota_monthly`, `no_plan`, plus silent pauses for
  channel/contact/suspension).
- Customers get one polite holding message per 12 hours instead of silence.
- Owners get an email (at most once a day) naming the reason with an upgrade link.
- Owners are warned by email when a trial or plan ends within 3 days — a lazy check
  on dashboard load, throttled by `expiry_warned_at`, so no cron is required.

New columns: `clients.bot_blocked_notified_at`, `clients.expiry_warned_at`,
`contacts.last_unavailable_at`.

---

## Phase 11 — Comment automation ✅

Facebook comments are a primary sales funnel in this market, and it was the top
feature competitors offered that we lacked.

- Connecting a Facebook page now subscribes to the `feed` field automatically, so
  comment automation is on by default — no extra setup.
- `parseCommentEvent()` picks new comments (`item:comment`, `verb:add`) out of the
  feed webhook, ignoring the page's own replies.
- `handleComment()` generates a short, plain-text AI reply from the same business
  profile and product/knowledge context, then posts a public reply under the comment
  and (optionally) a private reply that pulls the commenter into the inbox.
- Deduped via a `processed_comments` primary key; respects plan/quota and channel pause.
- Per-channel toggles in the dashboard: "Auto-reply to comments" and "Send to inbox".

New columns: `channels.comment_reply_enabled`, `channels.comment_dm_enabled`;
new table `processed_comments`.

Comments are stored in their own `comments` table rather than `message_buffer`,
so a public comment reply never appears inside a customer's direct-message thread.
The dashboard has a dedicated Comments tab showing each comment, the bot's reply,
whether the inbox message was delivered, and the exact Facebook error when it was not.

Note: private replies require `pages_messaging`, can only be sent once per comment,
and only within Facebook's 7-day window — so the error is surfaced to the owner
rather than swallowed.

## Phase 12 — Hardening pass ✅

An audit of the whole application produced a prioritised list; these were fixed in
order.

- **Cross-tenant hijacking (critical).** The `/select` routes and the Google
  Calendar callback trusted an unsigned `client_id` from a form POST, so a crafted
  request could attach a Page — or overwrite calendar tokens — on any tenant's
  account. All OAuth flows now carry an HMAC-signed, 30-minute state token,
  verified before any write. See [security.md](./security.md).
- **Rate limiting.** The five endpoints that call Gemini on every request are now
  capped per account.
- **Error handling.** Every API route is wrapped so an unexpected throw returns a
  clean message instead of a stack trace.
- **Dead code removed.** The Telegram stub (never implemented, no UI), an empty
  `push` route, an unused Telegram image helper, and an unused `sendTypingOff`.

## Roadmap

### Next
| Item | Why | Notes |
|---|---|---|
| Custom domain | `vercel.app` is blocked by some mobile carriers, cannot be verified in Search Console, and blocks Resend domain verification | One purchase unblocks three problems |

### Later
| Item | Why |
|---|---|
| White-label | Lets agencies resell the platform; turns customers into a sales channel |
| Resend domain verification | Client-facing emails currently do not reach external addresses |
| Google verification completion | Removes the test-user restriction on Calendar connect |
| Telegram channel | Two competitors offer it |
| Mobile/desktop app | PWA first; deferred |

---

## Known gaps

- **Email to external recipients** does not deliver until a domain is verified in
  Resend. Payment approval mails to clients are affected.
- **Google Calendar** works only for accounts added as OAuth test users until
  verification completes.
- **Gemini free tier** must have billing enabled or `generate-prompt` returns 429.
