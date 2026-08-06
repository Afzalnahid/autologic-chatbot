# Architecture

Autologic is a multi-tenant SaaS AI chatbot platform. One deployment serves every
business ("client"); all data is separated by `client_id`.

Live: https://autologic-chatbot.vercel.app

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
│   ├── dashboard/              Route wrapper
│   ├── dashboard-client.js     The entire client dashboard (single file)
│   ├── admin/                  Admin console (separate RBAC)
│   ├── reset/                  Password reset
│   └── api/                    All backend routes (see §4)
├── lib/
│   ├── bot.js                  Message pipeline + locked prompts
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
`import-products`, `import-one`, `import-url`, `orders`, `conversations`,
`contacts`, `channels`, `knowledge`, `bookings`, `analytics`, `billing`,
`generate-prompt`, `demo-chat`, `send-message`, `send-media`.

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
`Analytics`, `Billing`, `Bookings`, `Broadcast`, `Channels`, `Comments`,
`Conversations`, `Demo`, `Inventory`, `KnowledgeBase`, `Orders`, `Profile`,
`Settings`, `WebsiteWidget`.

Two modules are shared by all of them:
- `session.js` — the supabase client, the auth token and the `api()` fetch helper.
  The token is written through `setAuthToken()` because an exported `let` cannot be
  assigned from another module.
- `ui.js` — design tokens `T`, the `Card` / `Btn` / `Inp` / `Badge` primitives,
  `useIsMobile`, the stat and chart building blocks, the plan catalogue and the
  money and date formatters. **This is the single source of truth for the design
  system**; tabs must not redefine colours locally.
