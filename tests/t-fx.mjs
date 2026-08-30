import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { loadPure } from "./shim.mjs";

const { fetchUsdBdt, rateFrom, isStale, plausible, MAX_AGE_MS } =
  await loadPure(__R("src/lib/fx.js"), "tmp-fx.mjs");

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

// ── the sanity bounds ──────────────────────────────────────────────────────
// A parser reading the wrong field, or an API answering in another base, gives
// a number off by a FACTOR — and a factor turns every margin upside down while
// still looking like a number.
is("a real rate passes", plausible(122.4), true);
is("zero does not", plausible(0), false);
is("a euro-ish rate does not", plausible(0.92), false);
is("a thousand does not", plausible(1000), false);
is("text does not", plausible("many"), false);
is("NaN does not", plausible(NaN), false);
is("the bottom edge is in", plausible(60), true);
is("the top edge is in", plausible(400), true);

// ── which rate wins ────────────────────────────────────────────────────────
is("the market by default",
  rateFrom({ usd_bdt_auto: 122.5, usd_bdt: 110, usd_bdt_at: "2026-08-30T00:00:00Z" }),
  { rate: 122.5, source: "market", at: "2026-08-30T00:00:00Z" });
is("the owner's number when they have said so",
  rateFrom({ usd_bdt_manual: true, usd_bdt: 110, usd_bdt_auto: 122.5 }),
  { rate: 110, source: "manual", at: null });
is("a typed rate stands in until the market has answered",
  rateFrom({ usd_bdt: 118 }), { rate: 118, source: "manual", at: null });
is("and the house default when nothing has",
  rateFrom({}), { rate: 120, source: "fallback", at: null });
is("an implausible market rate is refused, not used",
  rateFrom({ usd_bdt_auto: 0.0089, usd_bdt: 118 }), { rate: 118, source: "manual", at: null });
is("an implausible typed rate is refused too",
  rateFrom({ usd_bdt_manual: true, usd_bdt: 0 }), { rate: 120, source: "fallback", at: null });
// Manual ON with nothing typed must not silently sit on a stale market number
// under a "Set by you" badge.
is("manual with nothing typed falls through to the market",
  rateFrom({ usd_bdt_manual: true, usd_bdt_auto: 121 }), { rate: 121, source: "market", at: null });
is("a different fallback is respected", rateFrom({}, 150).rate, 150);

// ── staleness ──────────────────────────────────────────────────────────────
const now = Date.parse("2026-08-30T12:00:00Z");
is("never fetched is stale", isStale({}, now), true);
is("a bad date is stale", isStale({ usd_bdt_at: "sometime" }, now), true);
is("an hour old is not", isStale({ usd_bdt_at: "2026-08-30T11:00:00Z" }, now), false);
is("just past the window is", isStale({ usd_bdt_at: new Date(now - MAX_AGE_MS - 1000).toISOString() }, now), true);
is("just inside it is not", isStale({ usd_bdt_at: new Date(now - MAX_AGE_MS + 1000).toISOString() }, now), false);

// ── fetching ───────────────────────────────────────────────────────────────
const reply = (body, ok = true) => async () => ({ ok, json: async () => body });
is("a good answer is read", await fetchUsdBdt(reply({ rates: { BDT: 122.4321 } })), 122.43);
is("and rounded to poisha", await fetchUsdBdt(reply({ rates: { BDT: 121.999 } })), 122);
is("a missing currency is null", await fetchUsdBdt(reply({ rates: { EUR: 0.9 } })), null);
is("an implausible answer is null", await fetchUsdBdt(reply({ rates: { BDT: 1 } })), null);
is("an HTTP error is null", await fetchUsdBdt(reply({ rates: { BDT: 122 } }, false)), null);
is("a thrown fetch is null", await fetchUsdBdt(async () => { throw new Error("offline"); }), null);
is("junk instead of JSON is null", await fetchUsdBdt(async () => ({ ok: true, json: async () => { throw new Error("bad"); } })), null);
is("no body at all is null", await fetchUsdBdt(reply(null)), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
