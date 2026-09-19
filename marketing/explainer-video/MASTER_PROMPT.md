# TellMore AI — product explainer video · master prompt

The owner's brief (2026-09-19), restated as the one document the whole
production follows. Everything below is either a fact verified in the code on
this date or a rule the owner set. Nothing in the video may say something the
product does not do.

## 1. Objective

One marketing video that explains the whole TellMore AI platform — what it is,
how a business starts using it, and every feature it has — in a way that a
shop owner or a service business owner in Bangladesh understands in one
watch and wants to try. It carries the Autolinium credit and contact details.

## 2. Audience

Owners of online shops (Facebook/Instagram sellers, small e-commerce) and
service businesses (agencies, consultants, clinics, coaching) in Bangladesh.
Not developers. They read English; many think in Bangla. Two renders: English
and Bangla, same visuals.

## 3. Non-negotiable rules (from the owner)

1. **Professional, natural-sounding voiceover.** Conversational, warm,
   confident, unhurried. No radio-announcer energy, no hype words.
2. **Motion graphics throughout, with animation on every element and some
   real 3D moments** (extruded 3D logo, channel icons orbiting in 3D, 3D
   device tilts). Nothing static for more than a beat.
3. **No dead air between clips.** One continuous timeline; every scene hands
   over to the next with a transition (wipe, push, morph, crossfade). The
   narration of one scene may start while the previous visual is still
   resolving.
4. **Explain the full product**: what it is, how to set it up, and *every*
   feature (checklist in §6). A feature that is not in the video is a defect.
5. **Say it is an Autolinium product** and show the contact details (§8).
6. **Fantastic and eye-catching**: the owner's Figma palette (maroon), heavy
   sans headlines, real dashboard screens, device mock-ups, particles, depth.
7. **Only true things.** No invented statistics, star ratings, customer
   counts, revenue-lift percentages or "trusted by" logos. The proof is the
   product working on screen. The trial is **3 days**, not 14.

## 4. Brand

- Product: **TellMore AI** · tagline "Conversations that convert" · tellmoreai.com
- Maker: **Autolinium** (say "An Autolinium product")
- Palette (the 2026-09-19 theme): maroon `#7B1C3E`, deep maroon `#5C1430`,
  soft white `#F7F5F7`, white cards `#FFFFFF`, hairline `#ECE6EA`,
  near-black `#121116`, dark-mode accent `#C04A72`, mint `#2ED3A7` = "bot is
  live" and nothing else. Gold `#F4C95D` only for the "Most popular" badge.
- Logo: the friendly robot-bubble mark (`src/lib/brand-mark.js`), plum body
  `#722B4D`, ink `#1E1A1D`, on a white tile.
- Type: Inter 800 for headlines, Inter 400/500 for body, IBM Plex Mono for
  small labels, Hind Siliguri / Anek Bangla for Bangla.

## 5. Structure (19 scenes, ~5½ minutes English)

