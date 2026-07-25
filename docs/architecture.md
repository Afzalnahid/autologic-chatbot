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
