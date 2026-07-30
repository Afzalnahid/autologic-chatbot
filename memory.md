# Autologic — Working Memory

A living log so any session can resume with full context. Update the top two
sections after every work session.

---

## Last session (2026-07-30, latest)

Google Calendar enterprise polish for agency clients — three changes in `dashboard-client.js`:

1. **`ConnectCalendar` component (new):** Full-screen onboarding step with one-click
   Google OAuth popup. Shows success state after `gcal-connected` postMessage, then
   "Go to dashboard" button. "Skip for now" link available.

2. **Onboarding flow extended:** After `ConnectChannel` completes, `onDone` checks
   `me?.client?.business_type`. If `agency` → goes to new `connect-cal` stage;
   otherwise → `app` as before. Flow: `onboarding → connect → connect-cal (agency only) → app`.

3. **Bookings warning banner:** `Bookings` now accepts `calConnected` + `clientId`
   props. When Calendar not connected, shows a gold warning card with "Connect now"
   button that opens the gcal OAuth popup inline. Banner dismisses on `gcal-connected`
   postMessage.

Deployed: commit 6fb4c0bbd0359ec2c3f5843fb77f7be5504625d9

## Next up

- **Verify deploy** on autologic-chatbot.vercel.app (Vercel should be READY now).
- **Enterprise polish (remaining):**
  - WhatsApp: still needs manual Phone Number ID until `whatsapp_business_management`
    is approved; move to full Embedded Signup once approved.
- **Meta App Review resubmission:** 9 permissions remain (see
  `Autologic_Meta_App_Review_Guide.pdf`). 2 approved: pages_show_list, pages_messaging.
- **Blocked on money/approval (not code):** custom domain (unlocks Resend email +
  fixes mobile-carrier vercel.app block), Google Cloud billing (Gemini 429),
  Instagram/WhatsApp comment+message permissions.

---

## How I work here (operating rules)

1. **Team / sub-agent mindset.** Break a task into clear stages, do them in order,
   verify each before moving on.
2. **Token discipline.** Reuse an existing clone instead of re-cloning; read only
   the lines needed; don't re-read unchanged files; batch related edits. Same
   output, fewer tokens.
3. **This file.** Update "Last session" and "Next up" at the end of each session.
4. **Enterprise standard.** One-click, hassle-free, no token/ID hunting for clients.
5. **Quality over speed.** Verify with `node --check` / build / unit tests before
   pushing; trust Vercel READY as final proof.

---

## Project facts (stable)

- **Repo:** `Afzalnahid/autologic-chatbot` (public). Push directly via GitHub
  Contents API; Vercel auto-deploys `main`.
- **Live:** autologic-chatbot.vercel.app
- **Stack:** Next.js 14 (App Router), Supabase (pgvector), Google Gemini, Meta Graph
  API (FB/IG/WhatsApp), Resend, Google Calendar, Vercel.
- **Owner:** Nahid Afzal — Cumilla, Bangladesh. Replies in Bangla. Business type:
  agency (Autologic Systems).
- **Meta App ID:** 914246304594380.

## Architecture quick map

- **Prompt system (3 tiers, enforced in code):** `FIXED_BASE` (all bots) +
  `FIXED_ECOM` or `FIXED_AGENCY` (by business_type) + the client's own business
  profile from `app_settings`. Clients cannot remove the fixed rules.
- **Key files:** `src/lib/bot.js` (reply engine, booking, comments, typing),
  `src/lib/messenger.js` (send/parse for all channels), `src/lib/oauth-state.js`
  (signed OAuth state), `src/lib/rate-limit.js`, `src/lib/route-errors.js`,
  `src/lib/gcal.js`, `src/lib/plans.js`.
- **Channels:** each connect flow is `/api/<fb|ig|wa>/login → callback → select`,
  all using signed state tokens. Google Calendar: `/api/gcal/login → callback`.
- **Onboarding flow (agency):** `onboarding → connect (FB/IG/WA) → connect-cal (GCal) → app`
- **Onboarding flow (ecommerce/other):** `onboarding → connect (FB/IG/WA) → app`
- **Docs:** `docs/` holds architecture, database, security, error-handling,
  prompts, phases. Keep them updated with each feature.

## Known constraints (Meta/platform, not bugs)

- Facebook/Instagram cannot reply-to-specific-message or react via API (bots aren't
  given those). WhatsApp can do both.
- Private reply to a comment: once only, within 7 days, needs `pages_messaging`;
  a Page cannot private-reply to another Page or to its own admin.
- WhatsApp typing indicator also marks the message read (blue ticks).
