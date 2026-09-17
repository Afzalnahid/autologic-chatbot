// Every AI call this platform makes, what triggers it, what it costs, and what
// a package costs when a customer uses it to the limit.
//
//   node scripts/ai-cost-model.mjs            the report
//   node scripts/ai-cost-model.mjs --sites    the call-site audit only
//   node scripts/ai-cost-model.mjs --json     the numbers, for the admin panel
//
// WHERE THE NUMBERS COME FROM
// Every AI call reports its tokens into usage_daily (src/lib/usage.js). The
// per-call figures marked `measured` are the real averages from that table on
// 2026-09-18 — mostly Broker's BD, the only account with a month of ordinary
// traffic (1,345 customer messages, 174 with a photo, 39 voice notes). The ones
// marked `estimated` have never run in production; their numbers come from the
// prompt the code actually sends, and they say so on every line.
//
//   select feature, sum(calls) calls,
//          round(sum(tokens_in)::numeric/sum(calls)) tin,
//          round(sum(tokens_out)::numeric/sum(calls)) tout
//   from usage_daily group by 1 order by calls desc;
//
// ONE RULE FOR THIS FILE: if a call site exists in the code it must appear in
// SITES below, even when it costs nothing. A missing line is a wrong report.

const args = new Set(process.argv.slice(2));
const USD_BDT = Number(process.env.USD_BDT) || 123.11; // live mid-market, 2026-09-18

// ── The price book ──────────────────────────────────────────────────────────
// USD per million tokens. gemini-3.6-flash is what the chain actually runs
// (src/lib/gemini.js MODEL_CHAIN); its introductory rate holds to 2026-12-31
// and doubles on 2027-01-01, so both are carried.
export const PRICES = {
  "gemini-3.6-flash":      { in: 0.75, out: 3.75 },
  "gemini-3.6-flash-2027": { in: 1.50, out: 7.50 },
  "gemini-2.5-flash":      { in: 0.30, out: 2.50 },
  "gemini-embedding-001":  { in: 0.15, out: 0.00 },
};
const EMBED = "gemini-embedding-001";

// ── Every AI call site in the project ───────────────────────────────────────
// area:    bot (runs by itself on a customer message) · catalogue (paid once
//          per product or document) · platform (a button the owner presses)
// where:   the file that makes the call
// trigger: what has to happen for it to run
// per:     what one call covers
// src:     measured | estimated — and estimated says from what
export const SITES = [
  { id: "bot.chat", area: "bot", label: "The reply itself", model: "flash",
    where: "src/lib/bot.js composeReply → ai.chat", trigger: "every bot reply (several quick customer messages are debounced into one)",
    per: "one reply", in: 7718, out: 248, src: "measured", metered: true },

  { id: "bot.embed", area: "bot", label: "Finding the answer", model: "embed",
    where: "src/lib/bot.js searchProducts / src/lib/knowledge.js searchKnowledge", trigger: "every reply — products for a shop, knowledge for a service business",
    per: "one reply", in: 34, out: 0, src: "measured", metered: true },

  { id: "bot.vision", area: "bot", label: "Reading a customer photo", model: "flash",
    where: "src/lib/bot.js processConversation", trigger: "every photo a customer sends — ALSO while the bot is switched off",
    per: "one photo", in: 1230, out: 123, src: "measured", metered: true },

  { id: "bot.voice", area: "bot", label: "Transcribing a voice note", model: "flash",
    where: "src/lib/bot.js processConversation", trigger: "every voice note — ALSO while the bot is switched off",
    per: "one voice note", in: 437, out: 38, src: "measured", metered: true },

  { id: "bot.language", area: "bot", label: "Language rewrite", model: "flash",
    where: "src/lib/bot.js enforceLanguage", trigger: "when the reply came back in the wrong language — 30% of replies, measured",
    per: "one rewrite", in: 240, out: 29, src: "measured", metered: "mostly", rate: 0.30,
    note: "the fallback path (bot.js:805, when the client's AI config cannot be read) calls Gemini WITHOUT a meter — a small hole in the report" },

  { id: "bot.tag", area: "bot", label: "Auto-tagging a conversation", model: "flash",
    where: "src/lib/tags.js applyAutoTag", trigger: "when the word rules cannot label it — 23% of replies, measured",
    per: "one conversation", in: 89, out: 2, src: "measured", metered: true, rate: 0.23 },

  { id: "bot.comment", area: "bot", label: "Answering a public comment", model: "flash",
    where: "src/lib/bot.js handleComment", trigger: "a comment on a post, when comment automation is on",
    per: "one comment", in: 4723, out: 36, src: "measured", metered: true },

  { id: "product.vision", area: "catalogue", label: "Describing a product photo", model: "flash",
    where: "src/lib/products.js describeImage(s) · add-product · import-one · import-url · photo-draft", trigger: "every photo on a product, including each variant's own picture",
    per: "one photo", in: 1226, out: 142, src: "measured", metered: true },

  { id: "product.embed", area: "catalogue", label: "Indexing a product", model: "embed",
    where: "src/lib/products.js embedProduct · import-one · import-url · inventory-apply", trigger: "every time a product is saved or edited",
    per: "one product row", in: 321, out: 0, src: "measured", metered: true },

  { id: "product.interview", area: "catalogue", label: "Adding a product by chat", model: "flash",
    where: "src/app/api/product-interview", trigger: "each question the panel asks while building one product",
    per: "one question", in: 936, out: 48, src: "measured", metered: true },

  { id: "product.catalog", area: "catalogue", label: "Naming a batch of photos", model: "flash",
    where: "src/app/api/photo-draft", trigger: "once for a whole batch of uploaded photos",
    per: "one batch", in: 574, out: 127, src: "measured", metered: true },

  { id: "product.group", area: "catalogue", label: "Grouping photos into products", model: "flash",
    where: "src/app/api/photo-group", trigger: "once per batch, deciding which pictures are the same product",
    per: "one batch", in: 754, out: 32, src: "measured", metered: true },

  { id: "product.scrape", area: "catalogue", label: "Reading a website page", model: "flash",
    where: "src/lib/gemini.js extractProductsFromUrl ← src/app/api/import-url", trigger: "the owner imports a shop page by URL",
    per: "one page (15,000 characters of HTML)", in: 4500, out: 1500, src: "estimated — 15,000 chars of HTML ≈ 4,500 tokens in, a JSON array of products out", metered: true },

  { id: "knowledge.embed", area: "catalogue", label: "Indexing a document", model: "embed",
    where: "src/lib/knowledge.js ingestFile", trigger: "an uploaded file, once per 1,200-character chunk",
    per: "one chunk", in: 300, out: 0, src: "estimated — chunkText() cuts at 1,200 characters ≈ 300 tokens", metered: true },

  { id: "product.assistant", area: "platform", label: "AI Assistant chat", model: "flash",
    where: "src/app/api/inventory-chat", trigger: "every message the owner sends the assistant",
    per: "one owner message", in: 1736, out: 217, src: "measured", metered: true },

  { id: "platform.prompt", area: "platform", label: "Writing the bot profile", model: "flash",
    where: "src/app/api/generate-prompt", trigger: "the Generate-with-AI button in Bot Training",
    per: "one press", in: 900, out: 400, src: "estimated — the META prompt plus the owner's answers", metered: true },

  { id: "platform.offer", area: "platform", label: "Polishing an offer", model: "flash",
    where: "src/app/api/offer-rewrite", trigger: "the Polish button on an offer",
    per: "one press", in: 300, out: 150, src: "estimated — a short META prompt and one offer", metered: true },

  { id: "free.models", area: "platform", label: "Listing the models on a key", model: null,
    where: "src/lib/gemini.js listGoogleModels ← api/ai-key, model-catalog", trigger: "saving or checking an AI key",
    per: "one call", in: 0, out: 0, src: "no tokens — a catalogue listing, free", metered: false },
];

