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
2. **The phone** — `pushToAdmins()` sends the same alert through each admin's
   *own* client id, so it uses the push plumbing the clients already have
   (`src/app/dashboard/components/native-push.js` in the Android app, `public/sw.js`
   in the browser). The alert always carries `url: "/admin"`.

## No separate admin app is needed

Owner, 2026-09-24: *"Should I need an admin app like the TellMore AI user app?"*
No — the existing app **is** the admin app, because:

- the Capacitor shell only sets `/dashboard` as its **start** URL
  (`mobile/capacitor.config.json`); it does not restrict navigation, so
  `/admin` opens inside the same WebView;
- both notification handlers open the url the alert carries, and an admin alert
  carries `/admin` — so tapping one lands straight in the console;
- `src/app/admin/admin-client.js` already adapts to a phone (dozens of
  `isMobile` branches);
- and the sidebar now shows a shield button into `/admin`, but only when
  `/api/me` reports `is_admin` — so an admin can reach the console without
  waiting for a notification.

`is_admin` grants nothing by itself. Every privileged action is guarded where
it is done (`callerEmail` / `callerRole` in `src/lib/admin-auth.js`); the flag
only decides whether a door is drawn.

## Tests

`tests/t-platform-events.mjs` — the catalogue, the quiet periods, the bell's
arithmetic, that each event is raised where that thing happens, and the three
things the "no separate admin app" answer depends on.

## Database

`docs/sql/2026-09-24-platform-events.sql` — `platform_events` and
`platform_event_reads`.
