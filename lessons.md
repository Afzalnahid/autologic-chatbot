# Lessons

A running log of mistakes made while building Autologic and the rule each one produced.
Append to it; never trim it. Read it at the start of every session — the point is that the
same mistake is not made twice.

---

## 1. Do not give a confident diagnosis from assumption
**2026-07-30.** The Facebook Page picker was missing `AutoLogic Systems`. I stated as fact that
the list had scrolled out of view, redesigned the picker, and told the owner the problem was
solved. It was not. The real cause was that the Page belonged to a Business Portfolio, and
Meta excludes portfolio-owned Pages from `/me/accounts` unless `business_management` is granted.
The owner had to push back twice before the real cause surfaced, via Graph API Explorer.

**Rule:** before naming a cause, get evidence — Vercel logs, a Supabase query, or a direct API
call. If evidence is not available, say which explanations are possible and give the owner a
check that distinguishes them. "Probably X" is acceptable; "it is X" without proof is not.

## 2. Fix the system, not the one row
**2026-07-30.** A new signup showed the bot name "Evalora Bot". I corrected that client's
settings row. The owner pointed out this is a multi-tenant SaaS. The actual defect was in
`api/me`: every new client was seeded by copying a shared `app_settings` row holding another
business's brand, greeting and a 4,800-character jewellery prompt.

**Rule:** when something is wrong for one client, ask whether the code path that produced it
runs for all of them. Repair the path, then the data.

## 3. A dependency that can fail is not a dependency you can rely on
**2026-07-30.** Business knowledge was generated only by Gemini. With Gemini rate-limited,
"Skip for now" discarded everything typed and any generation failure dead-ended — so every
client signing up that day would have received a bot that knew nothing, without being told.

**Rule:** for anything on the critical path, build the deterministic version first and let the
AI upgrade it. Never let an external service's failure silently produce an empty product.

## 4. Fallback text is customer-facing text
**2026-07-30.** The comment fallback was hardcoded as `"ধন্যবাদ! … / Thanks! …"`. When Gemini
failed, that bilingual string *was* the reply customers read, and it made the bot look broken.

**Rule:** write fallbacks to the same standard as the primary path. They appear precisely when
things are already going wrong.

## 5. Check the whole surface, not the file in front of you
**2026-07-30.** The new palette was applied to the dashboard's `T` object and the design looked
done. The landing page still rendered gold, because nine other files each carried their own
copy of the old hex values.

**Rule:** after a cross-cutting change, grep the repository for the old value before declaring
it finished. And prefer one source of truth so the question cannot arise again.

## 6. Read the platform's current documentation, not its history
**2026-07-30.** Facebook private replies used `/{comment-id}/private_replies`, an edge Meta has
retired. It returns a generic `(#100) … does not support this operation`, which reads like a
permissions problem and hid the real cause for a long time. Instagram already used the correct
Send API pattern in the same file — the working example was sitting next to the broken one.

**Rule:** when one platform path works and its sibling does not, compare them directly before
theorising. Generic Meta errors mean "look again", not "you lack permission".

## 7. Preserve context before it is lost
**2026-07-30.** Long session, many interdependent fixes. Without `memory.md` written *before*
the session ended, the next session would have restarted from guesswork.

**Rule:** update `memory.md` after every session and whenever a session might end. Record what
changed, what is blocked, and the exact next step — not a summary, an instruction to resume from.