const modelOf = (s) => (s.model === "embed" ? EMBED : s.model === "flash" ? "gemini-3.6-flash" : null);
const priceKey = (s, rate) => (s.model === "embed" ? EMBED : rate);
export const callCost = (s, rate = "gemini-3.6-flash") => {
  const p = PRICES[priceKey(s, rate)];
  return p ? (s.in / 1e6) * p.in + (s.out / 1e6) * p.out : 0;
};
const site = (id) => SITES.find((s) => s.id === id);
const cost = (id, rate) => callCost(site(id), rate);

// ── What one customer message costs ─────────────────────────────────────────
// A reply is always the answer plus one search, plus tagging and the language
// rewrite at the rate they really happen. A photo or a voice note is an extra
// call on top; a message can carry several photos.
export function perMessage(rate) {
  const reply = cost("bot.chat", rate) + cost("bot.embed", rate)
    + site("bot.tag").rate * cost("bot.tag", rate)
    + site("bot.language").rate * cost("bot.language", rate);
  return {
    text: reply,
    photo: reply + cost("bot.vision", rate),
    voice: reply + cost("bot.voice", rate),
    comment: cost("bot.comment", rate) + cost("bot.embed", rate),
    // Bot switched off: nothing is answered, but a photo is still read and a
    // voice note still transcribed so the owner can read them in the inbox.
    offPhoto: cost("bot.vision", rate),
    offVoice: cost("bot.voice", rate),
    offText: 0,
  };
}

// ── What one product costs ──────────────────────────────────────────────────
export function perProduct(rate, { photos = 2, variants = 3, questions = 4 } = {}) {
  const embed = variants * cost("product.embed", rate);
  return {
    byPhoto: photos * cost("product.vision", rate) + (cost("product.catalog", rate) + cost("product.group", rate)) / 10 + embed,
    byChat: questions * cost("product.interview", rate) + photos * cost("product.vision", rate) + embed,
    bySheet: embed,
    byWebsite: cost("product.scrape", rate) / 20 + photos * cost("product.vision", rate) + embed,
  };
}

// ── A package used to its limit ─────────────────────────────────────────────
// messages: plans.messages_per_month (the trial's 30/day → 900).
// products / kbFiles: plans.max_products / max_kb_files; null is uncapped, so a
// working ceiling is used and marked.
const TRIAL_DAYS = 3;              // plans.js TRIAL_DAYS
// A month is 28, 30 or 31 days, and anything charged per DAY changes with it.
// The monthly message allowances do not — plans.messages_per_month is a month,
// whatever its length — so only the daily things move. Run with DAYS=31 to see
// the long month.
const DAYS = Number(process.env.DAYS) || 30;

