import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { readFileSync } from "node:fs";

// Every key the panel asks for must be in the dictionary. t() falls back to
// printing the key itself, so a typo does not throw — it puts "asst.rule.one"
// on the screen in place of the sentence, and nothing tells anybody.
const root = ROOT_SLASH + "src/app/dashboard/components/";   // a string, concatenated below
const dictSrc = readFileSync(root + "i18n.js", "utf8");
// The panel and the two describers it renders with. The describers live in
// lib/ but are browser-only, and every word on a confirmation card comes from
// them — so their keys have to be checked alongside the panel's.
const panel = readFileSync(root + "InventoryAssistant.js", "utf8")
  + readFileSync(__R("src/lib/assistant-actions.js"), "utf8")
  + readFileSync(__R("src/lib/inventory-actions.js"), "utf8");

function block(lang) {
  const start = dictSrc.indexOf(`\n  ${lang}: {`);
  let i = dictSrc.indexOf("{", start), depth = 0;
  for (; i < dictSrc.length; i++) {
    if (dictSrc[i] === "{") depth++;
    else if (dictSrc[i] === "}") { depth--; if (!depth) break; }
  }
  return dictSrc.slice(start, i);
}
const has = (lang) => new Set([...block(lang).matchAll(/"([a-zA-Z][\w.]*)"\s*:/g)].map((m) => m[1]));
const en = has("en"), bn = has("bn");

// Any key-shaped literal in the file. Not `t("...")` specifically: half of
// them are picked by a ternary inside the call, or listed in an array above it,
// and a matcher that only sees the first shape reports the rest as dead.
const asked = new Set([...panel.matchAll(/"((?:asst|fld|sfld|card|inv|nav|common|q|ph|lbl)\.[\w.]+)"/g)].map((m) => m[1]));

// The dynamic ones, expanded by hand from what the component can actually
// build. Listing them is the point: if a way or an intent is added and its
// strings are not, this is what says so.
const INTENTS = ["add", "offer", "train"];
const WAYS = ["photos", "csv", "url", "woo", "shopify"];
const RULES = ["one", "many", "url", "csv", "woo", "shopify", "offer", "train"];
const JUMPS = ["settings", "inventory", "orders", "conversations", "comments", "broadcast", "analytics", "channels", "billing", "ai", "profile"];
const PAGES = [...JUMPS];
const FIELDS = ["product_name", "category", "regular_price", "description", "options", "photo", "stock_qty", "brand", "sale_price", "product_code", "tags", "stock_status"];
const PLURALS = ["asst.photo.added", "asst.photo.repeats", "asst.applied", "asst.apply"];
// The bot-training wizard asks every question this business type has, using the
// same wordings the Bot Training form used to.
const TRAIN_ECOM = ["description", "products", "delivery", "deliveryAreas", "payment", "advancePay",
  "returnPolicy", "stock", "warranty", "hours", "catalogLink", "faq", "complaints", "special"];
const TRAIN_AGENCY = ["description", "services", "pricing", "process", "timeline", "meetingInfo",
  "clients", "hours", "catalogLink", "contract", "faq", "objections", "special"];

for (const i of INTENTS) { asked.add(`asst.intent.${i}`); asked.add(`asst.intent.${i}Sub`); }
for (const w of WAYS) { asked.add(`asst.way.${w}`); asked.add(`asst.way.${w}Sub`); }
for (const r of RULES) asked.add(`asst.rule.${r}`);
for (const p of PAGES) asked.add(`nav.${p}`);
for (const f of FIELDS) asked.add(`fld.${f}`);
for (const k of PLURALS) { asked.add(k); asked.add(`${k}1`); }
for (const k of TRAIN_ECOM) { asked.add(`q.ecom.${k}`); asked.add(`ph.ecom.${k}`); asked.add(`lbl.${k}`); }
for (const k of TRAIN_AGENCY) { asked.add(`q.agency.${k}`); asked.add(`ph.agency.${k}`); asked.add(`lbl.${k}`); }
// The confirmation cards' own dynamic keys.
for (const k of ["title", "details", "valid_until", "active", "botName", "businessName", "greeting", "tone", "languages"]) asked.add(`sfld.${k}`);
for (const m of ["fixed", "limited", "custom"]) asked.add(`card.mode.${m}`);

// `card.*` and `sfld.*` are read ONLY by the describers, so anything defined
// under those and never asked for is dead.
const CARDY = (k) => k.startsWith("card.") || k.startsWith("sfld.");

const missEn = [...asked].filter((k) => !en.has(k)).sort();
const missBn = [...asked].filter((k) => !bn.has(k)).sort();

// And the other way: an asst.* key nobody asks for is dead weight in two
// dictionaries that a person maintains by hand.
const unused = [...en].filter((k) => (k.startsWith("asst.") || k.startsWith("fld.") || CARDY(k)) && !asked.has(k)).sort();

console.log(`the panel asks for ${asked.size} keys`);
if (missEn.length) console.log("MISSING from en:", missEn);
if (missBn.length) console.log("MISSING from bn:", missBn);
if (unused.length) console.log("defined but never asked for:", unused);
const bad = missEn.length + missBn.length + unused.length;
console.log(bad ? `\n${bad} problem(s)` : "\nevery key the panel asks for exists in both languages, and none is spare");
process.exit(bad ? 1 : 0);
