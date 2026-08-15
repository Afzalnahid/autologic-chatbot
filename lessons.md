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

## 13. Two apps means two secrets
**2026-08-02.** Instagram messages never reached the bot. The channel said `connected`, the
token was valid, the webhook was subscribed — and every delivery was rejected at the door with
a 401, because Facebook and Instagram are separate Meta apps here and the webhook verified
everything against the Facebook secret alone. Nothing was stored, so from inside the product
the channel simply looked silent.

**Rules:**
- When a webhook can be signed by more than one app, verify against every configured secret.
- A rejection that happens before any per-tenant record is written is invisible to the owner.
  Anywhere a request can be dropped at the door, make sure the drop is countable — otherwise
  "the bot is not replying" has no trail to follow.
- The diagnosis came from reading the runtime logs and the database, not from reasoning about
  what was likely. Ten minutes of evidence beat a confident guess (see #1).

## 14. Fix an invariant everywhere it is broken, not only where you noticed it
**2026-08-07.** `GET /api/conversations` was reading `message_buffer` with no `client_id`
filter and slicing in JavaScript; that was spotted, fixed at the DB (`d7ac431`), and even
written into `memory.md`. But the *same* anti-pattern was living in seven reads inside
`src/lib/bot.js` — the shared reply engine, the busiest code in the project — and two of them
(`botAllowed`'s contacts read, `getMemory`) filtered no `client_id` at all, a silent
cross-tenant read. The stated invariant ("every query filters `client_id` at the DB with
`.eq()`") had existed the whole time; nothing enforced it, so it rotted in the one file that
mattered most. `pendingFor` was on the critical path: a busy platform could push a tenant's own
pending rows past a shared 500-row cap and the bot would go silent with no error.

**Rule:** when you fix an invariant violation in one place, immediately grep the whole repo for
the same shape before calling it done — especially the core engine, not just the route in front
of you (this is #5 applied to data-scoping). A rule written in `AGENTS.md` is not a check; treat
a stated invariant as unenforced until something greps for it. And a read that returns another
tenant's rows but "happens to work" because ids rarely collide is a latent leak, not a
non-issue — scope it now.

## 15. When a setting has no effect, find out where it is stored before touching the prompt
**2026-08-07.** The owner chose "English only" and the bot kept answering Bangla questions in
Bangla. Three fixes were shipped on the theory that the instruction was not forceful enough:
moved to the end of the system prompt, added to the user turn, then a verify-and-rewrite pass.
None of them worked, because none of them was the problem. The Settings tab saves the value at
`settings.questionnaire.languages` and the code was reading `settings.languages`, so it always
saw "not set" and fell back to following the customer. One query against `app_settings` at the
start would have shown this in seconds.

**Rules:**
- A setting that appears to be ignored is a plumbing question first — *where is this actually
  written, and is anything reading it?* — and a prompt question only after that is ruled out.
- Do not ship a second fix on the same theory the first one failed on. A failed fix is evidence
  the diagnosis is wrong, not that the medicine was too weak.
- The layered work was still worth keeping (code decides the language, the reply is checked and
  rewritten when wrong), but it was built on a guess and only started working once the real
  cause was found.

## 16. A screenshot cannot show motion — ask for a recording
**2026-08-07.** The owner reported the landing page animations were not visible. Three
replies were spent explaining why he might not be seeing them — hover does not exist on
touch, entrance animations finish in half a second — instead of looking. He sent a screen
recording; extracting 65 frames showed the cards fully opaque in every single one. The
animation genuinely never ran: the reveal script sat above the cards in the document, so
at parse time `querySelectorAll` found nothing and the observer was never attached. No
error, no warning, just silence.

**Rules:**
- When someone says "it does not work" about anything visual or timed, ask for a screen
  recording before explaining. A still frame cannot contain motion.
- A script that queries the DOM must wait for `DOMContentLoaded` unless it sits below what
  it queries. A silent no-op is the worst kind of failure — nothing looks wrong.
- Design for the device the customer actually holds. Hover-only polish is invisible to a
  market that is almost entirely mobile.

## 17. Rebuilding a page means inventorying the old one first
**2026-08-08.** The landing page was rewritten in a new visual language. The case-study
section was carried over because it was remembered; the footer links — Privacy Policy,
Terms of Service, Contact, Google Calendar — were not, and quietly disappeared. Meta's
App Review requires those URLs to be reachable from the site. The owner caught it.

**Rules:**
- Before replacing a page, list what it contains and tick each item off after the rewrite.
  Memory is not an inventory.
- Compliance-required links are not decoration. Privacy and terms leave a page only by an
  explicit decision, never by omission.

## 18. Borrow structure from a reference, never its palette
**2026-08-08.** A reference site was used to redesign the landing page, and its colours
came along with its layout: cream paper, orange CTA. The result looked accomplished and
belonged to a different company than the dashboard a visitor lands in one click later.

## 19. Writing a rule down is not the same as enforcing it
**2026-08-15.** Lesson #14 (2026-08-07) already said it: fix an invariant everywhere
it's broken, not just where you noticed it, and grep the whole repo before calling it
done. That grep was never actually run against the rest of the codebase. A full-project
audit eight days later found the identical "fetch all tenants, filter with `client_id`
in JavaScript" shape in 8 more places — `api/me`, `api/contacts` (×2, with no filter or
limit at all), `api/orders`, `api/products`, `api/import-one`, `api/profile`,
`api/channels`, `api/send-message`/`api/send-media`. Two of the worst (`api/orders`,
`api/products`) had the exact same failure mode as the already-fixed `pendingFor` bug:
a busy platform can push a tenant's own rows past a shared cap and they vanish from
that tenant's own dashboard, silently.

**Rule:** a written rule in `AGENTS.md` or a past lesson is not self-enforcing. After
fixing an invariant violation, actually run the grep across the whole repo in the same
session — don't write "grep the whole repo" as future guidance and move on. Better
still: a rule that recurs a second time after being named once is a candidate for a
mechanical check (a shared query helper, a lint rule) rather than a fourth round of
manual fixes later.

## 20. A build warning is a bug report, not noise to scroll past
**2026-08-15.** `npm run build` had been printing "Attempted import error: 'languageRule'
is not exported from '@/lib/bot.js'" on every build. It was not a false alarm: the
import really did resolve to `undefined`, and the only caller — the public demo chat
bot — threw on every single message and had never once returned a real reply. Nobody
had read the warning as what it was: a live, on-every-build report that a whole feature
was broken.

**Rule:** a compiler/bundler warning that names a specific broken import is not
cosmetic. Read it, trace the caller, and check whether the code path it warns about is
reachable and used — don't wait for a user report to notice a warning that already told
you the answer.

**Rule:** a reference contributes typography, rhythm, hierarchy and ideas. Colour comes
from the product's own tokens — here, the same seven values `ui.js` uses — or the seams
show the moment a customer signs up.