| # | Scene | What is on screen | Must say |
|---|---|---|---|
| 01 | Hook | 3D message bubbles falling at night; a clock at 12:07 | every missed message is a sale someone else makes |
| 02 | Brand reveal | 3D extruded logo turns into the light; wordmark; "An Autolinium product" | TellMore AI, made by Autolinium |
| 03 | The problem | Four channels flood one owner; questions pile up (price? size? delivery?) | same questions, hundreds of times a day, on four channels |
| 04 | The answer | Channel icons orbit the bot in 3D and dock into one inbox | one assistant, every channel, one inbox, 24/7, Bangla · English · Banglish |
| 05 | Getting started | Sign-up → 3-day trial → **Channels** screen: one-click Facebook, Instagram, WhatsApp (even a new WhatsApp number), website widget → mint "live" | sign up free, connect in one click, no tokens, no developer; several Pages/accounts/numbers |
| 06 | Teach it | **Bot Training** screen: name, greeting, tone, language; the questionnaire (delivery, payment, returns… / services, pricing, process…); later instructions; AI writes the profile | it learns your business in minutes |
| 07 | Your products (shops) | **Inventory** screen + the 8 ways to add: photo, batch of photos, chat interview, website link, CSV, Shopify, WooCommerce, AI Assistant; variants, collection covers, duplicate sweep | every way to add a product; AI reads the photos and writes the details |
| 08 | Your documents & calendar (services) | **Knowledge Base** + **Bookings** screens: PDF/Word/text; Google Calendar free/busy; Meet link; cancel tells the customer | answers from your documents, books meetings for you |
| 09 | The inbox at work | Phone mock: Bangla question → instant reply; several quick messages → one reply; photo → matched product with price and sizes; voice note → answered | replies like a person, in the customer's language; understands photos and voice notes |
| 10 | Orders | Order taken in chat (name, phone, address, size, delivery charge, payment method) → **Orders** screen: statuses Pending→Confirmed→Shipped→Delivered, edit, CSV export; phone + email alert | takes the order inside the chat; no duplicates |
| 11 | Comments | A post comment → public reply + private inbox message; **Comments** screen with both statuses | comments become conversations |
| 12 | Offers & bargaining | Offer cards (end date, linked products), AI rewrite; the three bargaining modes with the hidden floor | offers quoted exactly; bargains like a shopkeeper, never reveals your limit |
| 13 | AI Assistant | **Assistant** screen: "add red saree 2,500, stock 10" → proposal card → Apply; also offers, training, identity | your personal assistant; nothing changes until you press Apply |
| 14 | Human hand-off | Live/Manual switch; "needs a person" alert on bell, phone, email; owner replies from dashboard / Messenger / Business Suite; bot remembers | when a customer needs you, it calls you — and never contradicts what you said |
| 15 | Grow | **Broadcast** (audience by channel, recency, orders/bookings, tag; inside Meta's 24-hour window) and follow-ups (delay + text, sent on a schedule) | reach everyone who wrote recently; remind the ones who went quiet |
| 16 | Analytics | **Analytics** screen: messages, customers new/returning, bot-resolved %, revenue or bookings, busiest hours, topics | see what the bot does for you |
| 17 | Your website & your control | **Website widget** (one line of code); dashboard in English or Bangla; **AI Engine** (your own AI key, lower price); notifications and the Android app | it works on your site too; everything on your phone |
| 18 | Pricing | Two sets side by side: Shop Basic/Pro/Enterprise ৳2,699 / 5,999 / 11,999 and Service Basic/Pro/Enterprise ৳2,299 / 4,999 / 9,999; "every plan has every feature"; launch prices to 31 Dec 2026; yearly = 2 months free; own-key prices lower; bKash / Nagad / card; 3-day free trial, no card | start free, pick a size, pay the way you already pay |
| 19 | Outro | Logo, tellmoreai.com, "An Autolinium product", contact block (§8) | start your free trial today |

## 6. Feature checklist (every item must appear on screen or in narration)

**Bot** 24/7 replies · human-like · Bangla/English/Banglish · voice notes ·
several quick messages → one reply · photo → product match · takes orders in
chat · hands off to a person and alerts the owner · remembers the owner's own
replies · per-chat Live/Manual switch · automatic customer tags.

**Channels** Facebook Messenger · Instagram · WhatsApp (several of each; a
new WhatsApp number created from the dashboard) · website chat widget (one
line of code) · comment automation (public reply + private message).

**Inbox** every channel in one place · send photos and voice notes · search,
filter by channel and tag · notifications on the bell, the phone (Android
app) and email.

**Training** bot name, greeting, tone, languages · questionnaire (shop: 14
questions — delivery, areas, payment, advance, returns, stock, warranty,
hours…; service: 13 — services, pricing, process, timeline, meetings,
contracts, objections…) · later instructions that override · AI-written
business profile · knowledge documents (PDF, Word, text).

**Offers & bargaining** unlimited offers with end dates, linked to products,
auto-expire, quoted exactly · AI rewrite · bargaining: fixed / limited with a
secret maximum / your own rule.

**AI Assistant** answers questions about the business · proposes products,
prices, stock, offers, bargaining, training, identity · applies only on
confirmation.

**Shops** 8 ways to add products · variants (sizes/colours with own prices)
· collection cover images · duplicate finder · orders with statuses, edits,
delivery charge, discount, CSV export.

**Services** knowledge base · Google Calendar booking with Meet link,
free/busy check, cancel notifies the customer · bookings calendar.

**Growth** broadcasts (audience by channel, recency, orders/bookings, tag;
Meta 24-hour window) · follow-ups (delay 1–23 h, own text, scheduled).

**Analytics** messages, customers, conversations, bot-resolved %, revenue or
bookings, busiest hours, channels, topics.

**Account** dashboard in English or Bangla · Android app · own AI key at a
lower price · bKash / Nagad / card · yearly = 2 months free.

**Packages** 3-day free trial (30 replies/day, 1 channel, no card) · Shop
Basic/Pro/Enterprise · Service Basic/Pro/Enterprise · every plan every
feature · launch prices until 31 Dec 2026.

## 7. Narration rules

- Second person, present tense, short sentences. One idea per sentence.
- Name the screen the viewer is looking at ("This is the Inbox").
- Numbers spoken the way people say them ("twenty-six ninety-nine taka").
- Bangla version is written, not translated word for word; same facts.
- Voice: Microsoft Edge neural `en-US-AndrewMultilingualNeural` (English),
  `bn-BD-PradeepNeural` (Bangla), rate −3 %.

## 8. Autolinium credit (outro, and the brand reveal)

An Autolinium product · www.autolinium.com · office@autolinium.com ·
+880 1533 633084 · Chattogram Software Technology Park, Agrabad,
Chattogram 4200, Bangladesh.

## 9. Technical

1920×1080, 30 fps, H.264 (CRF 18, yuv420p) + AAC 192 kbps, MP4 with
faststart. Rendered frame by frame from one seekable timeline (GSAP +
Three.js in Chrome) so every frame is exact and the audio lines up to the
frame. Narration mixed at −1 dB, a soft synthesised ambient bed under it at
about −24 dB with ducking; replaceable by dropping a licensed `music.mp3`
beside the script. Real dashboard screens are captured from the screenshot
studio (`/shots`), so they are the real UI with sample data.

## 10. Deliverables

- `tellmoreai-explainer-en.mp4`, `tellmoreai-explainer-bn.mp4`
- a poster frame for each
- this document, the script, and the generator, committed

## 11. Short ads (added 2026-09-19)

The owner liked the explainer and asked for "3–4 more videos in marketing
style, 40 seconds to 1 minute". Same rules as above (§3, §4, §7, §8), one
message per film, four scenes each, the same outro on every one. Both
languages. Scripts live in `films/<name>/script.json`.

| Film | Message | Scenes |
|---|---|---|
| `midnight` | Every missed message is a sale someone else makes; the assistant answers 24/7 on every channel | hook (12:07 AM) → 3D logo + channel coins → phone demo → outro |
| `photo-to-order` | For shops: a photo finds the product; the order is taken in chat; every way to add products | photo chat → Orders screen → Inventory + 8 ways → outro (Shop from ৳2,699) |
| `book-meetings` | For service businesses: answers from documents; books meetings with a Meet link | Knowledge screen → WhatsApp booking chat → Bookings screen → outro (Service from ৳2,299) |
| `live-in-minutes` | Live in minutes with no developer; teach it; the prices | Channels + 3 steps → Bot Training → price cards → outro |

Acceptance for an ad: 40–60 s in both languages, the price and trial facts
match the pricing page, the Autolinium credit and contacts are legible for
at least 5 s, no black frames, no gaps.

## 12. Acceptance (explainer)

- Every row of §6 is on screen or in the narration (checked off in the script).
- No frame is a plain static image for more than 2 seconds.
- No silence longer than 0.8 s between scenes; no black frames.
- The trial says 3 days everywhere; the prices match the live pricing page.
- Autolinium name and contact block are legible for at least 6 seconds.
