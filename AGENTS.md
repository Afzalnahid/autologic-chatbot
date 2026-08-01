# AGENTS.md — How to work on Autologic

Read this file at the start of every session, before `memory.md` and `lessons.md`.
It defines **how** work is done here. The task prompt defines **what**.

---

## 0. Session start ritual (never skip)

1. Read `AGENTS.md` (this file)
2. Read `memory.md` — current state, what's blocked, exact next step
3. Read `lessons.md` — mistakes already made; do not repeat them
4. Read only the docs relevant to today's task (`docs/*.md`)
5. Report understanding in ≤ 5 lines
6. Ask which task, then **WAIT for GO**

Never start coding before step 6.

---

## 1. Operating mode — run as a team, not one worker

Every non-trivial task is executed by these roles. On a single-agent runtime you
still play all five, in order, and you say which hat you are wearing. On a runtime
with sub-agents, delegate them.

| Role | Owns | Must produce |
|---|---|---|
| **Lead** | Scope, sequencing, go/no-go | A numbered stage plan before any code |
| **Researcher** | Reading the codebase & docs | Exact file paths + line ranges that will change |
| **Builder** | Writing the code | Smallest diff that satisfies the stage |
| **Reviewer** | Adversarial check of the Builder | What could break, including the other business type |
| **Scribe** | `memory.md` + `lessons.md` | Both files updated before session end |

**Rule:** the Builder never reviews their own work. State the Reviewer's findings
explicitly, even when the finding is "nothing". A silent review did not happen.

### When to parallelise

Parallelise **only** when the work touches disjoint files with no shared state.

- Parallel is fine: an API route + a docs page + an unrelated UI tab
- Never parallel: two changes to `bot.js`, two migrations, anything touching
  `dashboard-client.js`, or a refactor running alongside a feature

If two threads would touch the same file, they are one thread. No exceptions.

### Handoff format — between roles and between sessions

```
STAGE:      <n of m — one line>
CHANGED:    <file:lines, one per line>
WHY:        <one line>
VERIFIED:   <actual evidence — log line, query result, Vercel status>
RISK:       <what this could break, both business types>
NEXT:       <the single next action>
```

Anything that cannot fill `VERIFIED` with real evidence is not done.

---

## 2. Stage gates — a stage is finished only when all four pass

1. `node --check` on every changed file
2. Pushed, and Vercel reports **READY** — not "probably fine"
3. Behaviour confirmed for **both** `ecommerce` and `agency`
4. Multi-tenant check: does this leak across `client_id`? Prove it does not.

Fail any gate → fix before the next stage. Never stack unverified stages.

---

## 3. Non-negotiables

**Verify before asserting.** Check Vercel logs, a Supabase query, or a direct Graph
API call before naming a cause. "Probably X, and here is how to tell" is acceptable.
"It is X" without evidence is a failure. (`lessons.md` #1)

**Fix the system, not the row.** One tenant's bug means the code path that produced
it runs for all tenants. Repair the path, then the data. (`lessons.md` #2)

**Deterministic first, AI as an upgrade.** Anything on the critical path must work
when Gemini is down or 429ing. Never let an external service's failure silently
produce an empty result. (`lessons.md` #3)

**Fallback text is customer-facing text.** Write it to the same standard as the
primary path — it appears exactly when things are already going wrong. (`lessons.md` #4)

**Grep the whole repo after a cross-cutting change.** Nine files once carried their
own copy of the palette. Prefer one source of truth. (`lessons.md` #5)

**Compare the working sibling before theorising.** When the FB path fails and the IG
path works in the same file, diff them. Generic Meta errors mean "look again", not
"you lack permission". (`lessons.md` #6)

**Enterprise standard.** One-click, OAuth over pasted tokens. No client ever hunts
for an ID, pastes a token, or does technical setup. If a step needs a screenshot to
explain, redesign the step.

**Improvement, not rebuild.** Do not restructure, rename, or "modernise" anything you
were not asked to touch. If the right fix is bigger than the task, **stop and ask**.

---

## 4. Product invariants — breaking these is a failed task

- **The design system is fixed.** Periwinkle `#5B8CFF` is primary. Gold is dead —
  never reintroduce it. Amber = warning only. Mint `#2ED3A7` = a bot is live, nothing
  else. Surfaces are blue-black, never pure black. Type: Geist, Geist Mono, Hind
  Siliguri. Signature element: a 2px state rail on the left edge of cards and rows.
  Copy existing patterns; do not invent new colours, spacing scales or components.
- **Two business types, always both.** Before writing any feature, answer: what does
  this do for `ecommerce`, and what for `agency`? Gate the way existing code gates.
  Never show one type's feature to the other, and never reuse a label that reads
  wrong for one of them.
- **Locked prompts stay locked in code.** `FIXED_BASE` / `FIXED_ECOM` / `FIXED_AGENCY`
  are enforced server-side. No feature may bypass them; enforcement never moves to
  the UI.
- **Every query filters `client_id` at the DB level** with `.eq()`. Never filter in
  JS. Never seed a new tenant from another tenant's row.
- **Do not touch without explicit instruction:** OAuth state signing, webhook
  signature verification, RLS policies, Meta App Review flows, Phase 12 hardening.

---

## 5. Platform gotchas — already paid for, do not rediscover

- Supabase `execute_sql`: one statement per call; only the last result returns.
- After a migration: `NOTIFY pgrst, 'reload schema';` then `select("*")` in JS.
- Embeddings: `gemini-embedding-001`, **768 dims**. Never change dimensions.
- `match_documents` must have exactly **one** signature. Drop duplicates explicitly.
- No secrets in source — and no *real values as fallbacks* either; git keeps them
  forever.
- Commit author must be `Afzalnahid` /
  `124729601+Afzalnahid@users.noreply.github.com`, or Vercel refuses the deploy.
- FB/IG cannot reply-to-a-specific-message or react via API. WhatsApp can.
- Comment private reply: once per comment, 7-day window, requires `pages_messaging`,
  and a Page cannot private-reply to itself or to its own admin — always test from a
  second personal profile.
- Pages owned by a Business Portfolio do not appear in `/me/accounts` without
  `business_management`.

---

## 6. Token discipline

- One clone per session, reused. Never re-clone, never re-read a file you already have.
- Read line ranges, not whole files. `dashboard-client.js` is ~139 KB — never `cat` it.
- Batch edits to the same file into a single write.
- Do not paste large file contents back as "proof". Paste the changed lines.
- Prefer `grep -n` to locate, then read a ~40-line window.

---

## 7. Closing a session (mandatory)

Before the session ends — or the moment it might — the Scribe updates:

**`memory.md`**
- `## Last session (YYYY-MM-DD)` — what was done, file by file, and why
- `### What's next` — the exact resumable instruction, not a summary
- `### Mistakes & lessons` — anything new

**`lessons.md`**
- Append any new mistake as `## N. <the rule it produced>` with the date, what
  happened, and the rule. Never trim this file.

A session that ends without both files updated is an incomplete session, regardless
of how much code shipped.

---

## 8. Escalate instead of guessing when

- The fix requires changing a product invariant (§4)
- A migration would drop or rewrite existing tenant data
- Meta / Google / SSLCommerz behaviour contradicts their documentation
- The task as written would break the other business type
- Two reasonable designs exist and the choice is a product decision, not a technical one

Say what you found, give the options with trade-offs, recommend one — then wait.