const PACKAGES = [
  // The trial is THREE DAYS at 30 messages a day — not a month. Treating it as
  // a month overstated it by a factor of ten (owner, 2026-09-18).
  { id: "trial",        name: "Free Trial (3 days)", price: 0, messages: TRIAL_DAYS * 30, products: 20, kbFiles: 2, days: TRIAL_DAYS },
  { id: "shop_starter", name: "Shop Starter",    price: 1500, messages: 3000,  products: 300,   kbFiles: 0 },
  { id: "svc_starter",  name: "Service Starter", price: 1500, messages: 3000,  products: 0,     kbFiles: 10 },
  { id: "shop_growth",  name: "Shop Growth",     price: 3500, messages: 15000, products: 3000,  kbFiles: 0 },
  { id: "svc_growth",   name: "Service Growth",  price: 3500, messages: 15000, products: 0,     kbFiles: 40 },
  { id: "shop_scale",   name: "Shop Scale",      price: 6000, messages: 50000, products: 10000, kbFiles: 0, capNote: "uncapped — 10,000 assumed" },
  { id: "svc_scale",    name: "Service Scale",   price: 6000, messages: 50000, products: 0,     kbFiles: 100, capNote: "uncapped — 100 files assumed" },
];

// Three ways to reach the limit.
//   quiet — every message plain text: the cheapest a full package can be
//   real  — the mix Broker's BD actually sends: 13% photos, 3% voice
//   worst — every message carries a photo AND a voice note
const MIXES = { quiet: { photo: 0, voice: 0 }, real: { photo: 0.13, voice: 0.03 }, worst: { photo: 1, voice: 1 } };

// The owner's own use, per month, at the top of what anyone does by hand.
const OWNER_MONTH = { assistant: 200, prompt: 5, offer: 10 };
// Comments, as a share of replies: a busy shop answers one comment per ten DMs.
const COMMENT_RATE = 0.10;
// Messages that arrive while the bot is OFF, as a share of the allowance.
const OFF_SHARE = 0.20;
const CHUNKS_PER_FILE = 30;

export function packageCost(pkg, mix, rate) {
  const m = perMessage(rate);
  const perMsg = m.text + MIXES[mix].photo * (m.photo - m.text) + MIXES[mix].voice * (m.voice - m.text);
  const messages = pkg.messages * perMsg;
  const comments = pkg.messages * COMMENT_RATE * m.comment;
  // While the bot is off nothing is answered, but photos and voice notes are
  // still read. Charged on top of the allowance: these never become replies.
  const botOff = pkg.messages * OFF_SHARE * (MIXES[mix].photo * m.offPhoto + MIXES[mix].voice * m.offVoice);
  const owner = OWNER_MONTH.assistant * cost("product.assistant", rate)
    + OWNER_MONTH.prompt * cost("platform.prompt", rate)
    + OWNER_MONTH.offer * cost("platform.offer", rate);
  const monthly = messages + comments + botOff + owner;

  // One-off: filling the catalogue and the knowledge base to the cap.
  const products = pkg.products ? pkg.products * perProduct(rate).byPhoto : 0;
  const knowledge = pkg.kbFiles ? pkg.kbFiles * CHUNKS_PER_FILE * cost("knowledge.embed", rate) : 0;
  return { perMsg, messages, comments, botOff, owner, monthly, products, knowledge, setup: products + knowledge };
}

// ── Output ──────────────────────────────────────────────────────────────────
const bdt = (n) => `৳${(n * USD_BDT).toLocaleString("en-IN", { maximumFractionDigits: n * USD_BDT < 100 ? 2 : 0 })}`;
const d = (n) => `$${n.toFixed(4)}`;
const pad = (s, n) => String(s).padEnd(n);

const report = {};
for (const rate of ["gemini-3.6-flash", "gemini-3.6-flash-2027"]) {
  report[rate] = {
    perMessage: perMessage(rate),
    perProduct: perProduct(rate),
    sites: SITES.map((s) => ({ ...s, model: modelOf(s), usd: callCost(s, rate), bdt: callCost(s, rate) * USD_BDT })),
    packages: PACKAGES.map((p) => ({
      ...p,
      quiet: packageCost(p, "quiet", rate), real: packageCost(p, "real", rate), worst: packageCost(p, "worst", rate),
    })),
  };
}

if (args.has("--json")) {
  console.log(JSON.stringify({ usdBdt: USD_BDT, prices: PRICES, assumptions: { MIXES, OWNER_MONTH, COMMENT_RATE, OFF_SHARE, CHUNKS_PER_FILE }, report }, null, 2));
  process.exit(0);
}

const rate = "gemini-3.6-flash";
console.log(`\nAI COST AUDIT — ${SITES.length} call sites · ${rate} at $${PRICES[rate].in}/$${PRICES[rate].out} per 1M · $1 = ৳${USD_BDT}\n`);

