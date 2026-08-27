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

## 19. A rebuilt server on the same port can silently serve the old build
**2026-08-15.** Verifying a responsive-layout fix locally: `npm run build`, kill the dev
server, rebuild, restart on the same port, re-check with a headless browser. The "after"
screenshot looked identical to the "before" one. `pkill -f "next start"` had matched
nothing — the running process's actual name is `next-server`, not `next start` — so the
old server was still bound to the port, and the "restart" command silently failed to bind
and did nothing. The re-verification was testing the untouched old build the whole time.
Caught it by `curl`-ing the served HTML for a string only the new CSS contains, before
trusting the second round of screenshots.

**Rule:** after changing code and restarting a local server for verification, confirm the
running process is actually new — check the PID's start time, or grep the served output
for something only the new code contains — before trusting anything it returns. A restart
command that "succeeds" with no error is not proof the old process is gone; `pkill -f` in
particular must match the process's real argv, not the npm script name that launched it.

## 20. A sandboxed session's network is not the open internet
**2026-08-15.** Asked to download a CC0 music track for the product film. Every
general-web host tried was blocked by the session's own egress policy — not one
flaky host, but all of them: pixabay, freesound, archive.org, incompetech,
opengameart, freepd, soundbible, and even Remotion's own asset CDN
(`remotion.media`), which broke its normal first-run Chrome download too. Only a
handful of package registries and `github.com` were reachable.

