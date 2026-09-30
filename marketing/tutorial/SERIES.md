# TellMore AI tutorial series

Owner's brief (2026-09-30): professional motion-graphics how-to videos for
every step, tab and feature, plus one on how the whole system works; Bangla and
English; desktop (16:9) and phone (9:16); Autolinium's marks on every video.
Each video is one script in `scripts/`, built by `node build.mjs <id>` into
`Claude outputs/Tutorials/<Bangla|English>/<Desktop|Mobile>/`.

Screens come from the local screenshot studio (the real dashboard components,
sample shop "Nokshi Threads", nothing reaches the live database). Parts the
studio cannot show for real — Meta's and Google's own login windows, the
confirmation email — are drawn as clearly generic illustrations.

| # | Video | What it covers |
|---|---|---|
| 00 | How TellMore AI works | The whole system: channels in, the bot's knowledge (products, documents, training), what it does (answers, orders, bookings, hand-off), the dashboard; the rules (24-hour window, what counts as a reply) |
| 01 | Create your account | Sign up, confirm email, sign in; "the rest of the setup can be done now or later" |
| 02 | First setup | Business profile, teaching the bot, free trial; skipping and doing it later from Profile and Bot Training |
| 03 | Connect your channels | Why a channel is needed and how messages flow; Facebook Page, Instagram, WhatsApp; the Channels tab: live/paused, comment automation, disconnect, add more |
| 04 | Chat on your own website | The website widget: create it, paste one line, allowed sites |
| 05 | Dashboard tour | The menu and its groups, Overview's cards, search, notifications, language, phone layout |
| 06 | Inbox | Reading chats, replying yourself, take over / hand back, "Needs you", tags, the bot switch |
| 07 | Comment auto-reply | Turning it on, public reply + private message, what "needs attention" means |
| 08 | Orders | How the bot records an order, statuses, the order drawer, export |
| 09 | Products | Adding a product step by step: details, photos, variants, preview; editing, stock, hiding |
| 10 | Many products at once | From photos, from a spreadsheet, from a link / WooCommerce / Shopify |
| 11 | AI Assistant | Running the dashboard by talking to it |
| 12 | Bot Training | Train, offers, bargaining, behaviour, follow-ups, guardrails |
| 13 | Knowledge Base (services) | Uploading documents and how the bot answers from them |
| 14 | Bookings & Google Calendar (services) | How the bot books meetings, the calendar, connecting Google |
| 15 | Broadcast | Messaging recent customers, the 24-hour rule, checking the audience |
| 16 | Analytics | What each number and chart means |
| 17 | Billing & packages | Plans, usage, paying with bKash / Nagad |
| 18 | Profile & notifications | Business details, logo, phone notifications |
| 19 | AI Engine | Using your own AI key, what happens if it fails |

Rules the narration must get right (from the code, 2026-09-30): only the bot's
replies count toward a package (the owner's own replies and customer messages
never do); Meta allows messages only within 24 hours of the customer's last
one (broadcasts skip the rest, follow-ups wait at most 23 hours); every package
has every feature and unlimited channels — packages differ by size; prices and
limits are the ones in `src/lib/plans.js`.