console.log("EVERY PLACE THE PLATFORM CALLS AN AI");
console.log(`  ${pad("what", 30)} ${pad("per", 22)} ${pad("in", 7)} ${pad("out", 6)} ${pad("cost", 10)} source`);
for (const areaId of ["bot", "catalogue", "platform"]) {
  console.log(`  — ${areaId.toUpperCase()}`);
  for (const s of report[rate].sites.filter((x) => x.area === areaId)) {
    console.log(`  ${pad(s.label, 30)} ${pad(s.per, 22)} ${pad(s.in, 7)} ${pad(s.out, 6)} ${pad(d(s.usd), 10)} ${s.src.split(" —")[0]}${s.metered === true ? "" : s.metered === false ? " · not metered (free)" : " · partly metered"}`);
  }
}

if (args.has("--sites")) process.exit(0);

const m = report[rate].perMessage, pr = report[rate].perProduct;
console.log("\nONE CUSTOMER MESSAGE");
for (const [k, v] of [["text only", m.text], ["with one photo", m.photo], ["with a voice note", m.voice], ["a public comment", m.comment],
  ["BOT OFF — photo", m.offPhoto], ["BOT OFF — voice", m.offVoice], ["BOT OFF — text", m.offText]])
  console.log(`  ${pad(k, 22)} ${pad(d(v), 10)} ${bdt(v)}`);

console.log("\nONE PRODUCT (2 photos, 3 variants)");
for (const [k, v] of [["added by photo", pr.byPhoto], ["added by chat", pr.byChat], ["imported from a sheet", pr.bySheet], ["imported from a website", pr.byWebsite]])
  console.log(`  ${pad(k, 22)} ${pad(d(v), 10)} ${bdt(v)}`);

console.log("\nA PACKAGE USED TO ITS LIMIT — every month");
console.log(`  ${pad("package", 16)} ${pad("price", 9)} ${pad("replies", 8)} ${pad("quiet", 11)} ${pad("real mix", 11)} ${pad("worst", 11)} one-off catalogue`);
for (const p of report[rate].packages) {
  console.log(`  ${pad(p.name, 16)} ${pad("৳" + p.price, 9)} ${pad(p.messages, 8)} ${pad(bdt(p.quiet.monthly), 11)} ${pad(bdt(p.real.monthly), 11)} ${pad(bdt(p.worst.monthly), 11)} ${p.real.setup > 0 ? bdt(p.real.setup) : "—"}`);
}

console.log("\nWHERE THE MONEY GOES — Shop Growth at its limit, real mix");
const g = report[rate].packages.find((p) => p.id === "shop_growth").real;
for (const [k, v] of [["replies (15,000)", g.messages], ["comment replies", g.comments], ["photos/voice while the bot is off", g.botOff], ["the owner's own AI use", g.owner]])
  console.log(`  ${pad(k, 34)} ${pad(bdt(v), 11)} ${((v / g.monthly) * 100).toFixed(0)}%`);
console.log(`  ${pad("TOTAL", 34)} ${bdt(g.monthly)}   against a ৳3,500 package`);

console.log(`\nASSUMPTIONS: comments = ${COMMENT_RATE * 100}% of replies · ${OFF_SHARE * 100}% of traffic arrives while the bot is off · owner: ${OWNER_MONTH.assistant} assistant messages, ${OWNER_MONTH.prompt} profile writes, ${OWNER_MONTH.offer} offer polishes a month · a knowledge file = ${CHUNKS_PER_FILE} chunks.\n`);

// ── Levers: what each change to the prompt saves, and what it risks ─────────
// Run: node scripts/ai-cost-model.mjs --levers
//
// The reply call is 7,718 input tokens. Measured composition for Broker's BD
// (the one account with a month of traffic):
//   FIXED_BASE + FIXED_ECOM          8,636 chars ≈ 2,159 tokens — identical on every call, for every shop
//   business profile + greeting      1,877 chars ≈   470 tokens — identical for that client until they edit it
//   order/booking rule + time + lock ~1,100 chars ≈   275 tokens — fixed text, but it sits AFTER the variable part today
//   search results (3–4 products)                  ≈ 1,200–1,600 — changes every message
//   history (10 turns × ~104 chars)                ≈   260       — changes every message
//   the rest (product metadata JSON, category overview)          — changes every message
// So ~2,900 tokens (38%) are the same on call after call.
export const LEVERS = [
  { id: "cache", name: "Let Gemini cache the fixed part",
    how: "Gemini discounts a repeated prompt PREFIX by 90% on its own (implicit caching, 2.5+ models, minimum 2,048 tokens). Ours qualifies on size, but the fixed text must come first and stay byte-identical.",
    saves: 0.90 * 2900, unit: "input tokens", risk: "none — the model sees exactly the same prompt",
    work: "measure it first: record cachedContentTokenCount (usageMetadata) so the report shows whether a call hit the cache" },

  { id: "order", name: "Put the variable part last",
    how: "The system instruction is built systemPrompt + context + who + rules + lock — search results (different every message) sit in the middle of otherwise fixed text, which cuts the cacheable prefix short. Moving the search results and the customer's name to the user turn makes the whole fixed block one stable prefix.",
    saves: 0.90 * 750, unit: "input tokens", risk: "low — same words, different slot; needs a side-by-side reply check before it ships",
    work: "one change in composeReply, plus the reply tests" },

  { id: "products", name: "Send the product fields the bot needs",
    how: "Each search result goes in as its whole metadata JSON (~390 tokens each). Name, code, price, variants, stock and image are what the reply uses; long descriptions and internal fields are not.",
    saves: 600, unit: "input tokens", risk: "low — a shorter product block, same facts; watch that photo-matching answers stay as good",
    work: "trim the JSON in composeReply's context builder" },

  { id: "history", name: "Carry six turns instead of ten",
    how: "getMemory() reads the last 10 turns. Six covers the ordinary back-and-forth; the order and booking rules carry the rest.",
    saves: 105, unit: "input tokens", risk: "medium — a long haggling conversation could lose an early detail. Worth testing on real transcripts before changing.",
    work: "one number in getMemory, and a read of real conversations first" },

  { id: "router", name: "A cheaper model for the simple questions",
    how: "\"দাম কত\", \"স্টকে আছে?\", \"ডেলিভারি চার্জ?\" are most messages and need no reasoning. gemini-2.5-flash-lite is $0.10/$0.40 against $0.75/$3.75.",
    saves: 0, unit: "—", risk: "medium — the router must never send a real conversation to the small model; keep photos, orders and bookings on the big one",
    work: "a router in composeReply plus tests; do this last, after the free wins" },
];

