# Autologic — Working Memory

A living log so any session can resume with full context. Update the top two
sections after every work session.

---

## Last session (2026-07-30, later)

Fixed Instagram end-to-end. Three separate bugs:
- **IG bot never replied.** All sends went to `graph.facebook.com/me/messages`, but
  IG uses Instagram-Login tokens (`IGAA...`) that only work on
  `graph.instagram.com` with a Bearer header. `send()` in `messenger.js` now picks
  the endpoint + auth by platform; all four `bot.js` send calls pass `platform`.
- **No IG comment handling.** `parseCommentEvent` only handled Facebook
  (`object=page`, field=feed). Added the Instagram shape (`object=instagram`,
  field=comments).
- **No IG comment-to-inbox.** Added `igReplyToComment` and `igPrivateReply`
  (graph.instagram.com); `handleComment` is now platform-aware for both public
  reply and the private reply, and records the real platform in the comments table.

All in `src/lib/messenger.js` and `src/lib/bot.js`. Built clean, deployed.

Note: IG comment reply / inbox need `instagram_manage_comments` +
`instagram_manage_messages` approved to work for all clients (pending App Review);
DM reply needs `instagram_manage_messages`.

## Next up

- **Enterprise polish (standing goal):** every client connection must be one-click.
  Concrete items:
  - Google Calendar: add a one-click connect step in onboarding for agency clients,
    or a clear dashboard prompt before the first booking fails.
  - WhatsApp: still needs manual Phone Number ID until `whatsapp_business_management`
    is approved; move to full Embedded Signup once approved.
- **Meta App Review resubmission (after rejections):** 9 permissions remain (see
  `Autologic_Meta_App_Review_Guide.pdf`). 2 approved: pages_show_list,
  pages_messaging.
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
- **Docs:** `docs/` holds architecture, database, security, error-handling,
  prompts, phases. Keep them updated with each feature.

## Known constraints (Meta/platform, not bugs)

- Facebook/Instagram cannot reply-to-specific-message or react via API (bots aren't
  given those). WhatsApp can do both.
- Private reply to a comment: once only, within 7 days, needs `pages_messaging`;
  a Page cannot private-reply to another Page or to its own admin.
- WhatsApp typing indicator also marks the message read (blue ticks).
