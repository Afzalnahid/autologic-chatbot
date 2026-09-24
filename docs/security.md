# Security

---

## 0. Where it stands (audited 2026-09-25)

Run against the **live** project, not read off the code. The owner asked how
likely a successful attack is; this is what was actually checked.

**Holding:**

- **Every one of the 32 public tables has RLS enabled.** 24 of them have no
  policy at all, which is the tightest possible state — only the service key can
  touch them. Supabase's linter flags that as INFO; for this design it is the
  correct answer, not a finding.
- The 8 tables that *do* have a policy are all scoped the same way:
  `client_id in (select id from clients where owner_email = auth.jwt()->>'email')`.
  A signed-in owner reaches their own rows and nobody else's, enforced by the
  database rather than by remembering to write `.eq()`. The policies are `ALL`
  with no separate `WITH CHECK`, so Postgres applies the same test to INSERT and
  UPDATE — a tenant cannot write a row onto another tenant's id either.
- **Meta webhooks verify `x-hub-signature-256`** with an HMAC and
  `timingSafeEqual` (`api/messenger`, `api/whatsapp`), so forged events are
  rejected.
- **The payment IPN does not trust its own body.** `api/billing/ipn` calls
  `validateTransaction(val_id)` back to SSLCommerz and checks `amountMatches`
  before activating anything, so a forged callback cannot buy a plan.
- **Every OAuth return is signed.** `verifyState` (`lib/oauth-state.js`, 30-min
  TTL) guards `fb|ig|wa/select` and the callbacks, so a channel cannot be
  attached to someone else's account.
- **Rate limiting** is on the routes that matter, including `/api/auth`
  (brute force) and the public widget chat, which additionally checks the
  request origin against the channel's allowed domains.

**Found and fixed the same day:**

- `record_ai_usage` (the 12-argument overload) was `SECURITY DEFINER` and
  callable by `anon` — i.e. by anyone, since the publishable key is in the
  browser bundle. It writes `usage_daily` for whatever `client_id` it is given,
  so a stranger could have driven a paying client into their monthly cap and
  silenced their bot, and corrupted the billing numbers. `log_allowance_event`
  was exposed the same way. Both revoked:
  `docs/sql/2026-09-25-lock-security-definer-functions.sql`. Verified after:
  anon no, authenticated no, service_role yes.
  **The lesson generalises:** revoking one overload says nothing about the next.
  Every new argument added to a `SECURITY DEFINER` function creates a fresh
  signature that starts with `GRANT EXECUTE TO PUBLIC`. Re-run the linter after
  any migration that changes a function.

**Still open, for the owner:**

- **Password hardening.** The linter asks for the HaveIBeenPwned leaked-password
  check, and Supabase **refuses it on the Free plan** — "available on Pro Plans
  and up" (tried 2026-09-25; the toggle turns green and the save fails, which is
  worth knowing because the UI then lies about the state). Not worth $25/month on
  its own. What the Free plan *does* allow, on
  Authentication → Sign In / Providers → Email, and what should be set instead:
  **minimum password length 6 → 12** (length beats character classes), a
  **password requirement** of letters and digits, and **"Require current password
  when updating" ON** — without it, anyone who gets hold of a live session can
  change the password and lock the real owner out. None of these affect existing
  passwords, only new ones.
- **Captcha on the auth endpoints is off** (Authentication → Attack Protection).
  Not in the linter's list, found by reading the page. This is the one with a
  money cost attached: without it a script can open accounts in bulk, and **every
  account gets a free trial**, whose AI calls are billed to the platform. Needs a
  free hCaptcha or Cloudflare Turnstile key.
- **MFA on the admin accounts** (Authentication → Multi-Factor). The admin login
  is the most valuable key on the platform; check whether the TOTP factor is
  available on the current plan.
- The `vector` extension lives in the `public` schema. The linter suggests moving
  it. **Do not** — `products.embedding` and `knowledge_base.embedding` are of a
  type this extension owns, so moving it risks breaking search for every client.
  High risk, no real gain.

The honest summary: the ways in that would actually hurt — reading another
business's data, faking a payment, forging a webhook — are each closed by
something the database or a signature enforces, not by a convention. The
realistic risk is not the code; it is a leaked key or a guessed password, which
is why the two items above are the ones worth doing.

---

## 1. Golden rule