if (args.has("--levers")) {
  const base = perMessage("gemini-3.6-flash").text;
  const p = PRICES["gemini-3.6-flash"];
  let input = SITES.find((s) => s.id === "bot.chat").in;
  console.log(`\nCOST LEVERS — one reply starts at ${d(base)} (৳${(base * USD_BDT).toFixed(2)}), ${input} input tokens\n`);
  let running = base;
  for (const l of LEVERS) {
    const saved = (l.saves / 1e6) * p.in;
    running -= saved;
    console.log(`  ${pad(l.name, 42)} −${pad(l.saves ? Math.round(l.saves) + " tok" : "model swap", 14)} → ${pad(d(running), 10)} ৳${(running * USD_BDT).toFixed(2)}`);
    console.log(`     risk: ${l.risk}`);
  }
  const routed = running * 0.6 + (running * 0.4) * (0.10 / 0.75);
  console.log(`\n  after the first four: ${d(running)} (৳${(running * USD_BDT).toFixed(2)}) — ${Math.round((1 - running / base) * 100)}% off`);
  console.log(`  with the router too:  ${d(routed)} (৳${(routed * USD_BDT).toFixed(2)}) — ${Math.round((1 - routed / base) * 100)}% off`);
  console.log(`\n  Growth at its limit would fall from ৳13,772 to about ৳${Math.round(13772 * routed / base).toLocaleString("en-IN")} a month.\n`);
}


// ── Before and after the 2026-09-18 changes ────────────────────────────────
//   node scripts/ai-cost-model.mjs --after
//
// Three profiles, so a decision can be made on the range rather than one
// hopeful number:
//   before    what the reply cost until 2026-09-18
//   trimmed   the product trim alone — certain, it is just fewer characters
//   cached    the trim plus Gemini reusing the fixed prefix at a tenth of the
//             rate. NOT yet confirmed in production: implicit caching needs
//             similar requests close together, and a quiet account may miss it.
//             usage_daily.tokens_cached will say (it was added the same day).
//
// The chat call is the only line that changes; everything else — vision, voice,
// tagging, the catalogue, the owner's tools — is untouched.
export const PROFILES = {
  before:  { chatIn: 7718, cached: 0,    note: "as measured before the change" },
  trimmed: { chatIn: 5702, cached: 0,    note: "product rows trimmed (3,888 → ~1,200 chars each, 3 per reply)" },
  cached:  { chatIn: 5702, cached: 3000, note: "trimmed, and Gemini reusing the ~3,000-token fixed prefix at 10%" },
};

// Cost of the chat call under one profile, at the flash rate.
function chatCost(profile, rate = "gemini-3.6-flash") {
  const p = PRICES[rate], s = SITES.find((x) => x.id === "bot.chat");
  const fresh = Math.max(0, profile.chatIn - profile.cached);
  return (fresh / 1e6) * p.in + (profile.cached / 1e6) * p.in * 0.10 + (s.out / 1e6) * p.out;
}

function profileMessage(profile, rate = "gemini-3.6-flash") {
  const reply = chatCost(profile, rate) + cost("bot.embed", rate)
    + site("bot.tag").rate * cost("bot.tag", rate)
    + site("bot.language").rate * cost("bot.language", rate);
  return { text: reply, photo: reply + cost("bot.vision", rate), voice: reply + cost("bot.voice", rate),
    comment: cost("bot.comment", rate) + cost("bot.embed", rate),
    offPhoto: cost("bot.vision", rate), offVoice: cost("bot.voice", rate), offText: 0 };
}

