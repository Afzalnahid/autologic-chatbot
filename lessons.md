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

## 8. Check the external dependency exists before starting the task
**2026-08-01.** Task 3 (SSLCommerz) was planned and Stage 1 shipped — migration plus
`sslcommerz.js` — before anyone asked whether an SSLCommerz sandbox account existed. It did
not. The task's own "done when" (a sandbox payment upgrades a tenant end to end) was
unreachable from the first line of code, and stage gate 3 could never have passed.

**Rule:** in the Lead's stage plan, name every external account, credential and env var the
task needs, and confirm they exist *before* Stage 1. If one is missing, say so and offer a task
that has no external dependency instead.

## 9. Do not push code you cannot account for
**2026-08-01.** Four files appeared in the working directory mid-session —
`api/billing/checkout`, `api/billing/ipn`, `api/billing/callback`, `lib/billing-settle.js` —
written by something other than the agent doing the work. The code read well and matched the
plan, which is exactly what makes it tempting. It was on the payment path.

**Rule:** code of unknown provenance is not pushed, however good it looks, and least of all
where money moves. Report it, review it in the open, and let the owner decide. "It looked
correct" is not an account of where something came from.

## 10. A check that fails silently is not a check
**2026-08-01.** The JSX syntax check was run as `npx esbuild file.js --loader=jsx ... && echo
BUILD_OK`. esbuild rejected the flag combination and exited, but the shell pipeline still
printed `BUILD_OK`, and that was reported to the owner as "esbuild parse OK". The file happened
to be fine — Vercel's build proved it — so nothing broke, but the evidence given was invented.

**Rule:** before quoting a command as evidence, confirm it actually ran and actually passed.
Echoing a success string next to a command proves only that the echo ran. If the check cannot
be run, say so instead of substituting a weaker one silently.

## 11. A stall timer must measure the claim, not the row
**2026-08-01.** Broadcast sending claims each recipient before sending so two requests
cannot double-send, and rows still claimed after five minutes are retried. The first version
measured that five minutes from `created_at` — the moment the *broadcast* was created, not the
moment the row was claimed. On any broadcast running longer than five minutes, live in-flight
rows would have been reset to pending and **those customers would have received the message
twice**. Fixed with a `claimed_at` column.

**Rule:** a recovery timeout must be measured from the event it is recovering from. Before
shipping one, ask out loud: "what exactly does this timestamp mean, and what happens on the
slowest realistic run?"

## 12. The second time is the pattern
**2026-08-01.** Unaccounted code appeared in the working directory twice in one session —
first on the payment path, then a whole dashboard tab. The second time it matched the API
that had just been written, which made it more tempting, not less.

**Rule:** #9 still holds, and the response to a repeat is not to relax. Verify what actually
reached the repo (diff the remote file, count the added lines, name every added function),
delete the rest, and write it again. Also say plainly that the cause is unknown — a tidy
explanation invented after the fact is worse than an open question.

## 8. A rule in the prompt is not a rule the model follows
**2026-08-02.** The bot answered English questions in Bangla. The language rule was
in the system prompt, and strengthening the wording there twice changed nothing —
the conversation history had a dozen Bangla turns and the model followed those
instead. It only worked once the rule was appended to the current message.

**Rule:** when a model ignores an instruction, ask where the instruction sits
relative to what the model is actually attending to. Rewriting the same
instruction in a stronger voice, in the same place, is not a second attempt.

## 9. Build for the second kind of user too
**2026-08-02.** WhatsApp Embedded Signup was built and tested, then failed for the
owner — because Embedded Signup only *creates* a new WhatsApp account, and he
already had one. The design covered new businesses and silently assumed no one
would arrive with an existing account.

**Rule:** before building an onboarding path, name the states a user can arrive
in — has nothing, has some of it, has all of it — and check which ones the path
serves. "It works" usually means "it works for the case I imagined."

## 10. A timeout is not evidence of failure
**2026-08-02.** A diagnostic was added that declared "the Meta window did not open"
after twelve seconds. Meta's signup legitimately takes minutes, so the message
fired while the popup was working and sent the owner chasing a popup blocker.

**Rule:** a timeout means "I have not heard back", not "it failed". Word waiting
states as waiting, and offer a hint rather than a diagnosis.

## 11. One secret, one name
**2026-08-02.** Webhook signature verification read `FACEBOOK_APP_SECRET` while the
rest of the codebase read `FB_APP_SECRET`. Setting the secret looked like it
enabled verification; it stayed silently off.

**Rule:** grep for every name a config value is read under before assuming it is
set. A security check that fails open is worse than none, because it reports safe.
