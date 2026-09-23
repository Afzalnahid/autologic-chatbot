# "Your phone number isn't eligible" when connecting WhatsApp

Owner's report (2026-09-24): *"there is a whatsapp business number under a
portfolio, but when I add this whatsapp number I face the issue that is
eligible, and when I went to add this number it shows an error … find where it
comes from … and make sure the Meta business portfolio should be verified."*

## Where the error came from

**Meta's window, but our fault.** The words are Meta's — nothing in this
repository ever says "eligible" to an owner (checked: the only `eligible` in
`src/` is the broadcast audience count). Meta's wording is:

> Your phone number isn't eligible to connect to the WhatsApp Business
> Platform. More activity on the WhatsApp Business App is needed to help
> determine eligibility.

That sentence is produced by **one specific door** of Embedded Signup:
**coexistence**, which Meta opens when the link carries

```
extras = { …, "featureType": "whatsapp_business_app_onboarding" }
```

Coexistence exists for one case only: a number that is **running in the free
WhatsApp Business app on a phone right now**, which the owner wants to keep
using while the bot answers too. Meta therefore checks that number's activity
**in that app** before anything else — and refuses anything that is not there,
including a number that already sits under a business portfolio as a WhatsApp
Business Account number. Meta's own documentation for this flow says it is for
"existing WhatsApp Business app phone numbers"; a number already on a WABA
"would follow standard onboarding instead".

With **no** `featureType` (Meta's own sample code sends an empty string),
Embedded Signup opens its normal path: create a new number, **or pick one that
already exists in the portfolio**, or migrate one in from another provider.

**The bug:** `/api/wa/embedded` had four doors written in its guide ("Where does
your number live today?") but only **one button**, and that button always
carried the coexistence `featureType`. So every owner — including one whose
number was already under their portfolio, which is the normal path — was pushed
into the one door that had to refuse them.

Introduced in `c9b08fe` (2026-09-19), the same-tab rewrite: it carried the
coexistence flavour onto the single button. It was correct before that —
`3b78fd1` (2026-08-22) added coexistence explicitly as "a second door … without
replacing the create-new flow".

## The fix

`src/app/api/wa/embedded/route.js` now builds **two** links from one helper:

| Button | `featureType` | For |
|---|---|---|
| **Set up with Meta** (main, maroon) | *(empty)* | a new number, a number already in the portfolio, or one moving from another provider |
| **Connect my WhatsApp Business app** (inside the third door, both languages) | `whatsapp_business_app_onboarding` | a number live in the WhatsApp Business app |

The coexistence button is a plain `<a href>`, so it works without JavaScript;
the script only adds the spinner and the Android app's return-to-Channels
behaviour. Each door also now says what to do if Meta refuses it.

Guarded by `tests/t-wa-signup.mjs` (26): an empty `featureType` must be the main
button's, coexistence must be its own link, both languages must carry the
button, and the coexistence flavour must never be baked into the shared link
again.

## Was business verification the problem? No.

Two different portfolios matter here, and neither was blocking this:

1. **Ours (the app's).** Per this repo's notes of 2026-09-17: business
   verification *NORAY AFZAL NAHID — Verified*, Tech Provider access
   verification *Verified*, Data Use Checkup complete, **App Mode Live**, and
   `whatsapp_business_messaging`, `whatsapp_business_management` and
   `business_management` all **Approved** with Advanced Access. `WA_CONFIG_ID`
   is set in Vercel for production and preview, so the live Embedded Signup runs
   on the owner's configured Embedded Signup configuration.
   *Not re-checked from this machine — Meta's console needs the owner's login.
   Confirm at* `developers.facebook.com` *→ the app → App Review → Permissions
   and Features, and* `business.facebook.com/settings/security_centre`.
2. **The client's own portfolio** (the one holding the number). Verifying it does
   **not** decide whether a number can be connected. It decides how much the
   number may send afterwards:
   - unverified: **2** business phone numbers, **250** business-initiated
     conversations per rolling 24 hours;
   - verified (and with an approved display name): the cap rises to **20**
     numbers and Tier 1 = **1,000** conversations per 24 hours, then upwards.

   So verification is worth doing before a real shop starts sending — it is not
   what produced this error.

   *To verify:* `business.facebook.com` → **Business settings** → **Security
   Centre** → **Start verification**: legal business name, address, phone and
   website must match a document (in Bangladesh, a trade licence usually does),
   then Meta emails the result.

## What the owner does now

1. Open **Channels → Connect WhatsApp** and press the maroon **Set up with
   Meta**. In Meta's window pick the existing business portfolio, then the
   existing WhatsApp Business account, then the number.
2. Use **Connect my WhatsApp Business app** *only* if that number is live in the
   WhatsApp Business app on a phone.
3. If Meta still refuses the number on the normal path, it is one of these, in
   order of likelihood:
   - the number is already registered on WhatsApp Cloud API somewhere else —
     turn its **two-step verification PIN off** in WhatsApp Manager (or ask the
     current provider to release it), then try again;
   - the number is on the **personal** WhatsApp app — move it to the WhatsApp
     Business app, or delete the WhatsApp account on it first;
   - the number was on a WABA that was deleted recently — Meta holds numbers for
     a **cooldown** period before they can be re-used;
   - a brand-new number is the fastest way past all of the above.

## Master prompt

> In the TellMore AI repo, connecting a WhatsApp number that already exists
> under a Meta business portfolio failed with Meta's "Your phone number isn't
> eligible … More activity on the WhatsApp Business App is needed". Read
> `src/app/api/wa/embedded/route.js`, `src/lib/wa-signup.js` and
> `tests/t-wa-signup.mjs` first. Embedded Signup has two doors: no `featureType`
> = the normal path (new number, or one already in the portfolio),
> `featureType: "whatsapp_business_app_onboarding"` = coexistence, which Meta
> refuses for any number not live in the WhatsApp Business app. The main button
> must use the normal path; coexistence gets its own button inside the
> "WhatsApp Business app" door, in BOTH languages, as a plain `<a href>` that
> works without JavaScript. Verify by rendering
> `/api/wa/embedded?client_id=demo` on the dev server and reading the
> `extras.featureType` out of each link — the main one must be empty. Business
> verification is NOT involved in this error; it only sets messaging limits
> (250/24h and 2 numbers while unverified).