// The whole monthly bill for a package at its limit, under one profile.
function profilePackage(pkg, profile, mix = "real", rate = "gemini-3.6-flash") {
  const m = profileMessage(profile, rate);
  const per = m.text + MIXES[mix].photo * (m.photo - m.text) + MIXES[mix].voice * (m.voice - m.text);
  const messages = pkg.messages * per;
  const comments = pkg.messages * COMMENT_RATE * m.comment;
  const botOff = pkg.messages * OFF_SHARE * (MIXES[mix].photo * m.offPhoto + MIXES[mix].voice * m.offVoice);
  const owner = OWNER_MONTH.assistant * cost("product.assistant", rate)
    + OWNER_MONTH.prompt * cost("platform.prompt", rate) + OWNER_MONTH.offer * cost("platform.offer", rate);
  const products = pkg.products ? pkg.products * perProduct(rate).byPhoto : 0;
  const knowledge = pkg.kbFiles ? pkg.kbFiles * CHUNKS_PER_FILE * cost("knowledge.embed", rate) : 0;
  return { per, messages, comments, botOff, owner, monthly: messages + comments + botOff + owner,
    setup: products + knowledge };
}

if (args.has("--after")) {
  const rate = "gemini-3.6-flash";
  console.log(`
BEFORE AND AFTER — ${rate} · $1 = ৳${USD_BDT}
`);
  console.log("ONE REPLY (text)");
  for (const [k, pr] of Object.entries(PROFILES)) {
    const m = profileMessage(pr, rate);
    console.log(`  ${pad(k, 9)} ${pad(d(m.text), 10)} ${pad(bdt(m.text), 9)} ${pr.note}`);
  }

  for (const mix of ["real", "worst"]) {
    console.log(`
A PACKAGE AT ITS LIMIT — ${mix === "real" ? "real mix (13% photos, 3% voice)" : "worst case (every message a photo AND a voice note)"}`);
    console.log(`  ${pad("package", 16)} ${pad("price", 8)} ${pad("replies", 8)} ${pad("before", 11)} ${pad("trimmed", 11)} ${pad("cached", 11)} ${pad("margin now", 12)} one-off`);
    for (const p of PACKAGES) {
      const b = profilePackage(p, PROFILES.before, mix), t = profilePackage(p, PROFILES.trimmed, mix), c = profilePackage(p, PROFILES.cached, mix);
      const margin = p.price - t.monthly * USD_BDT;
      console.log(`  ${pad(p.name, 16)} ${pad("৳" + p.price, 8)} ${pad(p.messages, 8)} ${pad(bdt(b.monthly), 11)} ${pad(bdt(t.monthly), 11)} ${pad(bdt(c.monthly), 11)} ${pad((margin >= 0 ? "+" : "−") + "৳" + Math.abs(Math.round(margin)).toLocaleString("en-IN"), 12)} ${t.setup > 0 ? bdt(t.setup) : "—"}`);
    }
  }

  console.log("\nWHAT A PACKAGE COULD CARRY AND STILL EARN HALF ITS PRICE");
  console.log(`  ${pad("package", 16)} ${pad("price", 8)} ${pad("trimmed", 12)} ${pad("cached", 12)} today's cap`);
  for (const p of PACKAGES.filter((x) => x.price > 0)) {
    const t = profilePackage(p, PROFILES.trimmed, "real"), c = profilePackage(p, PROFILES.cached, "real");
    const cap = (prof) => Math.round((p.price / 2) / (prof.per * USD_BDT));
    console.log(`  ${pad(p.name, 16)} ${pad("৳" + p.price, 8)} ${pad(cap(t).toLocaleString("en-IN") + " replies", 12)} ${pad(cap(c).toLocaleString("en-IN") + " replies", 12)} ${p.messages.toLocaleString("en-IN")}`);
  }
  console.log("");
}

// ── EVERYTHING, at the maximum a package allows ────────────────────────────
//   node scripts/ai-cost-model.mjs --max
//
// The tables above answer "what do the customer conversations cost?". This one
// answers the owner's real question: if ONE client pushes EVERY part of the
// product to the limit of their package for a whole month — the chats, the
// catalogue, the knowledge base, the AI assistant, the buttons — what is the
// bill? Nothing is left out, and every assumption is named on the line it
// belongs to, because that is where a decision gets made or lost.
//
// Two columns, because they are different questions:
//   FIRST MONTH — they also fill the catalogue and the knowledge base from
//                 empty, the dearest way (by chat, with photos).
//   EVERY MONTH — the chats, plus the churn of a working shop (a fifth of the
//                 catalogue re-photographed or re-priced each month; a re-saved
//                 product is re-indexed and its new photo re-read).
const MAX_USE = {
  commentShare: 0.20,   // one public comment answered per five replies
  offShare: 0.20,       // a fifth of the traffic arrives while the bot is off
  assistantPerDay: 50,  // the owner leaning on the AI assistant hard, every day
  promptWrites: 20,     // re-writing the bot profile
  offerPolishes: 30,    // polishing offers
  churn: 0.20,          // share of the catalogue re-saved each month
  photosPerProduct: 3,  // a front, a back and a detail
  variantsPerProduct: 4,
  interviewQuestions: 6,
  productsPerImportPage: 20,
  chunksPerFile: CHUNKS_PER_FILE,
};

