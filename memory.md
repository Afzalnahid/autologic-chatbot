# Autologic — Working Memory

Update the top two sections after every session.

---

## Last session (2026-08-02)

**All three App Review videos are recorded, edited and uploaded. Nine permissions
are ready to submit.**

- Video 1 — Facebook: https://youtu.be/8YrgTbg9mDU
- Video 2 — Instagram: https://youtu.be/x9lz8i2MXA0
- Video 3 — WhatsApp: https://youtu.be/_czw0qt6DsI

Caption files were written for all three and uploaded as YouTube subtitles.
Usage descriptions and reviewer instructions were drafted for all nine permissions.

### WhatsApp Embedded Signup (built this session)

`/api/wa/embedded` launches Meta's own signup popup via the JS SDK, and
`/api/wa/finish` exchanges the code, subscribes the webhook to the WABA and
registers the number. The client's business name, email, phone, website and
address are pre-filled into Meta's form from their own profile.

Two doors are needed, not one: Embedded Signup only *creates* a new WhatsApp
account, so a business that already owns one needs `/api/wa/login` with a
**General** login configuration instead. That second configuration was never
created, so `WA_LOGIN_CONFIG_ID` is unset and the manual Phone Number ID
fallback is still what clients see. Falling back to `WA_CONFIG_ID` was tried and
reverted — it made both buttons open the same create-new dialog.

Meta configuration IDs: `2178064332957710` (Facebook Page),
`1417283913551939` (WhatsApp Embedded Signup, in `WA_CONFIG_ID`).

### Bugs fixed

1. **The bot answered English messages in Bangla.** A language rule in the system
   prompt loses to the conversation history — after a few Bangla turns the model
   keeps writing Bangla whatever the customer does. Fixed by appending the rule to
   the *current* message via a shared `languageRule()` helper, applied on all four
   AI paths: chat, comment replies, demo, and the landing-page sales assistant.
2. **Two env names for one secret.** Webhook signature verification read
   `FACEBOOK_APP_SECRET` while everything else read `FB_APP_SECRET`, so signature
   checks were silently disabled. Both names are now accepted.
3. **Comments could not be deleted.** `/api/comments` had only GET, so a failed or
   test comment stayed in the dashboard forever. Added a `client_id`-scoped DELETE
   and a trash button.

## Next up

1. **Submit the nine permissions.** Everything is drafted; paste each usage
   description and reviewer instruction, add the video link and timestamp, then
   Submit for Review. Meta takes about 20 working days.
   Test account credentials must be filled into all nine reviewer instructions.
2. **Create the General login configuration** and set `WA_LOGIN_CONFIG_ID`, so a
   business that already owns a WhatsApp account can pick their number from a list
   instead of pasting a Phone Number ID.
3. **Booking pipeline is still unverified end to end.** `[booking]` log lines are
   in place; reconnect Google Calendar, make a booking, read the logs.
4. **Google Cloud billing** — Gemini is rate-limited, so comment replies sometimes
   land on the deterministic fallback rather than real AI output.
5. **Custom domain** — still blocks Resend email verification and Google Calendar
   OAuth verification.
6. **Display name "Autologic" was rejected by Meta** for the WhatsApp number
   +880 1835-827559. Resubmit as "AutoLogic Systems".

### Facts worth keeping

- WABA: `1196218689268546` under the NORAY AFZAL NAHID portfolio.
  Phone Number ID in use: `1136966472839695`.
- A Page owned by a Business Portfolio does **not** appear in `/me/accounts`
  without `business_management`. AutoLogic Systems had to be removed from the
  portfolio before it could be connected.
- Permissions come from the login **configuration**, not from a `scope` parameter.
  Adding a permission to the configuration does nothing until the user removes the
  app at `facebook.com/settings?tab=business_tools` and reconnects — this step was
  skipped repeatedly and cost hours.

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
