# Autologic — Working Memory

Update the top two sections after every session.

---

## Last session (2026-08-02)

**Meta App Review was submitted with ten permissions.** Confirmation PDF received:
`AutoLogic_Meta_App_Review_Submitted_On_2026-08-02.pdf`.

Submitted: pages_manage_metadata, pages_read_engagement, pages_read_user_content,
pages_manage_engagement, instagram_business_basic,
instagram_business_manage_messages, instagram_business_manage_comments,
business_management, whatsapp_business_management, whatsapp_business_messaging.

Ten, not nine — Meta will not accept `pages_manage_engagement` unless
`pages_show_list` and `pages_read_user_content` are in the same submission.
Three unused permissions were removed before submitting: Human Agent,
instagram_business_content_publish, instagram_business_manage_insights.

Review credentials given to Meta: `nahidafzal97@gmail.com` / `nahidafzal97@`.
**Do not change this password, and do not disconnect any channel, until the result
comes back.** The reviewer works through the flow live.

Videos (captions burned into the picture, since Meta wants an uploaded file rather
than a link):
- Facebook — https://youtu.be/8YrgTbg9mDU
- Instagram — https://youtu.be/x9lz8i2MXA0
- WhatsApp — https://youtu.be/_czw0qt6DsI

Full submission record, including every usage description, the single reviewer
instructions form and the data-handling answers, is in
`meta-app-review-submission.md` (kept outside the repo, with the owner).

### Data processors declared to Meta

Vercel (US), Supabase (Australia, ap-southeast-2), Google Gemini (US), Resend (US)
— all under "IT solutions and services". PikaPods was removed; it was left over
from the old n8n architecture and is no longer used. These must stay consistent
with the Privacy Policy.

### Also fixed this session

- `/api/fb/data-deletion` returned 405 when opened in a browser, which looks like
  a broken endpoint to a reviewer. It now serves a readable page on GET.
- Instagram had been disconnected after recording video 2; reconnected before
  submission.

## Next up

1. **Wait.** Meta takes roughly 20 working days. A rejection names the specific
   permission and reason — fix only that one and resubmit; the rest stay approved.
   Highest risk: `business_management` (Meta's own wording frames it around ad
   accounts, we use it for WhatsApp portfolio selection) and `pages_read_engagement`
   (rejected once on 2026-07-28).
2. **Create the General login configuration** and set `WA_LOGIN_CONFIG_ID`, so a
   business that already owns a WhatsApp account can pick their number from a list
   instead of pasting a Phone Number ID. Everything is built and waiting for it.
3. **Booking pipeline is still unverified end to end.** `[booking]` log lines are
   in place; reconnect Google Calendar, make a booking, read the logs.
4. **Google Cloud billing** — Gemini is rate-limited, so replies sometimes fall
   back to the deterministic path rather than real AI output.
5. **Custom domain** — still blocks Resend email verification and Google Calendar
   OAuth verification.
6. **Display name "Autologic" was rejected by Meta** for +880 1835-827559.
   Resubmit as "AutoLogic Systems".

### Facts worth keeping

- WABA `1196218689268546` under the NORAY AFZAL NAHID portfolio.
  Phone Number ID in use: `1136966472839695`.
- Meta configuration IDs: `2178064332957710` (Facebook Page),
  `1417283913551939` (WhatsApp Embedded Signup, in `WA_CONFIG_ID`).
- A Page owned by a Business Portfolio does **not** appear in `/me/accounts`
  without `business_management`.
- Permissions come from the login **configuration**, not a `scope` parameter, and
  adding one does nothing until the user removes the app at
  `facebook.com/settings?tab=business_tools` and reconnects.

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
