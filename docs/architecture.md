# Architecture

Autologic is a multi-tenant SaaS AI chatbot platform. One deployment serves every
business ("client"); all data is separated by `client_id`.

Live: https://www.getvoicium.com

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
`import-one`, `import-url`, `orders`, `conversations`,
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

**Utility**: `auth`, `push` (unused in production).

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

`TRIAL_DAYS` in `src/lib/plans.js` is how long a trial runs. It was written as
`3 * 24 * 3600 * 1000` inside the `start_trial` handler and nowhere else, which
is why nothing could say what "per month" meant on a three-day plan. Changing it
still needs a deploy — it is not a package field.

### Limits that are defined but enforced by nothing

`channels` and `max_broadcasts_per_month` are set in the panel, saved, and
returned by `limitsFor()` — and no route reads either. Connecting a channel
checks no allowance, and nothing counts broadcasts against a package. The panel
says so under each box rather than showing a number that looks enforced.

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