export function maxUse(pkg, profile = PROFILES.trimmed, rate = "gemini-3.6-flash") {
  const m = profileMessage(profile, rate);
  const U = MAX_USE;
  // Every message the worst it can be: a photo AND a voice note on each.
  const replies = pkg.messages * m.photo + pkg.messages * cost("bot.voice", rate);
  const comments = pkg.messages * U.commentShare * m.comment;
  const botOff = pkg.messages * U.offShare * (m.offPhoto + m.offVoice);
  // Per-day use follows the real length of the month (or of the trial).
  const days = pkg.days || DAYS;
  const assistant = U.assistantPerDay * days * cost("product.assistant", rate);
  const monthShare = days / 30;   // the buttons are quoted per 30-day month
  const buttons = (U.promptWrites * cost("platform.prompt", rate) + U.offerPolishes * cost("platform.offer", rate)) * monthShare;

  // One product, added the dearest way: the chat interview, a photo read for
  // every picture, and an index entry for every variant.
  const perProductChat = U.interviewQuestions * cost("product.interview", rate)
    + U.photosPerProduct * cost("product.vision", rate)
    + U.variantsPerProduct * cost("product.embed", rate);
  const products = (pkg.products || 0) * perProductChat;
  const imports = pkg.products ? Math.ceil(pkg.products / U.productsPerImportPage) * cost("product.scrape", rate) : 0;
  const knowledge = (pkg.kbFiles || 0) * U.chunksPerFile * cost("knowledge.embed", rate);
  const churn = products * U.churn * monthShare;

  const chat = replies + comments + botOff;
  const owner = assistant + buttons;
  return {
    replies, comments, botOff, assistant, buttons, products, imports, knowledge, churn,
    chat, owner,
    firstMonth: chat + owner + products + imports + knowledge,
    everyMonth: chat + owner + churn,
  };
}

if (args.has("--max")) {
  const rate = "gemini-3.6-flash";
  const profiles = [["as it was", PROFILES.before], ["after the trim", PROFILES.trimmed], ["if caching lands", PROFILES.cached]];
  console.log(`\nEVERYTHING AT THE MAXIMUM — one client pushing every part of a package to its limit`);
  console.log(`${rate} · $1 = ৳${USD_BDT}\n`);

  for (const [label, profile] of profiles) {
    console.log(`  ── ${label}`);
    console.log(`  ${pad("package", 16)} ${pad("price", 8)} ${pad("first month", 13)} ${pad("every month", 13)} margin/month`);
    for (const p of PACKAGES) {
      const x = maxUse(p, profile, rate);
      const margin = p.price - x.everyMonth * USD_BDT;
      console.log(`  ${pad(p.name, 16)} ${pad("৳" + p.price, 8)} ${pad(bdt(x.firstMonth), 13)} ${pad(bdt(x.everyMonth), 13)} ${(margin >= 0 ? "+" : "−")}৳${Math.abs(Math.round(margin)).toLocaleString("en-IN")}`);
    }
    console.log("");
  }

  console.log("  WHERE IT ALL GOES — Shop Growth at the maximum, after the trim");
  const g = maxUse(PACKAGES.find((p) => p.id === "shop_growth"), PROFILES.trimmed, rate);
  const rows = [
    ["customer replies (15,000, each with a photo and a voice note)", g.replies],
    ["public comments answered (3,000)", g.comments],
    ["photos and voice read while the bot is off (3,000)", g.botOff],
    ["AI assistant (1,500 owner messages)", g.assistant],
    ["bot-profile writes and offer polishes (50)", g.buttons],
    ["catalogue re-saved through the month (600 products)", g.churn],
  ];
  for (const [k, v] of rows) console.log(`  ${pad(k, 58)} ${pad(bdt(v), 11)} ${((v / g.everyMonth) * 100).toFixed(0)}%`);
  console.log(`  ${pad("EVERY MONTH", 58)} ${bdt(g.everyMonth)}`);
  console.log(`  ${pad("first month also: 3,000 products by chat + 150 website pages", 58)} ${bdt(g.products + g.imports + g.knowledge)}`);
  console.log(`  ${pad("FIRST MONTH", 58)} ${bdt(g.firstMonth)}`);

  console.log(`\n  ASSUMPTIONS: every message carries a photo and a voice note · one comment per five replies ·`);
  console.log(`  a fifth of traffic arrives with the bot off · the assistant used ${MAX_USE.assistantPerDay}× a day · ${MAX_USE.promptWrites} profile writes and ${MAX_USE.offerPolishes} offer polishes ·`);
  console.log(`  each product ${MAX_USE.photosPerProduct} photos, ${MAX_USE.variantsPerProduct} variants, added through the ${MAX_USE.interviewQuestions}-question chat · ${MAX_USE.churn * 100}% of the catalogue re-saved monthly.\n`);
}