**Rules:**
- Before spending time hunting for a "better" source when a download fails, check
  whether the *class* of host is blocked, not just the one URL — a couple of quick
  probes to unrelated domains (or the proxy's own status endpoint) tells you in
  seconds whether this is a dead link or a policy wall.
- A policy-blocked host is reported, never routed around — no fetching the same
  asset from an unrelated allowed host as a workaround, no fabricating a
  placeholder and shipping it as if it were the real (licensed) thing.
- When a task depends on an external download that might not be reachable, still
  do everything around it that doesn't depend on the download (wire the code path,
  verify what can be verified, document exactly what's left) and say plainly what
  a human needs to finish by hand. A half-finished PR with an honest account beats
  silence or a fabricated "done".

## 21. React escapes what you put inside `<style>` — and the browser will not undo it

**2026-08-17.** Every inline stylesheet in the app was written as
`<style>{`…`}</style>`. On the server React HTML-escapes text children, so the
shipped HTML read `[data-theme=&quot;dark&quot;]` and
`@import url(&#x27;https://fonts…&#x27;)`. Inside `<style>` the HTML parser does
*not* decode entities, so on first paint those rules were invalid: dark theme
missing, fonts not loading, attribute selectors dead. It only ever looked right
because React patches text mismatches during hydration — at the cost of a
hydration error on every page load and the whole root re-rendering on the
client. Two earlier "pre-existing console warnings" (fonts URL with literal
quotes; hydration #418/#423) were this one bug, noticed twice and fixed never.

**Rules:**
- Inline CSS in React goes through `dangerouslySetInnerHTML={{__html: css}}`,
  never as a text child of `<style>`. Same for `<script>` (already the case here).
- "Pre-existing console warning" is not a category that excuses anything. When
  the same warning shows up in two sessions, it is a bug with a root cause;
  read the served HTML (`curl` the page, look at the raw bytes) instead of the
  live DOM, because hydration can hide what the server actually sent.
- A hydration warning that names a `<style>` element is this bug. Check the
  raw HTML for `&quot;` inside `<style>` first.

## 22. Do not run `next build` while `next dev` is serving the same `.next`

**2026-08-17.** A production build was run for verification while the dev
server (started for browser checks) was still up. Both write into `.next`; the
dev server then 500'd with `Cannot find module './8948.js'` and the next four
production builds crashed their page-data worker (exit 3221225477) — which
looked exactly like this machine's known random Windows access violation, so
time went into retrying instead of looking.

**Rules:**
- One process per `.next` at a time. Stop the dev server before `next build`,
  or build into a separate dir.
- When a "known flaky" failure repeats more than twice in a row, stop retrying
  and read the tail of the log — a *different* cause is likely. Here a clean
  `rm -rf .next` fixed it on the first try.

## 23. A fallback that is never exercised is not a fallback

**2026-08-19.** A voice note came back with "দুঃখিত, একটু পরে আবার চেষ্টা করুন।".
The production logs gave the whole chain in one line: the primary model hit
`429` (Google free tier — **20 requests per model per day**), the code fell back
to `gemini-2.0-flash`, and Google answered `404 … no longer available. Please
update your code to use models/gemini-3.6-flash`. The single fallback had been
dead for some time and nobody knew, because it only runs when the primary fails.
The same retired id was also wired directly into `analyzeImage()`, so every
customer product photo had been failing silently too.

**Rules:**
- Never depend on one model/provider id. Walk a **chain** and treat 404 / 429 /
  503 as "try the next one"; make the list an env var so a retirement is a
  config change, not a deploy.
- A code path that only runs on failure needs its own proof. If the fallback has
  never been seen working in production logs, assume it is broken.
- Vendors announce retirements *inside the error body*. Read the whole error
  string — Google literally named the replacement model.
- Free-tier quotas are a product risk, not a dev detail: 20 requests/day means
  the bot dies every day after ~10 customer messages (each message can cost two
  calls — transcription plus reply). Surface that to the owner instead of
  treating the 429 as noise.
- When the AI genuinely cannot answer, apologise **and promise a human**. A bare
  "try again later" reads as broken and loses the customer.
- Runtime logs are the cheapest diagnosis available. Read them *before*
  theorising about the code.

## 24. Never gate an input on the value it collects

**2026-08-20.** The admin AI tab's secret-key field was written as
`{locked && <Card>…<PwInput/></Card>}` with `locked = !superKey`. The first
keystroke set `superKey`, flipped `locked` to false and unmounted the card —
so the field could only ever hold **one character**. Every "Give / Remove API
key access" then sent a one-character secret and came back 403. From the
outside this looked like two different bugs ("the box vanishes when I type"
and "removing access does nothing"); they were the same line. I had already
"fixed" the second symptom once, guessing at a missing `ADMIN_PASSWORD` env
var, which was never the cause.

**Rules:**
- A form control must never live inside a condition derived from its own
  value. Render it always; change its *appearance* (icon, border, helper
  text) for the entered state, the way the Admins page already did.
- When two reports look unrelated but share a screen, check whether one line
  explains both before fixing either.
- A "silently does nothing" action is almost always a request that *was* sent
  and *was* refused. Look at what the client actually put in the request
  before theorising about the server's configuration.

## 25. An upsert''s onConflict must name a real unique index

**2026-08-20.** `wa/finish` (WhatsApp Embedded Signup) saved its channel with
`onConflict: "client_id,platform"`. No unique index on those two columns has
ever existed — the real one is `(client_id, platform, page_id)` — so Postgres
rejected the ON CONFLICT clause and **every** embedded-signup save failed, not
just conflicting ones. Nobody noticed for weeks because the owner''s own number
had been saved earlier through the other path (`wa/select`), so a WhatsApp row
existed and everything looked connected.

**Rules:**
- Before writing `onConflict`, read the table''s actual indexes
  (`select indexdef from pg_indexes where tablename = ''...''`). PostgREST does
  not warn you; it fails the whole upsert with error 42P10.
- A save path whose failure is masked by data from ANOTHER path is invisible.
  When two flows write the same row, test each flow against an empty table.

## 26. One unapproved permission in an OAuth call blocks the WHOLE call for the public

**2026-08-20.** Every client hit "Facebook Login is currently unavailable for
this app as we are updating additional details for this app" when connecting
Facebook, Instagram or WhatsApp — while the owner's own account connected
fine on all three. The obvious guess (App still in Development Mode) was
wrong: checked live, App Mode was already **Live**, no dashboard restriction
banner. The real cause: `ig/login.js` requested three scopes in one call,
and one of them (`instagram_business_manage_comments`) was still "Not
approved" in Meta App Review. Meta refuses the **entire** OAuth call for the
general public when any one requested permission lacks Advanced Access — only
the app's own admins/developers/testers bypass that check, which is exactly
why the owner's account was never affected.

**Rules:**
- When Meta Login works for the owner/admin but fails for everyone else,
  suspect a permission-approval gap before a Dev/Live mode toggle — check
  App Review → Permissions and Features for every scope actually requested,
  not just the ones you remember asking for.
- A single OAuth call is all-or-nothing: bundling one Not-approved scope with
  several Approved ones blocks all of them for the public, not just the
  unapproved one. Drop the unapproved scope from the request until it is
  approved; do not assume the approved ones still work if not-approved.
- Where the scope list lives in code (`scope=` in the OAuth URL) you can fix
  it directly. Where it lives in a Facebook Login for Business
  **configuration** (`config_id` param, no `scope` in the URL) it is bundled
  server-side in Meta's dashboard and cannot be edited from the repo at all —
  grep the string first; if it appears nowhere, say so plainly instead of
  guessing at a code fix.
- Verify against the live token, not a memory note: `debug_token` on a stored
  access token (`input_token=TOKEN&access_token=TOKEN` works for a page
  token's own self-check) shows exactly which scopes it actually carries and
  when it was issued — cheaper and more current than trusting a written plan.

## Identify the exact control before fixing a "broken switch"
**2026-08-23.** The owner reported "the bot on/off button turns itself back on after refresh."
I audited the Channels tab toggle (channel status), found it persisted correctly, and reported
"no bug". The owner was actually using the OTHER switch — the Conversations tab's account-wide
"Bot ON" toggle. Its write path worked (channels.bot_enabled=false was in the database), but the
read path only looked at status="connected" channels; with the only channel paused it fell back
to `?? true` and reported ON forever. Same symptom, different switch, real bug.

**Rule:** when a control "doesn't stick", first identify from the screenshot exactly WHICH
control it is, then trace its write path AND its read path separately — a saved value that is
read back wrongly looks identical to a value that was never saved.

## Found, not yet fixed (2026-08-23)
- ~~`contacts` PK is `sender_id` alone~~ — **FIXED same day**: PK is now
  `(client_id, sender_id)` (two-step migration: composite UNIQUE added alongside the old PK,
  code deployed with the new onConflict target, then the old PK dropped — no broken window).
  Verified live: same sender under two clients coexists; duplicate within one client rejects.
- ~~Dashboard deep-link `?upgrade=` hardcoded~~ — **FIXED same day**, and the pay screen's
  plan picker/price/preselect were also still on the static PLAN_LIST (custom packages
  invisible at payment); the pay step now uses the live catalogue.
- Customer names on Facebook need the Meta app's Advanced Access for
  `pages_read_engagement` (App Review). Verified live with the page token: Graph returns
  code 100 "requires pages_read_engagement". Names work only for pages owned by app-role
  users (the owner's own pages). This is an owner action on developers.facebook.com,
  not a code fix.

## A backtick inside a CSS template literal ends the string (2026-08-24, second time)

`src/app/docs/shell.js` holds its stylesheet in a template literal. A comment inside it read:

    so `.bn` can override it

The backtick closed the template string, so `${THEME_CSS}` became a tagged template and the
build died with `THEME_CSS.bn is not a function` — an error naming a file and symbol that have
nothing to do with the mistake.

This is the SECOND time. Commit b30adef was "Fix build: backticks inside the CSS template
literal broke the string".

**Rule:** never type a backtick inside a `` ` ``-delimited CSS/JS string, not even in a comment.
Write `.bn` as "the .bn class". After editing any file that embeds CSS in a template literal,
load the page once before saying it works — the error message will not point at the comment.

## `overflow-x: hidden` on `<body>` silently kills every `position: sticky` (2026-08-25)

Both the documentation site and the landing page had a sticky top bar that had never
stuck, and the docs had a sticky sidebar that had never stayed. Both pages carried:

    html, body { overflow-x: hidden }

`overflow-x: hidden` on an element forces its `overflow-y` to compute to `auto`, which
makes `<body>` a scroll container. Sticky children then stick to *body's* scrollport —
but the thing the reader scrolls is the viewport, so the sticky element just rides away
with the page. Measured at 1400px down: the bar reported `top: -1400`.

`<html>` is different: its overflow propagates to the viewport and `<html>` itself is
treated as `visible`, so putting the clip there does no harm.

**Rule:** the sideways clip goes on `html`, never on `body`. If body also needs it, use
`overflow-x: clip` — same clipping, no scroll container.

    html { overflow-x: hidden }
    body { overflow-x: clip }

**How to catch it:** `position: sticky` failing is invisible in a static screenshot. Scroll
the page, then read `element.getBoundingClientRect().top`. A sticky element that is working
reports its `top` offset (0, 76…) at every scroll position; a broken one reports `-scrollY`.

## Anek Bangla needs 1.45 line-height on headings; Latin does not (2026-08-25)

Bangla headings set at `line-height: 1.1` were overlapping — the second line's matras and
ref landed inside the first line's descenders and hasantas.

Painted to a canvas and measured pixel by pixel, Anek Bangla's actual ink runs **1.33em**
(with stacked conjuncts: কৃষ্টি, র্কী, ঐ, ৎ). Fraunces at the same test is 0.88em. So a
setting that is correct for the Latin display face collides in Bangla.

**Rule:** Bangla headings get `line-height: 1.45`; Bangla body 1.7–1.8 (already the case).
Latin keeps its tight setting — do not raise both, the Latin headings would go slack.
Because the size is set inline on each heading, overriding only the leading needs
`!important` on a `.bn h1.fr, .bn h2.fr` rule. That is the purpose of the rule, not a way
around specificity.

**Also:** `.bn .fr` had been in the landing page's CSS for months and never applied —
nothing on that page carried the `bn` class. The Bangla headline was rendering in
Fraunces, a Latin serif with no Bengali glyphs, so it fell back to whatever Bengali font
the reader's phone owned. **Check that a language class is actually on an element before
trusting any rule written against it:** `document.querySelectorAll('.bn').length`.

## A screenshot with no `width`/`height` is a 1px sliver until it loads (2026-08-25)

The manual's 28 screenshots had no dimensions on the `<img>`, so each one occupied 1px
until it arrived and then shoved the page down — 235px of jump per picture on a phone,
worst on exactly the slow connections this manual is written for.

`blocks.js` now reads the pixel size out of the WebP header at build time (`fs.readSync`
of the first 32 bytes; VP8X/VP8/VP8L each keep it in a different place) and passes it as
`width`/`height`. With `width: 100%; height: auto` the browser derives the aspect ratio and
holds the space open from first paint.

**Rule:** every `<img>` gets `width` and `height`, read from the file rather than typed in,
so a new screenshot needs nothing but dropping the file in.

## A measurement taken against a hidden browser pane is not a measurement (2026-08-27)

Measuring the rebuilt contact page, the probe reported **42 elements overflowing the
viewport** and a phone link **332px tall**. Both were nonsense. The browser pane was not
displayed, so it reported `clientWidth: 0` — and against a zero-width viewport every
element trivially "overflows" and every line of text wraps into a tower.

The same afternoon, a headless-Chrome screenshot of the same page at `--window-size=390`
appeared to show the right-hand side clipped. That was also false: Chrome had not applied
a mobile layout viewport, so the page rendered wide and the image simply cropped it.
Re-measured with a real emulated viewport, `scrollWidth === clientWidth === 375` and the
offender list was empty. Two different tools, two different lies, in one session.

**Rules:**
- Before trusting any geometry, print the viewport with it. If `clientWidth` is 0, or is
  not the width you asked for, the numbers that follow mean nothing — set an emulated
  size (`resize_window`) and take them again.
- Do not "fix" a layout bug you have only seen in a picture. A picture can be cropped,
  scaled or rendered at the wrong width; `getBoundingClientRect()` against a known
  viewport cannot. This nearly cost a fix to a page that was already correct.

## A config change is not in effect until you have measured the response (2026-08-27)

The manual was not being edge-cached, so a `Cache-Control` rule went into
`next.config.js` for `/docs/:path*`. It deployed clean. It did nothing: Next writes its
own `no-store, private` for a dynamically rendered page and that outranks anything in
that file. The same header was then set from `middleware.js`, which runs later — also
outranked. Two commits, two deploys, two production measurements, zero change.

The real cause was never the header. `/docs` and `/` read `?lang=bn` out of the query
string, and reading the query is what makes Next render per request and mark the answer
uncacheable. Nothing bolted on afterwards changes that decision.

**Rules:**
- A caching or header change is unverifiable locally here — a dev server sends
  `no-store` on everything and `next build` dies on this machine. So deploy it and read
  the real response headers (`Cache-Control`, `X-Vercel-Cache`) before writing "fixed".
  A green deploy proves the build compiled, not that the rule took effect.
- When a fix does not work, do not reach for the same fix in a different file. The second
  attempt failing the same way is the signal that the diagnosis is wrong (this is #15
  again, in a new costume).
- Remove a rule that did nothing instead of leaving it in. Config that looks like it
  works is worse than no config: the next person reads it as a guarantee, and here it
  would also have run an edge invocation per request for nothing.

## Publish the registered fact, not the one already in the repo (2026-08-27)

Every public page — three footers, the contact page, both legal pages and the
Meta-facing data-deletion page — said the company was at Kandirpar, Cumilla. The
registered address is Chattogram Software Technology Park, Agrabad, Chattogram 4200. The
wrong one had been there long enough to be copied into six places, and it was consistent
everywhere, which is precisely why nobody questioned it.

It was corrected in one line, because the commit immediately before had pulled these
facts into `src/lib/company.js`. That is the whole argument for one source of truth,
arriving a day after the refactor.

**Rules:**
- A fact repeated identically in six files is not corroborated, it is copied. For
  anything a customer or a reviewer acts on — address, phone, legal name, support email
  — check the registered source before publishing, and never infer it from what the code
  already says.
- Ask for the value rather than guessing at it. A phone number was described as being "in
  the screenshot" and was not; inventing a plausible one would have sent real customers
  to a stranger.
- Fixture data is not company data. `shots/sample.js` still says Cumilla on purpose —
  that is an invented shop and its invented customers. A blind find-and-replace would
  have put the real office address into fake demo screenshots.

## `next/og` cannot render on Windows, so nothing it makes can be checked here (2026-08-27)

Open Graph share images were going to be built with `next/og`, the way `/apple-icon`
already is. It fails on this machine in dev **and** in build with
`ERR_INVALID_URL` on `.\file:\D:\...\noto-sans-v27-latin-regular.ttf` — a path-joining
bug in the bundled `@vercel/og`. This is the same fault behind the `next build` crash
already recorded in `memory.md`, which had been filed as "ignore it, Linux is fine".

It is not always fine to ignore. It meant any image `next/og` produced could only be
looked at after deploying it. The cards were rendered with headless Chrome instead —
which also bought real Fraunces and Anek Bangla from the same faces the site uses.

**Rules:**
- A known-broken local tool is a constraint on what you can verify, not just noise in the
  log. Before choosing it for something new, ask whether you will be able to see the
  output before it ships. If not, choose the tool you can check.
- For anything visual that must be right on the first deploy, prefer a renderer you can
  run and open locally. Chrome is on this machine and takes a screenshot of any HTML.

## The favicon file existing is not the favicon appearing (2026-08-27)

The owner asked why Google showed a globe. The mark was correct, served correctly, and
Google's own `s2/favicons` service already returned it — but `/favicon.ico` at the site
root was a 404, and Google's SERP icon comes from the index built when the page was last
processed, not from the live site. After the fix went live the globe was still there, and
reasonably enough the owner asked again.

**Rules:**
- Separate "is it correct now" from "does the world know yet". For anything a search
  engine caches, say plainly that the change is live, that the result will lag, and how
  long — before being asked a second time.
- The lever that exists is Search Console → URL Inspection → Request Indexing. Point at
  it instead of asking someone to wait and see.
- `/favicon.ico` at the root is still required in 2026. An `<link rel="icon">` to an SVG
  satisfies browsers and not the crawlers that ask for the old address first.

## A guard against overwriting turned a button into a no-op (2026-08-27)

The photo batch writes AI-proposed names into the rows, and quite rightly only into
boxes the owner had not typed in. Then "Read photos again" — the button whose entire
purpose is to re-read after typing a base name — did nothing at all, because by then
every box was full of the AI's own earlier words and the guard refused to touch them.
It looked like it worked. Nothing errored.

The fix was to remember what the machine last wrote (`ai` on each draft) and let a
re-read replace its own words while leaving the owner's alone.

**Rule:** "never overwrite" is not one rule, it is two — never overwrite a PERSON, and
freely overwrite YOURSELF. If a field can hold either, record which one put it there.
And after adding any such guard, ask what it does to the explicit re-run button; a
guard that silently makes an action pointless is worse than no guard, because nothing
reports it.

## On a phone, the bulk controls hid the thing they were bulk-editing (2026-08-27)

Five "apply to all" boxes stacked above fifteen products. On a desktop they are three
across and cost nothing. At 375px the owner scrolled past a full screen of empty boxes
before seeing a single one of their own photos — the whole point of the screen. The
same pass found two icon buttons at 24px wide, under the 44px touch floor, in a file
written the day after the last 37px button was fixed.

**Rule:** open every new panel at 375px BEFORE calling it done, and measure rather than
look: `getBoundingClientRect()` on every button, and check that the content the screen
exists for is visible without scrolling. Convenience controls fold on a phone; the
content does not.

## The screenshot studio stubs fetch, so a new route "passed" without existing (2026-08-27)

`/shots` replaces `window.fetch` for the API paths it knows, to render tabs without a
login. A brand-new route is not one of those paths, and calling it from that page
returned `200 {}` — which reads exactly like a working endpoint that had nothing to say.
The route was fine, but the test proved nothing about it.

**Rule:** a harness that fakes the network cannot verify the network. Check a new route
from outside the harness — `Invoke-WebRequest` against `localhost:3000` — and expect the
401 that proves the real code ran. Whenever a response looks suspiciously empty, ask who
else is answering.

## A new button in a flex row that does not wrap breaks the whole page (2026-08-28)

Adding a fourth button to the Inventory toolbar was one line. On a phone it pushed the
row to 475px inside a 375px viewport, and because the row had `display:flex` with no
`flexWrap`, the entire page gained 100px of horizontal scroll. The panel I had just
built measured clean; the damage was two components away, in code I had not touched
except to add one button to it.

**Rule:** after adding anything to an existing row, measure `document.body.scrollWidth`
against `clientWidth` at 375px — not just the new component's own bounds. A flex row
without `flexWrap` is a page-level overflow waiting for one more child.

## A CSS animation frozen at frame 0 reads as a 40px layout overflow (2026-08-28)

Measuring the product drawer at 375px reported fifty-seven elements hanging past the
right edge, the drawer itself sitting at left:40 in a 375px viewport. Every explanation
I checked was wrong: no ancestor transform, no padding, no inner scroller, and
`document.body.scrollWidth` was exactly 375 — the page did not scroll at all, which a
real 40px overflow would have caused.

The drawer opens with `@keyframes inv-slide { from { transform: translateX(40px) } }`.
The Browser pane was not being displayed, so the page was not compositing frames and the
animation was stuck at its first keyframe — a permanent 40px offset baked into every
measurement. `getAnimations()` said `playState: "running", currentTime: 0`. Calling
`.finish()` put the drawer back at 0→375 exactly.

**Rules:**
- Before trusting any geometry, call `el.getAnimations()` and finish anything still
  running. An entry animation stuck at frame 0 is indistinguishable from a layout bug.
- `document.body.scrollWidth` is the honest witness for horizontal overflow. When
  per-element rects disagree with it, the rects are the ones that are lying.
- A screenshot that times out with "the pane is not displayed" is the same fact arriving
  by another route — treat every measurement taken in that state as suspect.
