# Autologic — read this first

Multi-tenant SaaS chatbot platform for Bangladeshi businesses. Owner is **not a
programmer** and cannot debug or repair broken code. Explain in plain language, keep
every change small and reversible, and never report something as done without
verifying it.

## Language

**Always reply in Bangla**, unless I explicitly ask for English. This applies to
every explanation, summary, question and error report.

Keep in English regardless: code, file names, commit messages, commands I have to
type, and anything written into the repository (`memory.md`, `lessons.md`, `docs/`,
code comments).

Explain in plain language. I am not a programmer — no jargon without a plain-Bangla
explanation beside it.

## Read these before doing anything
1. `AGENTS.md` — how work is done here: the roles, the four stage gates, the rules.
2. `memory.md` — what happened last session, what is next, what is unverified.
3. `lessons.md` — mistakes already made. Do not repeat them.

Update `memory.md` at the end of every session, and add to `lessons.md` whenever
something goes wrong.

## Stack
Next.js 14 App Router · Supabase (project `cchvsgouqqxibhubioch`, pgvector) ·
Google Gemini (`gemini-embedding-001`, 768 dimensions) · Meta Graph API · Resend ·
Google Calendar · Vercel (`getvoicium.com`)

## Invariants — never break these
- Every database query filters `client_id` at the database with `.eq()`. Never filter
  in JavaScript afterwards.
- Locked prompts (`FIXED_BASE`, `FIXED_ECOM`, `FIXED_AGENCY`) are enforced on the
  server and stay there.
- Every feature answers for **both** `ecommerce` and `agency` business types.
- Crimson `#D92632` on soft white is the brand palette (owner's 2026-08-16 redesign;
  dark mode uses `#FF4D59`). Periwinkle and gold were removed and never return.
  Mint `#2ED3A7` means "bot is live" and nothing else.
- Design tokens are CSS variables: the dashboard's live in
  `src/app/dashboard/components/ui.js` (`PALETTE`), the public pages' in
  `src/lib/landing.js` (`THEME_CSS`). Never hard-code a brand colour in a component.
- Embeddings stay 768-dimensional, and always run on the platform's Gemini key
  — even for a client on their own AI key (BYOK). Another provider's embeddings
  are a different vector space and would silently break search.
- Client AI keys (BYOK): only the super admin sets or removes them (secret
  admin key required), they are stored encrypted, and no dashboard ever sees
  more than a masked form. A failing client key falls back to the platform key
  — the bot never goes silent because of it.
- Client setup is one click. Never ask a business owner to find an ID or paste a token.
- Broadcasts and follow-ups only ever send inside Meta's 24-hour window.

## Where things live
- `src/lib/bot.js` — the reply engine. `composeReply()` produces the answer and every
  channel uses it; `processConversation()` wraps it for Facebook, Instagram and
  WhatsApp; `/api/widget/chat` calls it directly for the website widget.
- `src/lib/` — `plans.js` (plan catalogue, single source of truth), `broadcast.js`,
  `broadcast-send.js`, `followup.js`, `tags.js`, `widget.js`, `messenger.js`,
  `gemini.js`, `knowledge.js`, `sslcommerz.js`.
- `src/app/dashboard-client.js` — the dashboard shell only.
- `src/app/dashboard/components/` — one file per tab, plus `ui.js` (design tokens and
  shared components — **the** source of truth for styling) and `session.js` (auth
  token and the `api()` helper).
- `docs/` — architecture, database, security, error handling, phases, prompts.

## Working rules
- Verify before asserting. Read the logs, query the database, call the API. Never
  give a confident diagnosis from assumption.
- Fix the system, not the symptom. If a bug appears for one tenant, check whether
  every tenant has it.
- One task at a time. Refactors never share a commit with a feature.
- If you find a bug while doing something else, write it down and say so. Do not fix
  it in the same commit.
- Never commit secrets. `.env*` is gitignored and **this repository is public**.