// ── How to bring the maximum down ──────────────────────────────────────────
//   node scripts/ai-cost-model.mjs --reduce
//
// The max-use number is 81% customer replies, so anything that does not touch
// a reply barely moves it. These are ordered by what they actually save on
// Shop Growth at its limit, each one applied on top of the ones above it, with
// the risk to quality stated — a saving that costs an answer is not a saving.
const REDUCE = [
  { id: "cached", label: "Gemini reuses the fixed prefix (already shipped — needs confirming)",
    apply: (s) => ({ ...s, chat: PROFILES.cached }),
    risk: "none — the model sees the same prompt", state: "shipped 2026-09-18, waiting on live data" },

  { id: "output", label: "Ask for a tighter reply (248 → 150 output tokens)",
    apply: (s) => ({ ...s, out: 150 }),
    risk: "low — shorter answers, same facts; output is billed at 5× the input rate", state: "prompt change, half a day" },

  { id: "comment", label: "A comment reply does not need the whole catalogue (4,723 → 1,500 in)",
    apply: (s) => ({ ...s, commentIn: 1500 }),
    risk: "low — a public comment is answered in one line and moves to DM", state: "one prompt, half a day" },

  { id: "router", label: "Simple questions on the small model (40% of replies)",
    apply: (s) => ({ ...s, routerShare: 0.40 }),
    risk: "medium — photos, orders, bookings and haggling must stay on the big model", state: "2 days with tests" },

  { id: "vision", label: "Never read the same photo twice (20% are repeats)",
    apply: (s) => ({ ...s, visionRepeat: 0.20 }),
    risk: "none — a hash lookup, the same description reused", state: "1 day" },

  { id: "lang", label: "Stop the language rewrite firing (30% → 10% of replies)",
    apply: (s) => ({ ...s, langRate: 0.10 }),
    risk: "low — a firmer language instruction; the rewrite stays as the safety net", state: "prompt change + tests" },

  { id: "batch", label: "Index the catalogue on the Batch API (half price, not instant)",
    apply: (s) => ({ ...s, batch: 0.5 }),
    risk: "none for the customer — nobody is waiting on a product being indexed", state: "1-2 days" },
];

// Shop Growth at the maximum, under a set of switches.
function reducedMonthly(sw, rate = "gemini-3.6-flash") {
  const p = PRICES[rate], lite = PRICES["gemini-2.5-flash-lite"] || { in: 0.10, out: 0.40 };
  const pkg = PACKAGES.find((x) => x.id === "shop_growth");
  const U = MAX_USE, days = DAYS;

  // One reply, with whatever switches are on.
  const chatIn = sw.chat.chatIn, cached = sw.chat.cached, out = sw.out;
  const big = ((chatIn - cached) / 1e6) * p.in + (cached / 1e6) * p.in * 0.10 + (out / 1e6) * p.out;
  const small = ((chatIn - cached) / 1e6) * lite.in + (cached / 1e6) * lite.in * 0.10 + (out / 1e6) * lite.out;
  const chat = (1 - sw.routerShare) * big + sw.routerShare * small;
  const reply = chat + cost("bot.embed", rate) + site("bot.tag").rate * cost("bot.tag", rate) + sw.langRate * cost("bot.language", rate);

  const vision = cost("bot.vision", rate) * (1 - sw.visionRepeat);
  const voice = cost("bot.voice", rate);
  const comment = ((sw.commentIn / 1e6) * p.in + (site("bot.comment").out / 1e6) * p.out) + cost("bot.embed", rate);

  const replies = pkg.messages * (reply + vision + voice);
  const comments = pkg.messages * U.commentShare * comment;
  const botOff = pkg.messages * U.offShare * (vision + voice);
  const assistant = U.assistantPerDay * days * cost("product.assistant", rate);
  const buttons = U.promptWrites * cost("platform.prompt", rate) + U.offerPolishes * cost("platform.offer", rate);
  const perProductChat = (U.interviewQuestions * cost("product.interview", rate)
    + U.photosPerProduct * cost("product.vision", rate)
    + U.variantsPerProduct * cost("product.embed", rate)) * sw.batch;
  const churn = (pkg.products || 0) * U.churn * perProductChat;
  return replies + comments + botOff + assistant + buttons + churn;
}

if (args.has("--reduce")) {
  const rate = "gemini-3.6-flash";
  const pkg = PACKAGES.find((x) => x.id === "shop_growth");
  let sw = { chat: PROFILES.trimmed, out: site("bot.chat").out, commentIn: site("bot.comment").in,
    routerShare: 0, visionRepeat: 0, langRate: site("bot.language").rate, batch: 1 };
  const start = reducedMonthly(sw, rate);
  console.log(`\nBRINGING THE MAXIMUM DOWN — Shop Growth at its limit, ৳3,500 a month`);
  console.log(`starting point after the product trim: ${bdt(start)} a month\n`);
  console.log(`  ${pad("step", 62)} ${pad("saves", 10)} ${pad("left", 11)} risk`);
  let prev = start;
  for (const step of REDUCE) {
    sw = step.apply(sw);
    const now = reducedMonthly(sw, rate);
    console.log(`  ${pad(step.label, 62)} ${pad("−" + bdt(prev - now), 10)} ${pad(bdt(now), 11)} ${step.risk.split(" —")[0]}`);
    prev = now;
  }
  console.log(`\n  all of them together: ${bdt(prev)} a month at the limit — ${Math.round((1 - prev / start) * 100)}% off, against a ৳3,500 package`);

  // What is left is a product decision, not an engineering one.
  const perReply = prev / pkg.messages;
  console.log(`\n  THE REST IS THE CAP ITSELF. At ${bdt(perReply)} per reply:`);
  for (const share of [1, 0.5, 0.35]) {
    const cap = Math.round((pkg.price * share) / (perReply * USD_BDT));
    console.log(`  ${pad(share === 1 ? "break even" : `keep ${Math.round((1 - share) * 100)}% of the price`, 28)} ${cap.toLocaleString("en-IN")} replies a month`);
  }
  console.log(`  ${pad("today's cap", 28)} ${pkg.messages.toLocaleString("en-IN")} replies a month\n`);
}
