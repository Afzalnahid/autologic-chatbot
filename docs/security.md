# Security

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

Facebook's data-deletion callback verifies the HMAC signature of the signed request
using `FB_APP_SECRET` before deleting anything.

---

## 6. Third-party tokens

Page access tokens and Google refresh tokens are stored in Postgres
(`channels.access_token`, `clients.gcal_*`). They are never sent to the browser —
the dashboard only ever sees connection *status*.

Disconnecting a channel or calendar deletes the stored token immediately.

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
