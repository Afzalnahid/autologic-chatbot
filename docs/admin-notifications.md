# What the platform owner is told

Before 2026-09-24 the admin console was silent. Two emails existed in the whole
product (a payment request and a contact form); a business could register, a
bot could stop replying, an AI key could die and a route could start failing,
and nobody was told. Owner: *"From the admin panel I don't get any
notifications when any customer enters or any error occurs or something
happens, it is bad for me."*

## One rule for what lands here

An event earns a line only if the owner could **act** on it, or if it is
**money**. Everything else teaches them to ignore the bell — and then the
urgent ones are lost too.

The catalogue lives in one place, `src/lib/platform-events.js` (`EVENTS`), so
adding an alert is one entry, not a hunt through routes:

`raised?` is whether some code actually calls `logEvent` for that kind yet. The
catalogue is deliberately ahead of the wiring — adding the call later is one
line, and the entry is already reviewed.

| kind | severity | push | email | raised? | when |
| --- | --- | --- | --- | --- | --- |
| `client_signup` | info | yes | no | yes | a business registers |
| `payment_request` | urgent | yes | **yes** | yes | money is waiting for a decision |
| `bot_blocked` | warn | yes | no | yes | a bot stopped replying |
| `key_failing` | warn | yes | no | yes | a client's own AI key stopped working |
| `channel_expired` | warn | yes | no | yes | a channel needs reconnecting |
| `server_error` | urgent | yes | no | yes | a route threw |
| `trial_started` | info | no | no | **not yet** | a trial started |
| `plan_activated` | info | yes | no | **not yet** | a payment was approved |
| `plan_expired` | warn | yes | no | **not yet** | a paid plan ran out |
| `admin_signup` | warn | yes | **yes** | **not yet** | somebody asked for admin access |
| `provider_switched` | warn | yes | no | **not yet** | the platform's AI provider changed |
| `client_deleted` | warn | no | no | **not yet** | a business was deleted |

Every kind reaches the bell — that is what the bell is for. `push` adds the
owner's phone, `email` adds the inbox. Email is spent on two kinds only: money,
and somebody asking for the keys. Severity decides the colour, nothing else.

## A storm collapses into one line

`shouldLog(kind, lastAt, now)` refuses a repeat inside a quiet period:
`server_error` ten minutes, `bot_blocked` / `key_failing` / `channel_expired`
one hour. A route that starts failing fails a lot, and a bell that rings a
thousand times is a bell you switch off. Sign-ups and payments are **never**
suppressed — each one matters on its own.

## Where the events are raised

| what happens | where |
| --- | --- |
| a business registers | `src/app/api/me/route.js` |
| a payment is submitted | `src/app/api/billing/route.js` |
| a route throws | `src/lib/route-errors.js` |
| an AI key dies | `src/lib/ai.js` |
| a bot is blocked | `src/lib/bot.js` |
| a channel expires | `src/app/api/cron/channels/route.js` |

The six kinds marked *not yet* above have no call site. Each is one
`logEvent({...}).catch(() => {})` line where that thing already happens:
`plan_activated` and `plan_expired` in the admin payment approval and the plan
cron, `admin_signup` where an admin row is created, `provider_switched` in the
platform AI switch, `client_deleted` in the admin delete, `trial_started` at
registration.

Every call is `logEvent({...}).catch(() => {})` — fire and forget. A customer's
reply, a signup or a payment must never wait on, or fail because of, a bell.
`route-errors.js` imports the logger **lazily, inside the catch**: it is the
last line of defence and must not become the thing that fails to load.

## How it reaches the owner

1. **The console's bell** — `src/app/admin/AdminBell.js`, reading
   `/api/admin/events`. Unread count on the icon, red when something urgent is
   unread, refreshed every 30s and again whenever the tab comes back. Tapping a
   line opens that business's drawer. Read state is **per admin**
   (`platform_event_reads`), so two people do not clear each other's bell.
2. **The admin app** — `pushToAdmins()` sends the same alert to each admin by
   **email**, through `notifyAdmin()` in `src/lib/admin-push.js`, which reads
   `admin_fcm_tokens` / `admin_push_subscriptions`. The alert always carries
   `url: "/admin"`.

## The admin app is a separate app

For a few hours on 2026-09-24 it was not, and that was a mistake. An alert was
addressed to an admin's own **client id** — an admin usually runs a business
here too — so a new signup or a server error arrived in the same app as that
business's customer messages, and because the alert carried `/admin`, tapping it
turned the user app into the console. The owner: *"my native app which is for
users automatically converted to admin app — the admin app and the user app will
be separated."*

| | User app | Admin app |
| --- | --- | --- |
| Folder | `mobile/` | `mobile-admin/` |
| Package id | `com.tellmoreai.app` | `com.tellmoreai.admin` |
| Opens | `/dashboard` | `/admin` |
| App address | `tellmoreai://` | `tellmoreai-admin://` |
| Notified about | that business's customers | the platform |
| Devices in | `fcm_tokens` (client id) | `admin_fcm_tokens` (email) |
| Built by | Actions → Build Android APK | Actions → Build Admin Android APK |

Different package ids, so both live on one phone without replacing each other.

**The separation is structural, not a rule to remember.** `notify(clientId)` can
only read the client tables and `notifyAdmin(email)` can only read the admin
ones; there is no path from either to the other. On top of that:

- a device registers as an admin device only when the page can prove it is
  running inside the admin app — `src/app/admin/admin-push.js` checks the
  package id is `com.tellmoreai.admin` first, so opening `/admin` in the user
  app or in a browser registers nothing;
- `/api/admin/push` then checks the caller is a signed-in admin with a role;
- the client dashboard has **no** link to `/admin`, and `/api/me` no longer
  reports who is an admin.

Setting the admin app up for the first time — one Firebase step for the owner —
is in [`mobile-admin/README.md`](../mobile-admin/README.md).

## Tests

`tests/t-platform-events.mjs` — the catalogue, the quiet periods, the bell's
arithmetic, that each event is raised where that thing happens, and every one of
the separation rules above.

## Database

- `docs/sql/2026-09-24-platform-events.sql` — `platform_events` and
  `platform_event_reads`.
- `docs/sql/2026-09-24-admin-app-own-notifications.sql` — `admin_fcm_tokens` and
  `admin_push_subscriptions`, the admin app's own devices. **Applied.**
