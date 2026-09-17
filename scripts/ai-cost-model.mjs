// What one customer message, one product and one full package actually cost us
// in AI, measured — not guessed.
//
//   node scripts/ai-cost-model.mjs            (table)
//   node scripts/ai-cost-model.mjs --json     (numbers, for the admin panel)
//
// WHERE THE NUMBERS COME FROM
// Every AI call reports its tokens into usage_daily (src/lib/usage.js). The
// per-call figures below are the real averages from that table on 2026-09-18,
// dominated by Broker's BD — the only account with a month of ordinary traffic
// (1,345 customer messages, 174 with a photo, 39 voice notes). Re-measure with:
//
//   select feature, sum(calls) calls,
//          round(sum(tokens_in)::numeric/sum(calls)) tin,
//          round(sum(tokens_out)::numeric/sum(calls)) tout
//   from usage_daily group by 1 order by calls desc;
//
// WHAT IT DELIBERATELY LEAVES OUT
// The AI assistant, bot-profile writing, offer polishing and website scraping:
// those are buttons the owner presses, not per-message or per-product costs.
// They belong in a second pass (owner's instruction, 2026-09-18).

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has("--json");

// ── The price book ──────────────────────────────────────────────────────────
// USD per million tokens. gemini-3.6-flash is what the platform actually runs
// (src/lib/gemini.js MODEL_CHAIN) and its introductory rate holds until
// 2026-12-31; the 2027 rate is double, which is why it is carried here too.
// NOTE: the model_prices table has no row for gemini-3.6-flash, so the admin
// panel currently prices it at the __default__ fallback (0.30/2.50) — every
// figure there is roughly 2.5× too cheap on input until that row is added.
export const PRICES = {
  "gemini-3.6-flash":      { in: 0.75, out: 3.75, note: "intro rate, to 2026-12-31" },
  "gemini-3.6-flash-2027": { in: 1.50, out: 7.50, note: "from 2027-01-01" },
  "gemini-2.5-flash":      { in: 0.30, out: 2.50, note: "the older fallback model" },
  "gemini-embedding-001":  { in: 0.15, out: 0.00, note: "embeddings, input only" },
};

const USD_BDT = Number(process.env.USD_BDT) || 123.11; // live mid-market, 2026-09-18

// ── Measured cost of one call, in tokens ────────────────────────────────────
export const CALLS = {
  chat:     { in: 7718, out: 248, model: "gemini-3.6-flash", what: "the reply itself (system prompt + catalogue + history)" },
  embed:    { in: 34,   out: 0,   model: "gemini-embedding-001", what: "searching products/knowledge for the message" },
  tag:      { in: 89,   out: 2,   model: "gemini-3.6-flash", what: "labelling the conversation (only when word rules fail)" },
  language: { in: 240,  out: 29,  model: "gemini-3.6-flash", what: "rewriting a reply that came back in the wrong language" },
  vision:   { in: 1230, out: 123, model: "gemini-3.6-flash", what: "reading ONE customer photo" },
  voice:    { in: 437,  out: 38,  model: "gemini-3.6-flash", what: "transcribing ONE voice note" },
  comment:  { in: 4723, out: 36,  model: "gemini-3.6-flash", what: "answering a public comment" },

  pVision:    { in: 1226, out: 142, model: "gemini-3.6-flash", what: "describing ONE product photo" },
  pEmbed:     { in: 321,  out: 0,   model: "gemini-embedding-001", what: "indexing one saved product" },
  pInterview: { in: 936,  out: 48,  model: "gemini-3.6-flash", what: "one question while adding a product by chat" },
  pCatalog:   { in: 574,  out: 127, model: "gemini-3.6-flash", what: "naming a whole batch of photos" },
  pGroup:     { in: 754,  out: 32,  model: "gemini-3.6-flash", what: "grouping a batch of photos into products" },
};

// How often the optional calls actually fire, measured on the same traffic:
// tagging on 23% of replies, the language rewrite on 30%.
const TAG_RATE = 0.23, LANG_RATE = 0.30;

const usd = (call, rateKey) => {
  const p = PRICES[rateKey || call.model];
  return (call.in / 1e6) * p.in + (call.out / 1e6) * p.out;
};

// ── One message ─────────────────────────────────────────────────────────────
// A reply is always: the answer + one search. Tagging and the language rewrite
// are charged at the rate they really happen. A photo or a voice note is an
// EXTRA call on top, and a photo message can carry several photos.
export function perMessage(rate) {
  const reply = usd(CALLS.chat, rate) + usd(CALLS.embed) + TAG_RATE * usd(CALLS.tag, rate) + LANG_RATE * usd(CALLS.language, rate);
  return {
    text: reply,
    photo: reply + usd(CALLS.vision, rate),
    voice: reply + usd(CALLS.voice, rate),
    comment: usd(CALLS.comment, rate) + usd(CALLS.embed),
    // With the bot OFF nothing is answered, but a photo is still read and a
    // voice note still transcribed so the owner can read them in the inbox.
    offPhoto: usd(CALLS.vision, rate),
    offVoice: usd(CALLS.voice, rate),
    offText: 0,
  };
}

// ── One product ─────────────────────────────────────────────────────────────
// Three ways a product reaches the catalogue, each measured end to end. A
// variant that is a row of its own (its own price or stock) is indexed of its
// own, which is why `variants` multiplies the embedding.
export function perProduct(rate, { photos = 1, variants = 1, questions = 4 } = {}) {
  const embed = variants * usd(CALLS.pEmbed);
  return {
    byPhoto: photos * usd(CALLS.pVision, rate) + usd(CALLS.pCatalog, rate) / 10 + usd(CALLS.pGroup, rate) / 10 + embed,
    byChat: questions * usd(CALLS.pInterview, rate) + embed,
    bySheet: embed,
  };
}

