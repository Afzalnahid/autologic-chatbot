# Only real email addresses: the two gates, and how to switch the second one on

Owner's request (2026-09-21): *"in time of login there should be authentication
mandatory, like valid email address only, login or create account."*

There are two different things an email address can fail, and they need two
different gates.

| Gate | Stops | Where it lives | State |
|---|---|---|---|
| 1. **Format** | `asdf`, `name@`, `name@site`, `a b@c.com`, an empty field | the app — `src/lib/valid-email.js`, used by the sign-in screen, create-account, forgot-password and the admin console | **Live** |
| 2. **Ownership** | a well-formed address that is made up, mistyped, or someone else's (`anything@gmail.com`) | Supabase Auth's **Confirm email** setting — a link is emailed and the account cannot sign in until it is opened | **OFF today — the owner switches it on (steps below)** |

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

Do these **in this order**. Step 1 matters: Supabase's built-in mail sender is
for testing only and sends just a few emails an hour, so with it a real signup
would wait for a link that never comes.

1. **Send auth emails through Resend** (the account the product already uses).
   Supabase → *Authentication* → *Emails* → *SMTP Settings* → enable custom SMTP:
   host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API
   key (create one in Resend for this; the owner pastes it — it is never typed
   by an assistant or committed), sender name `TellMore AI`, sender address on a
   domain that is **verified in Resend** — the same one the product's own emails
   use (`RESEND_FROM` in Vercel). If those still come from
   `onboarding@resend.dev`, verify `tellmoreai.com` in Resend first (Resend →
   Domains → Add), then use e.g. `no-reply@tellmoreai.com`.
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
