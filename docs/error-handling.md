# Error Handling

Principles, known failure modes, and the debugging methods that have actually
worked on this project.

---

## 1. Principles

**Never break the customer conversation.** If an optional step fails (email,
analytics, logging), swallow the error and continue. If a required step fails
(the model call), reply with something human rather than a stack trace.

**Fire-and-forget for side effects.** Notifications must not block a signup or a
payment:

```js
notifyPaymentRequest({...}).catch(() => {});
```

**Fail loudly on missing configuration.** A missing secret should return 500 with a
clear message, never silently fall back.

**Errors are data.** Return `{ error: "..." }` with a proper status code so the UI
can show something useful instead of a blank screen.

---

## 2. Failure modes by area

### Gemini API

| Symptom | Cause | Handling |
|---|---|---|
| `429 Too Many Requests`, `limit: 0` | Free-tier quota exhausted | Enable billing on the Google Cloud project. The key does not change. |
| Empty or malformed reply | Model returned prose instead of the JSON array | `bot.js` parses defensively and falls back to sending the raw text |
| Vision returns nothing useful | Blurry or unrelated photo | Retrieval score falls below 0.5 and the bot asks for a clearer photo |

Gemini calls go through `withRetry` in `gemini.js`. Persistent failures surface as
a friendly message, not silence.

### Channel webhooks

| Symptom | Cause | Handling |
|---|---|---|
| Meta refuses to subscribe | `hub.verify_token` mismatch | Check `FACEBOOK_VERIFY_TOKEN` matches the Meta console exactly |
| Bot silent on one channel | `channels.status = 'paused'` or `bot_enabled = false` | Visible in the dashboard; analytics flags "never answered" conversations |
| Bot silent on all channels | Plan expired, quota exhausted, or `suspended = true` | `botAllowed()` returns false. Billing page shows the reason |
| Duplicate replies | Same webhook delivered twice | `message_buffer` dedupes on platform message id |

Webhooks always return 200 quickly. Returning an error makes Meta retry and
duplicate the message.

### Vector search

| Symptom | Cause | Fix |
|---|---|---|
| RPC fails silently | Two overloads of `match_documents` | Drop the extra signature — exactly one must exist |
| Empty results after a migration | Stale PostgREST schema cache | `NOTIFY pgrst, 'reload schema';` or select `*` and filter in JS |
| Wrong product matched | Low similarity | `match_score` is passed to the model with a rule not to guess below 0.5 |

### Google Calendar

Access tokens expire. `gcal.js` refreshes using the stored refresh token before
every call. If the refresh fails the client is marked disconnected and the bot
stops promising meetings rather than booking into a void.

### Email (Resend)

Uses the shared `onboarding@resend.dev` sender until a custom domain is verified.
**Consequence: mail reaches the super admin's own address but not external
recipients.** Client-facing emails (payment approved/rejected) will not deliver
until a domain is verified. Failures are swallowed, so no flow breaks.

---

## 3. Two bugs worth remembering

### Orphaned knowledge files

*Symptom:* the admin client-detail modal listed a PDF that the client dashboard said
did not exist. Hours were lost assuming a caching bug.

*Actual causes — three at once:*
1. `deleteFile` removed database rows but left the object in Storage.
2. Rows existed that the SQL editor could not see but the service-role client could.
3. The admin detail response was cached at the edge, so even after cleanup it kept
   serving the old list.

*Fixes:* `deleteFile` now removes the Storage object too; admin routes are fully
no-store; destructive cleanup is done through an app endpoint using the same
service-role client the app uses.

*Lesson:* when two views disagree, do not guess. Read the API response directly —
a temporary debug endpoint that dumps exactly what the server sees ends the
argument in minutes.

### The bot that went silent when the plan ran out

*Symptom:* a client's bot simply stopped replying when their trial ended or their
monthly quota was hit. No error, no notice — customers messaged into the void and
the owner assumed the product was broken.

*Cause:* `botAllowed()` returned a plain `false`. The caller did `if (!allowed)
return;` with no branch for *why*, so there was nothing to tell either side.

*Fix:* `botAllowed()` now returns `{ allowed, reason, silent, client, used, limit }`.
Deliberate pauses (human handling, admin suspension) stay silent; billing stops now
send the customer one holding message per 12 hours and email the owner once a day.
A separate lazy check warns owners 3 days before expiry.

*Lesson:* a boolean gate at a revenue-critical point is a bug waiting to happen.
When the answer is "no", the code almost always needs to know *why* — design the
gate to carry the reason from the start.

### Settings that were saved but never used

*Symptom:* the greeting configured in Settings never appeared in real conversations.

*Cause:* `getSystemPrompt()` read `businessPrompt` but never read `greeting` or
`botName`. The values were saved correctly and simply ignored.

*Lesson:* when a setting "does not work", first check that the runtime actually
reads it. Grep for the key in `src/lib/` before debugging anything else.

---

## 4. Debugging method

1. **Read the data directly.** Query Postgres and compare with what the API returns.
2. **Verify the deployment.** Confirm the commit is live before assuming the code is
   wrong — Vercel takes 2–3 minutes.
3. **Rule out caching.** Test in a private window, or add `?t=Date.now()`.
4. **Add a temporary debug endpoint** that returns the raw server-side view, then
   **delete it** once the cause is found.
5. **Fix the root cause, not the symptom.** Deleting one bad row is not a fix;
   the code that created it is.

---

## 5. Client-facing error copy

Errors shown to a business owner should say what happened and what to do next:

| Situation | Message |
|---|---|
| Quota exhausted | "You are close to your limit. Upgrade to keep the bot replying." |
| Duplicate payment | "You already have a payment under review. We'll confirm it shortly." |
| Missing transaction id | "Enter the transaction ID from your payment receipt" |
| Unanswered conversations | "N conversations got no reply — check that your channel is connected and the bot is not paused." |

Never show raw provider errors to a business owner.