// ── The packages ────────────────────────────────────────────────────────────
// messages: the monthly allowance (plans.messages_per_month; the trial is
// 30/day → 900). products: plans.max_products, "null" meaning uncapped, where
// a working ceiling is used for the sum.
const PACKAGES = [
  { id: "trial",        name: "Free Trial",      price: 0,    messages: 900,   products: 20 },
  { id: "shop_starter", name: "Shop Starter",    price: 1500, messages: 3000,  products: 300 },
  { id: "svc_starter",  name: "Service Starter", price: 1500, messages: 3000,  products: 0 },
  { id: "shop_growth",  name: "Shop Growth",     price: 3500, messages: 15000, products: 3000 },
  { id: "svc_growth",   name: "Service Growth",  price: 3500, messages: 15000, products: 0 },
  { id: "shop_scale",   name: "Shop Scale",      price: 6000, messages: 50000, products: 10000, uncapped: true },
  { id: "svc_scale",    name: "Service Scale",   price: 6000, messages: 50000, products: 0 },
];

// Three ways to use a package to its limit.
//   quiet   — every message plain text (the cheapest a full package can be)
//   real    — the mix Broker's BD actually sends: 13% photos, 3% voice
//   worst   — every single message carries a photo AND a voice note
const MIXES = {
  quiet: { photo: 0, voice: 0 },
  real:  { photo: 0.13, voice: 0.03 },
  worst: { photo: 1, voice: 1 },
};

export function packageCost(pkg, mix, rate) {
  const m = perMessage(rate);
  const per = m.text + MIXES[mix].photo * (m.photo - m.text) + MIXES[mix].voice * (m.voice - m.text);
  const messages = pkg.messages * per;
  // Products are a ONE-OFF: filling the catalogue to the cap, by photo (the
  // dearest route). It is shown separately because it does not repeat monthly.
  const products = pkg.products ? pkg.products * perProduct(rate, { photos: 2, variants: 3 }).byPhoto : 0;
  return { per, messages, products, total: messages + products };
}

// ── Output ──────────────────────────────────────────────────────────────────
const bdt = (n) => `৳${(n * USD_BDT).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const d4 = (n) => `$${n.toFixed(4)}`;

const report = {};
for (const rate of ["gemini-3.6-flash", "gemini-3.6-flash-2027"]) {
  const m = perMessage(rate);
  report[rate] = {
    perMessage: m,
    perProduct: perProduct(rate, { photos: 2, variants: 3 }),
    packages: PACKAGES.map((p) => ({
      id: p.id, name: p.name, priceBdt: p.price, messages: p.messages, products: p.products,
      quiet: packageCost(p, "quiet", rate), real: packageCost(p, "real", rate), worst: packageCost(p, "worst", rate),
    })),
  };
}

if (JSON_OUT) { console.log(JSON.stringify({ usdBdt: USD_BDT, prices: PRICES, calls: CALLS, tagRate: TAG_RATE, langRate: LANG_RATE, report }, null, 2)); process.exit(0); }

const rate = "gemini-3.6-flash";
const m = report[rate].perMessage, pr = report[rate].perProduct;
console.log(`\nAI cost model — measured 2026-09-18 · ${rate} at $${PRICES[rate].in}/$${PRICES[rate].out} per 1M · $1 = ৳${USD_BDT}\n`);
console.log("ONE MESSAGE");
console.log(`  text only            ${d4(m.text)}   ${bdt(m.text)}`);
console.log(`  with one photo       ${d4(m.photo)}   ${bdt(m.photo)}`);
console.log(`  with a voice note    ${d4(m.voice)}   ${bdt(m.voice)}`);
console.log(`  a public comment     ${d4(m.comment)}   ${bdt(m.comment)}`);
console.log(`  BOT OFF: photo       ${d4(m.offPhoto)}   ${bdt(m.offPhoto)}`);
console.log(`  BOT OFF: voice       ${d4(m.offVoice)}   ${bdt(m.offVoice)}`);
console.log(`  BOT OFF: text        ${d4(m.offText)}   — nothing is spent`);

console.log("\nONE PRODUCT (2 photos, 3 variants)");
console.log(`  added by photo       ${d4(pr.byPhoto)}   ${bdt(pr.byPhoto)}`);
console.log(`  added by chat        ${d4(pr.byChat)}   ${bdt(pr.byChat)}`);
console.log(`  imported by sheet    ${d4(pr.bySheet)}   ${bdt(pr.bySheet)}`);

console.log("\nA PACKAGE USED TO ITS LIMIT (one month)");
console.log("  package          price    messages   quiet        real mix     every msg photo+voice   catalogue (one-off)");
for (const p of report[rate].packages) {
  const row = (c) => `${bdt(c.messages).padEnd(12)}`;
  console.log(`  ${p.name.padEnd(16)} ${("৳" + p.priceBdt).padEnd(8)} ${String(p.messages).padEnd(10)} ${row(p.quiet)} ${row(p.real)} ${row(p.worst)}           ${p.products ? bdt(p.real.products) : "—"}`);
}
console.log("\n  (catalogue is a one-off: filling the whole catalogue to the cap, by photo — the dearest route)\n");
