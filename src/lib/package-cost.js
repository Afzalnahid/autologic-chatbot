// What one package actually costs to run, and what it is worth selling for.
//
// The owner asked for a price built on the real cost "100% accurate". Only one
// part of that can ever be accurate: the COST. Every AI call this platform
// makes records its tokens against a named feature (see usage-features.js), so
// the cost of a customer message is a measurement, not an estimate. The PRICE
// is a business decision; this works out the floor it has to clear and shows
// what is left over.
//
// Three things are deliberately kept apart, because they behave differently:
//
//   BOT      grows with traffic. Every customer message pays for a reply
//            (bot.chat) AND for the search that finds the answer (bot.embed) —
//            the embedding lookup against the catalogue in Supabase. A photo
//            adds bot.vision on top; a voice note adds bot.voice.
//   CATALOGUE is paid ONCE per product or document, not per message. A package
//            that allows 3,000 products carries that cost once, so it is
//            amortised across a year rather than charged every month.
//   PLATFORM is the owner in the dashboard: the AI Assistant, and the calls
//            that describe and index a product as it is added.
//
// Everything here is pure arithmetic over numbers handed in. Nothing reads the
// database; the caller passes measured rates, which is what makes it testable
// and what stops a screen inventing a cost when nothing has been metered yet.

// ── Assumptions, all overridable ───────────────────────────────────────────
//
// These are the only figures here that are NOT measured, so they are collected
// in one place and named, rather than buried in the arithmetic where they would
// read like facts.
export const SHAPE = {
  // How a month of customer messages breaks down. Text is whatever is left.
  imageShare: 0.12,
  voiceShare: 0.04,
  // Messages in one conversation, counting both sides' turns as the meter sees
  // them — only the customer's messages are billed, so this is what converts an
  // allowance into "conversations handled".
  messagesPerConversation: 6,
  // How much of the allowance a typical client on that package really uses.
  // Pricing a package as if every client maxes it out prices a package nobody
  // buys; pricing at half of it is how a platform loses money on its heaviest
  // clients. Both figures are reported.
  typicalUse: 0.55,
  // Photos on one product, and how much of the catalogue allowance is filled.
  photosPerProduct: 3,
  catalogueFill: 0.5,
  // Months to spread the one-off catalogue cost over.
  amortiseMonths: 12,
  // Assistant messages the owner sends in a month.
  assistantMessages: 120,
  // What one human moderator handles in a month: conversations per 8-hour day,
  // 26 days. Deliberately CONSERVATIVE — this number ends up in a sentence
  // shown to a customer, and a claim that flatters us is worse than no claim.
  conversationsPerModeratorDay: 60,
  moderatorDaysPerMonth: 26,
};

// ── Measured rates ─────────────────────────────────────────────────────────
//
// byFeature comes from summarise() in usage.js: { calls, cost, ownKeyCost, … }.
// cost and ownKeyCost are ADDED — a call costs what it costs whoever's key paid
// for it, and a package has to be priced on the whole of it.
//
// A feature nobody has used yet has no rate. It returns null rather than 0, so
// a screen can say "not measured yet" instead of showing a confident free.
export function perCallRates(byFeature = {}) {
  const out = {};
  for (const [id, b] of Object.entries(byFeature || {})) {
    const calls = Number(b?.calls) || 0;
    if (calls <= 0) continue;
    out[id] = ((Number(b.cost) || 0) + (Number(b.ownKeyCost) || 0)) / calls;
  }
  return out;
}

const rate = (rates, id) => (Number.isFinite(rates?.[id]) ? rates[id] : null);
const sum = (...xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => a + b, 0));

// What each kind of customer message costs, in USD.
//
// Every message pays for the search as well as the answer. That was the part
// the old blended figure hid: a shop with 3,000 products pays bot.embed on
// every single message, whether or not the customer asked about a product.
export function messageCosts(rates = {}) {
  const chat = rate(rates, "bot.chat");
  const embed = rate(rates, "bot.embed") ?? 0;   // search is cheap, never absent for long
  const vision = rate(rates, "bot.vision");
  const voice = rate(rates, "bot.voice");
  return {
    text: sum(chat, embed),
    image: sum(chat, embed, vision),
    voice: sum(chat, embed, voice),
    parts: { chat, embed, vision, voice },
  };
}

const clampShare = (n) => Math.min(1, Math.max(0, Number(n) || 0));

