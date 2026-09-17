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
const PACKAGES = [
  { id: "trial",        name: "Free Trial",      price: 0,    messages: 900,   products: 20,    kbFiles: 2 },
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