**No secret is ever hardcoded, and no fallback value is ever used for a secret.**

The repository is public. Every credential lives in a Vercel environment variable
and is read as `process.env.X` with no `|| "default"`. If the variable is missing,
the route fails loudly rather than running with a leaked value.

This was learned the hard way: a Facebook App Secret once sat in the code as a
fallback and had to be rotated. The pattern to avoid:

```js
// NEVER
const APP_SECRET = process.env.FB_APP_SECRET || "007a98...";
// CORRECT
const APP_SECRET = process.env.FB_APP_SECRET;
if (!APP_SECRET) return new NextResponse("Server misconfigured", { status: 500 });
```

---

## 2. Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | server | Project URL |
| `SUPABASE_SERVICE_KEY` | server | **Full DB access — never expose to the browser** |
| `NEXT_PUBLIC_SUPABASE_URL` | browser | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser | Anon key, safe to expose |
| `GEMINI_API_KEY` | server | Billing must be enabled or requests 429 |
| `FB_APP_ID`, `FB_APP_SECRET` | server | Facebook OAuth + signed requests |
| `IG_APP_ID`, `IG_APP_SECRET` | server | Instagram OAuth |
| `FACEBOOK_VERIFY_TOKEN` | server | Webhook handshake, must match Meta config |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | server | Calendar OAuth |
| `RESEND_API_KEY` | server | Email |
| `ADMIN_PASSWORD`, `ADMIN_EMAILS` | server | Admin console |
| `PAYMENT_BKASH`, `PAYMENT_NAGAD`, `PAYMENT_ROCKET` | server | Shown on the billing page |
| `GITHUB_TOKEN` | server | Deployment tooling |
| `CRON_SECRET` | server | **Set on Vercel since 2026-09-24.** Locks `/api/cron/*` — Vercel sends it as `Authorization: Bearer …` to the three crons in `vercel.json`; `/api/cron/followups` is called by GitHub Actions, so a **repository secret of the same name and value** is also required or that job gets 401 and no follow-up is sent. Unset would leave every endpoint open (see [architecture.md §7](./architecture.md)). |
| `GEMINI_MODELS` | server | Optional. Comma-separated last-resort model chain; overrides the built-in `gemini-3.6-flash,gemini-3.8-flash` without a deploy. The fallback is never an older generation (owner, 2026-09-19); keep it in step with Admin → AI Engine. |

Never paste a Gemini key into a chat or an issue — Google scans for leaked keys and
disables them automatically.

---

## 3. Authentication

**Clients.** Supabase Auth (email + password). The browser holds a JWT; every API
call sends `Authorization: Bearer <token>`. `requireClient()` in `src/lib/auth.js`
verifies the token and resolves it to exactly one `clients` row. A route that
forgets this check is a cross-tenant data leak.

**Admins.** Separate. `admin_users` holds an email and a role. New signups are
inserted as `pending` and see a waiting screen. Roles:

| Role | Can |
|---|---|
| `super` | Everything, including changing other admins' roles |
| `full` | Edit clients, review payments |
| `editor` | Edit clients |
| `viewer` | Read only |
| `pending` | Nothing |

Only the super admin can assign roles, and only with an additional secret key
(`ADMIN_PASSWORD`) sent as `x-admin-key`.

---

## 4. Tenant isolation

Two layers:

1. **Application layer (primary).** `requireClient()` gives one `client_id`; every
   query filters on it. Webhooks resolve the tenant from `channels.page_id`.
2. **RLS (defence in depth).** Enabled on every table. The service-role key bypasses
   it, so it protects only paths that use the anon key — but it stops an accidental
   anon-key query from reading the whole table.

---

## 4b. OAuth connect flows

OAuth callbacks arrive as plain redirects and form POSTs, so they carry no session
JWT. The `client_id` used to travel through the `state` parameter unsigned, which
meant a crafted POST to `/api/fb/select` (or the Instagram, WhatsApp and Google
Calendar equivalents) could attach an attacker's Page — or overwrite stored
tokens — on **any** tenant's account.

`src/lib/oauth-state.js` now mints an HMAC-signed, 30-minute token at the start of
every connect flow. Every callback and every `/select` route verifies it before
writing anything, using a constant-time comparison. A raw client id, a tampered
id, or an expired token is rejected with 403.

