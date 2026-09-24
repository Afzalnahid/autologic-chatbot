# Only real email addresses: the two gates, and how to switch the second one on

Owner's request (2026-09-21): *"in time of login there should be authentication
mandatory, like valid email address only, login or create account."*

There are two different things an email address can fail, and they need two
different gates.

| Gate | Stops | Where it lives | State |
|---|---|---|---|
| 1. **Format** | `asdf`, `name@`, `name@site`, `a b@c.com`, an empty field | the app — `src/lib/valid-email.js`, used by the sign-in screen, create-account, forgot-password and the admin console | **Live** |
| 2. **Ownership** | a well-formed address that is made up, mistyped, or someone else's (`anything@gmail.com`) | Supabase Auth's **Confirm email** setting — a link is emailed and the account cannot sign in until it is opened | **LIVE since 2026-09-24** |

## What is set today (2026-09-24), read off the dashboard

| Setting | Value | Where |
|---|---|---|
| Enable custom SMTP | **on** | Authentication → Emails → SMTP Settings |
| Sender email / name | `no-reply@tellmoreai.com` / `TellMore AI` | same |
| Host / Port | `smtp.resend.com` / `465` | same |
| Username / Password | `resend` / a stored Resend API key | same |
| Minimum interval per user | 60 seconds | same |
| Site URL | `https://www.tellmoreai.com/dashboard` | Authentication → URL Configuration |
| Redirect URLs | `https://www.tellmoreai.com/**`, `https://tellmoreai.com/**` | same |
| **Confirm email** | **ON** | Authentication → Sign In / Providers |
| Rate limit for sending emails | **30/hour — still the default, needs raising** | Authentication → Rate Limits |

**Site URL must keep the `/dashboard` path.** The confirmation link redirects
there with the session in the URL fragment, and only the dashboard runs a
browser Supabase client that reads it (`src/utils/supabase/client.js` —
`createBrowserClient`, `detectSessionInUrl` on by default). The admin console's
client deliberately has that off, and the public pages are server-rendered with
no Supabase client at all, so a link landing on `/` would confirm the account but
leave the person to sign in by hand.

**Rotating the Resend key: paste the new one FIRST, save, and only then delete
the old one in Resend.** Deleting first leaves Supabase holding a dead key, and
every new signup waits for a link that cannot be sent.

## How we know gate 2 is off

Checked in the database on 2026-09-21 (`auth.users`, counts only): all 17
accounts were marked confirmed in the same second they signed up, and no
confirmation email was ever sent to any of them. That is what Supabase does
when **Confirm email** is off: any well-formed address gets straight in — and
gets a free trial.

## The app is already ready for it

Nothing breaks when the setting is switched on; this was tested in headless
Chrome against faked Supabase answers (sign-up → "user, no session", sign-in →
"Email not confirmed", resend → OK):

1. **Create account** → the form says *"We sent a confirmation link to
   name@example.com. Open it, then come back here and sign in."*, turns to
   "Sign in", and offers **Send the link again**.
2. The business name typed at sign-up is stored in the account itself
   (`user_metadata.business_name`), because there is no session yet and the link
   may be opened on another device. `loadMe()` uses it at the first real sign-in.
3. **Sign in before confirming** → *"This email address has not been confirmed
   yet…"* with the same resend link (not the raw "Email not confirmed").
4. The link lands on `/dashboard`, signed in. In the Android app the link opens
   in the phone's browser; the owner then returns to the app and signs in.
5. The 17 existing accounts are already marked confirmed — nobody is locked out.

## Switching it on — owner's steps (Supabase dashboard)

*Kept as the record of how it was set up, and for any second project. All of it
is done except the rate limit.*

Do these **in this order**. Step 1 matters: Supabase's built-in mail sender is
for testing only and sends just a few emails an hour, so with it a real signup
would wait for a link that never comes.

1. **Send auth emails through Resend** (the account the product already uses).
   Supabase → *Authentication* → *Emails* → *SMTP Settings* → **Enable custom
   SMTP**, then fill the form exactly like this:

   | Field on that screen | Value |
   |---|---|
   | Sender email address | the address the product's own emails already come from — the `RESEND_FROM` value set in Vercel (see the note below) |
   | Sender name | `TellMore AI` |
   | Host | `smtp.resend.com` |
   | Port number | `465` (implicit SSL/TLS — the value Supabase already suggests) |
   | Minimum interval per user | `60` seconds (leave it) |
   | Username | `resend` — the literal word, not an email address |
   | Password | a Resend **API key** (Resend → *API keys* → *Create API key*, sending permission). The owner pastes it; it is never typed by an assistant and never committed. |

   **The sender address is the one field that must be checked, not guessed.**
   Resend only sends from a domain verified in *that* Resend account, and
   `RESEND_FROM` is a sensitive Vercel variable, so its value cannot be read
   from here. Two ways to settle it in a few seconds: open Resend → *Domains*
   and use any address on the domain that shows **Verified** (e.g.
   `no-reply@tellmoreai.com`), or look at the "from" line of any email
   TellMore AI has already sent. If nothing is verified yet, add
   `tellmoreai.com` in Resend → *Domains* → *Add*, put its DNS records in, and
   wait for Verified before switching the toggle on.

   **Then raise the rate limit.** Supabase's own note on that screen says the
   limit becomes *30 emails per hour* once custom SMTP is on. Thirty sign-ups
   in an hour would exhaust it and the rest would get no link at all, so open
   *Authentication* → *Rate Limits* → **Rate limit for sending emails** and
   raise it (a few hundred per hour is ordinary for a product this size).

2. *Authentication* → *URL Configuration*: **Site URL** =
   `https://www.tellmoreai.com/dashboard`; add
   `https://www.tellmoreai.com/**` to **Redirect URLs** (the password-reset page
   `/reset` must stay allowed).
3. *Authentication* → *Sign In / Providers* → *Email* → turn **Confirm email**
   ON → Save.
4. Optional, same page: *Emails* → *Templates* → "Confirm signup" — put the
   product's name in the subject, e.g. *"Confirm your email for TellMore AI"*.

## Test after switching on

1. Open `https://www.tellmoreai.com/dashboard?auth=signup` in a private window,
   create an account with an address you can read.
2. You should see the green "We sent a confirmation link…" line and **not** be
   let in.
3. Try to sign in before opening the link → "has not been confirmed yet".
4. Open the link → you land in onboarding with the business name you typed.
5. Tap **Send the link again** once to see it arrive (Supabase allows one a
   minute per address).

## Master prompt

> TellMore AI must accept only real email addresses. Gate 1 (format) is
> `src/lib/valid-email.js` + `tests/t-valid-email.mjs`; every screen that calls
> `auth.signUp`, `signInWithPassword` or `resetPasswordForEmail` must trim the
> address and call `isValidEmail()` first. Gate 2 (ownership) is Supabase's
> "Confirm email" setting — it cannot be changed from code or from the MCP
> tools; verify its state with a COUNT-only query on `auth.users`
> (`email_confirmed_at` vs `confirmation_sent_at`), never by reading addresses.
> The confirm flow in `AuthGate` (dashboard-client.js) must keep working with the
> setting on or off: no-session sign-up → green message + resend link, business
> name in `options.data`, "Email not confirmed" → friendly text. Never type or
> commit SMTP keys; the owner pastes them in Supabase.