// ── One package ────────────────────────────────────────────────────────────
//
// pkg is a row from the plans table (snake_case). Returns null costs rather
// than zeroes wherever nothing has been measured, so "we do not know" and
// "it is free" can never be confused on a screen.
export function packageCost(pkg = {}, rates = {}, shape = {}) {
  const s = { ...SHAPE, ...shape };
  const m = messageCosts(rates);

  // The period's allowance. A trial is metered by the day; everything else by
  // the month. An unlimited package has no ceiling to price, so the caller is
  // told so rather than handed a number built on nothing.
  const perDay = num(pkg.messages_per_day);
  const perMonth = num(pkg.messages_per_month);
  const isTrial = String(pkg.id || "").trim().toLowerCase() === "trial";
  const trialDays = num(pkg.trial_days) ?? 3;
  const allowance = isTrial
    ? (perDay === null ? null : perDay * trialDays)
    : (perMonth ?? (perDay === null ? null : perDay * 30));

  const image = clampShare(s.imageShare);
  const voice = clampShare(s.voiceShare);
  const text = Math.max(0, 1 - image - voice);

  const perMessage = m.text === null ? null
    : text * m.text + image * (m.image ?? m.text) + voice * (m.voice ?? m.text);

  const atFull = allowance === null || perMessage === null ? null : allowance * perMessage;
  const atTypical = atFull === null ? null : atFull * clampShare(s.typicalUse);

  // Catalogue: paid once, spread over a year so a monthly price can carry it.
  const products = num(pkg.max_products);
  const pEmbed = rate(rates, "product.embed") ?? 0;
  const pVision = rate(rates, "product.vision") ?? 0;
  const perProduct = pEmbed + pVision * Math.max(0, Number(s.photosPerProduct) || 0);
  const catalogueOnce = products === null ? null : products * clampShare(s.catalogueFill) * perProduct;
  const catalogueMonthly = catalogueOnce === null ? null
    : catalogueOnce / Math.max(1, Number(s.amortiseMonths) || 1);

  // Platform: the owner's own use of the dashboard.
  const assistantRate = rate(rates, "product.assistant");
  const platformMonthly = assistantRate === null ? null
    : assistantRate * Math.max(0, Number(s.assistantMessages) || 0);

  const totalFull = addOrNull(atFull, catalogueMonthly, platformMonthly);
  const totalTypical = addOrNull(atTypical, catalogueMonthly, platformMonthly);

  // What the package is worth in human terms. Both come off the allowance, so
  // an unlimited package reports null rather than a made-up ceiling.
  const perConv = Math.max(1, Number(s.messagesPerConversation) || 1);
  const conversations = allowance === null ? null : Math.floor(allowance / perConv);
  const modMonth = Math.max(1, (Number(s.conversationsPerModeratorDay) || 1) * (Number(s.moderatorDaysPerMonth) || 1));
  const moderators = conversations === null ? null : conversations / modMonth;

  return {
    allowance, conversations, moderators, moderatorMonth: modMonth,
    perMessage, messages: m,
    bot: { atFull, atTypical },
    catalogue: { once: catalogueOnce, monthly: catalogueMonthly, perProduct },
    platform: { monthly: platformMonthly },
    total: { atFull: totalFull, atTypical: totalTypical },
    // Which of the four message rates were actually measured. A price built on
    // one measured rate and three absent ones is a guess wearing a number.
    measured: Object.entries(m.parts).filter(([, v]) => v !== null).map(([k]) => k),
    unmeasured: Object.entries(m.parts).filter(([, v]) => v === null).map(([k]) => k),
  };
}

// The lowest price that keeps AI at or under `share` of revenue, in BDT.
// Rounded UP to the nearest 100 taka: a price is a thing people read, and a
// floor rounded down is not a floor.
export function floorPrice(costUsd, rateBdt, share = 0.3) {
  if (!Number.isFinite(costUsd) || !Number.isFinite(rateBdt)) return null;
  const s = Math.min(0.95, Math.max(0.01, Number(share) || 0.3));
  return Math.ceil((costUsd * rateBdt) / s / 100) * 100;
}

// Margin on a price that is already set: what is left after AI, as a share.
export function marginAt(priceBdt, costUsd, rateBdt) {
  const price = Number(priceBdt) || 0;
  if (price <= 0 || !Number.isFinite(costUsd) || !Number.isFinite(rateBdt)) return null;
  return (price - costUsd * rateBdt) / price;
}

function num(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function addOrNull(...xs) {
  if (xs.every((x) => x === null)) return null;
  return xs.reduce((a, b) => a + (b === null ? 0 : b), 0);
}