One exception to the 30 minutes: WhatsApp Embedded Signup (business details,
then an SMS code) took 22 minutes in a live run, so `/api/wa/callback` accepts a
signup state for 2 hours. A signup state is the client id with an `es_` marker
inside the signed payload (`lib/wa-signup.js`), so it cannot be forged into one
and the login flow through the same callback keeps the 30-minute limit.

The WhatsApp "find my number" list (`/api/wa/callback` → `/api/wa/select`) used
to carry every number's access token to the browser as plain JSON in a hidden
form field. Since 2026-09-20 it is sealed with `encryptSecret` (AES-256-GCM, the
same key as client AI keys) together with the client id; `/select` refuses a
list it cannot open or one sealed for another client, so the page can neither
read a token nor swap in a number that was not offered.

The signing key is `OAUTH_STATE_SECRET` if set, otherwise `FB_APP_SECRET` — server
side only, never sent to the browser.

## 4c. Rate limiting

`src/lib/rate-limit.js` caps the endpoints that cost money on every call:

| Endpoint | Limit |
|---|---|
| `generate-prompt` | 10 / hour per account |
| `import-url` | 20 / hour per account |
| `import-one`, `add-product` | 60 / hour per account |

The limiter is in-process, so on serverless it applies per warm instance rather
than globally. That is a deliberate trade-off: it costs nothing and stops the
realistic abuse case (one account looping an AI endpoint). A shared store is the
right upgrade once there is real paid traffic.

## 5. Webhook verification

Meta calls `GET /api/messenger` and `/api/whatsapp` with `hub.verify_token`. The
handler compares it against `FACEBOOK_VERIFY_TOKEN` from the environment — there is
no hardcoded fallback. A mismatch returns 403 and Meta refuses to subscribe.

Meta's account callbacks — `/api/fb/data-deletion` (both apps) and
`/api/ig/deauth` (Instagram) — act only on a `signed_request` whose HMAC-SHA256
signature verifies with `FB_APP_SECRET` or `IG_APP_SECRET`
(`src/lib/meta-signed-request.js`, covered by `tests/t-meta-signed-request.mjs`).
Anything else gets a 400 and changes nothing; malformed input never throws.
Until 2026-09-17 the Instagram deauth route read a plain JSON `user_id` with no
check, so anyone knowing an account id could disconnect a client's Instagram.
A verified Instagram request clears that account's token and marks the channel
disconnected — looked up first, then updated by `id` and `client_id`.

---

## 6. Third-party tokens

Page access tokens and Google refresh tokens are stored in Postgres
(`channels.access_token`, `clients.gcal_*`). They are never sent to the browser —
the dashboard only ever sees connection *status*.

Disconnecting a channel or calendar deletes the stored token immediately.

Client AI keys (BYOK, `client_ai` table) go further: the super admin grants
permission (`/api/admin`, super role **and** `x-admin-key`, same as role
changes); the client then pastes their own key via `/api/ai-key`
(requireClient-scoped, 403 without permission, 10 attempts/hour). The key is
verified with the provider before being saved, encrypted at rest with
AES-256-GCM (`src/lib/crypt.js`, key derived from `AI_KEY_SECRET` or, when
unset, the Supabase service-role key), and only a masked form (`key_mask`) is
ever returned — to that client and to the super admin. A client key is never
substituted with the platform key when it fails (hard cost separation).

---

## 7. Payment handling

Payments are manual mobile-banking transfers. The platform stores only what the
client types in: method, sender number, transaction id. **No card data, no PINs,
no banking credentials are ever collected or stored.** An admin verifies the
transaction in their own bKash/Nagad app before approving.

---

## 8. Caching and stale data

Admin and analytics routes set `dynamic = "force-dynamic"`, `revalidate = 0`,
`fetchCache = "force-no-store"` and `Cache-Control: no-store`. Client fetches add
`cache: "no-store"` and a `?t=` cache-buster.

This matters for correctness, not just freshness: a cached admin response once
showed a deleted file as still present, which looked like a data bug for hours.

---

## 9. Incident checklist

If a secret leaks:

1. Rotate it at the source (Meta console, Google Cloud, Supabase, Resend).
2. Update the Vercel environment variable.
3. Redeploy.
4. Confirm the code has no fallback for that value.
5. Test the affected flow end to end.
