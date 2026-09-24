# The admin app

A second Android app, separate from the one in [`../mobile`](../mobile). It
opens `https://www.tellmoreai.com/admin` in its own WebView and receives the
platform's alerts — new business, payment waiting, a bot that stopped, a server
error. Nothing a client sees ever reaches it.

Owner, 2026-09-24: *"my native app which is for users automatically converted to
admin app — the admin app and the user app will be separated. There will be two
separated apps, one is for user where the user notification comes, and an admin
app where the admin panel notifications come."*

| | User app (`mobile/`) | Admin app (`mobile-admin/`) |
| --- | --- | --- |
| Package id | `com.tellmoreai.app` | `com.tellmoreai.admin` |
| Name on the phone | TellMore AI | TellMore AI Admin |
| Opens | `/dashboard` | `/admin` |
| Icon | mark on the brand maroon | mark on the **deep** maroon `#5C1430` |
| App address | `tellmoreai://` | `tellmoreai-admin://` |
| Notifications | that business's customers | the platform |
| Device stored in | `fcm_tokens` (by client id) | `admin_fcm_tokens` (by email) |

The two package ids are different, so both install side by side and neither
replaces the other.

## How the separation is enforced

Not by a rule anybody has to remember — by the tables:

- `notify(clientId)` reads `fcm_tokens` / `push_subscriptions` and can only
  reach a client's devices.
- `notifyAdmin(email)` (`src/lib/admin-push.js`) reads `admin_fcm_tokens` /
  `admin_push_subscriptions` and can only reach an admin's.
- A device registers as an admin device only when the page can prove it is
  running inside **this** app: `src/app/admin/admin-push.js` checks the package
  id is `com.tellmoreai.admin` before it sends the token. Opening `/admin` in the
  user app, or in a phone browser, registers nothing.
- `/api/admin/push` then checks the caller is a signed-in admin with a role.
- The client dashboard has no link to `/admin` at all, and `/api/me` no longer
  says who is an admin.

`tests/t-platform-events.mjs` asserts every one of those, so none of it can be
undone by accident.

## Building it

**GitHub → Actions → "Build Admin Android APK" → Run workflow.** The APK comes
out as the artifact `tellmoreai-admin-android-apk`. Debug-signed, so it installs
by sideloading exactly like the user app.

Web changes reach it by themselves — it loads the live site. Only the shell
(icon, name, start url, plugins, permissions) needs a rebuild.

## Firebase — done (2026-09-24)

`google-services.json` is in place: project `getvoicium` (`869664348441`), the
same one the user app uses, with `com.tellmoreai.admin` registered inside it
(app id `1:869664348441:android:6d1224c01df4c1062d8d88`).

No new service account was needed — `FIREBASE_SERVICE_ACCOUNT` on Vercel covers
the whole project and sends to both apps. `tests/t-two-apps.mjs` checks the file
lists the admin package and belongs to the same project, so a config from the
wrong project cannot ship quietly.

Committing this file is deliberate and safe: it holds no secret (the key in it
is an Android client key, tied to the package name), and the user app's copy has
been in this public repo since the first build.

If the app is ever re-registered, replace the file and keep the package name
exactly `com.tellmoreai.admin`.

## Turning notifications on

Open the admin app, sign in, and it registers this device by itself the first
time Android has already granted the permission. If it has not, the console's
bell asks. The console in a laptop browser uses ordinary Web Push through the
same endpoint.
