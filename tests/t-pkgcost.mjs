import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// package-cost.js is pure arithmetic with no imports, so it loads as-is.
const C = await import(__R("src/lib/package-cost.js?v=").href + Date.now());
const { perCallRates, messageCosts, packageCost, floorPrice, marginAt, SHAPE } = C;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);
const near = (name, got, want, eps = 1e-9) => ok(`${name} (${got})`, Math.abs(got - want) < eps);

// Round numbers so the arithmetic can be checked by hand.
const BY_FEATURE = {
  "bot.chat":         { calls: 100, cost: 1.0, ownKeyCost: 0 },      // $0.01 each
  "bot.embed":        { calls: 100, cost: 0.1, ownKeyCost: 0 },      // $0.001 each
  "bot.vision":       { calls: 10,  cost: 0.5, ownKeyCost: 0 },      // $0.05 each
  "bot.voice":        { calls: 10,  cost: 0.2, ownKeyCost: 0 },      // $0.02 each
  "product.embed":    { calls: 100, cost: 0.2, ownKeyCost: 0 },      // $0.002 each
  "product.vision":   { calls: 100, cost: 1.0, ownKeyCost: 0 },      // $0.01 each
  "product.assistant":{ calls: 100, cost: 2.0, ownKeyCost: 0 },      // $0.02 each
};

// ── rates from measured calls ──────────────────────────────────────────────
const R = perCallRates(BY_FEATURE);
near("a rate is cost over calls", R["bot.chat"], 0.01);
// A client's own key still paid a real cost; a package has to be priced on it.
near("the client's own key counts toward the true cost",
  perCallRates({ "bot.chat": { calls: 10, cost: 0.5, ownKeyCost: 0.5 } })["bot.chat"], 0.1);
is("a feature with no calls has no rate", perCallRates({ "bot.chat": { calls: 0, cost: 5 } }), {});
is("nothing measured is an empty book", perCallRates(), {});
is("and does not throw on rubbish", perCallRates({ x: null }), {});

// ── what a message costs ───────────────────────────────────────────────────
const m = messageCosts(R);
// EVERY message pays for the search as well as the reply — this is the part a
// blended figure hid.
near("a text message is reply + search", m.text, 0.011);
near("a photo message adds the vision call", m.image, 0.061);
near("a voice note adds the transcription", m.voice, 0.031);

// Nothing measured must read as "unknown", never as free.
const none = messageCosts({});
is("an unmeasured reply has no cost, not a zero", none.text, null);
is("nor does a photo", none.image, null);
// The search is the one exception: it is cheap and constant, and treating a
// missing search rate as zero keeps the reply cost usable on day one.
near("a measured reply with no search rate still costs something",
  messageCosts({ "bot.chat": 0.01 }).text, 0.01);

// ── one package ────────────────────────────────────────────────────────────
const PKG = { id: "pro", messages_per_month: 10000, max_products: 1000 };
const flat = { imageShare: 0, voiceShare: 0, typicalUse: 1, catalogueFill: 0, assistantMessages: 0 };
const c = packageCost(PKG, R, flat);
near("all-text traffic costs the text rate", c.perMessage, 0.011);
near("and the month is that times the allowance", c.bot.atFull, 110);
is("nothing to index costs nothing", c.catalogue.once, 0);
is("an owner who never opens the assistant costs nothing there", c.platform.monthly, 0);

// The mix is what makes a package expensive, and it is the number a price is
// most sensitive to.
const mixed = packageCost(PKG, R, { ...flat, imageShare: 0.5, voiceShare: 0 });
near("half the messages carrying photos costs far more", mixed.perMessage, 0.036);
ok("which is over three times the all-text figure", mixed.bot.atFull > c.bot.atFull * 3);

// Products are paid ONCE, so a monthly price carries a twelfth of them.
const withCat = packageCost(PKG, R, { ...flat, catalogueFill: 1, photosPerProduct: 3, amortiseMonths: 12 });
near("a product costs its indexing plus its photos", withCat.catalogue.perProduct, 0.032);
near("a thousand of them is a one-off", withCat.catalogue.once, 32);
near("spread across a year", withCat.catalogue.monthly, 32 / 12);

const withAsst = packageCost(PKG, R, { ...flat, assistantMessages: 100 });
near("the assistant is a monthly platform cost", withAsst.platform.monthly, 2);
near("and lands in the total", withAsst.total.atFull, 112);

// Typical use, because pricing every package as if it is maxed out prices a
// package nobody buys — and pricing at half is how the heavy clients lose money.
const typ = packageCost(PKG, R, { ...flat, typicalUse: 0.5 });
near("typical use is a fraction of full", typ.bot.atTypical, 55);
near("while full stays full", typ.bot.atFull, 110);

// ── what the package is worth in human terms ───────────────────────────────
near("conversations come off the allowance", c.conversations, Math.floor(10000 / SHAPE.messagesPerConversation));
ok("and moderators off the conversations", c.moderators > 0 && c.moderators < 10);
// The claim is conservative by construction: one moderator is 60 a day over 26
// days, so a package has to be big before it replaces even one.
is("one moderator's month is stated, not hidden", c.moderatorMonth, 60 * 26);

// A trial is metered by the day, so its allowance is days × the daily figure.
const tr = packageCost({ id: "trial", messages_per_day: 30, trial_days: 5 }, R, flat);
near("a trial's allowance is its whole length", tr.allowance, 150);
// An unlimited package has no ceiling to price. Saying so beats inventing one.
const unl = packageCost({ id: "max", messages_per_month: null }, R, flat);
is("unlimited has no allowance to price", unl.allowance, null);
is("nor conversations", unl.conversations, null);
is("nor moderators", unl.moderators, null);
is("nor a bot cost", unl.bot.atFull, null);

// Which rates the answer actually rests on.
is("what was measured is reported", packageCost(PKG, R, flat).unmeasured, []);
is("and what was not", packageCost(PKG, { "bot.chat": 0.01 }, flat).unmeasured, ["vision", "voice"]);

// ── price ──────────────────────────────────────────────────────────────────
// $10 of AI at 120 taka is 1,200 taka; at 30% that is 4,000.
is("the floor clears the margin", floorPrice(10, 120, 0.3), 4000);
is("and rounds UP, because a floor rounded down is not a floor", floorPrice(10.01, 120, 0.3), 4100);
is("a tighter margin needs a higher price", floorPrice(10, 120, 0.2), 6000);
is("no cost, no floor", floorPrice(null, 120), null);
is("no rate, no floor", floorPrice(10, null), null);

near("margin is what is left after AI", marginAt(4000, 10, 120), 0.7);
is("a free package has no margin to report", marginAt(0, 10, 120), null);
is("nor one with no cost measured", marginAt(4000, null, 120), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
