import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { readFileSync, writeFileSync } from "node:fs";

// usage.js reaches for the real supabase client. The two things under test —
// the per-channel grouping, and the fallback for a database that has not had
// the page_id migration run — need a stub instead, so the import is rewritten
// rather than stripped.
const src = readFileSync(__R("src/lib/usage.js"), "utf8")
  .replace('import { supabase } from "@/lib/supabase.js";', "export let supabase = { rpc: async () => ({}) };\nexport const __setSupabase = (s) => { supabase = s; };")
  .replace('import { AREAS, FEATURES, featureId, areaOf, featureLabel } from "@/lib/usage-features.js";',
    'import { AREAS, FEATURES, featureId, areaOf, featureLabel } from "./tmp-feat.mjs";');
const at = new URL("tmp-usage.mjs", import.meta.url);
writeFileSync(new URL("tmp-feat.mjs", import.meta.url), readFileSync(__R("src/lib/usage-features.js"), "utf8"));
writeFileSync(at, src);
const U = await import(`${at.href}?v=${Date.now()}`);

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);
const wait = () => new Promise((r) => setTimeout(r, 5));

const PRICES = { "google/m": { in: 1_000_000, out: 1_000_000 } };  // $1 per token, so cost === tokens
const row = (o) => ({ kind: "chat", feature: "bot.chat", provider: "google", model: "m", calls: 1, tokens_in: 1, tokens_out: 0, ...o });

// ── grouping by channel ────────────────────────────────────────────────────
const s = U.summarise([
  row({ page_id: "PAGE_A", tokens_in: 3 }),
  row({ page_id: "PAGE_A", tokens_in: 2 }),
  row({ page_id: "PAGE_B", tokens_in: 4 }),
  row({ page_id: "", feature: "product.embed", kind: "embed", tokens_in: 1 }),
], PRICES);
is("each channel is summed on its own", s.byChannel.PAGE_A.cost, 5);
is("and the other one separately", s.byChannel.PAGE_B.cost, 4);
is("a call with no channel lands under empty", s.byChannel[""].cost, 1);
is("calls are counted per channel too", s.byChannel.PAGE_A.calls, 2);
// 9 of 10 named a channel.
is("and how much of the spend named one is reported", Math.round(s.channelMeasured * 100), 90);

// The client's own key is their money, and it must stay separated per channel
// exactly as it is in every other total.
const own = U.summarise([row({ page_id: "P", own_key: true, tokens_in: 7 })], PRICES);
is("a BYOK channel's cost is theirs, not ours", own.byChannel.P, { calls: 1, tokensIn: 7, tokensOut: 0, tokens: 7, cost: 0, ownKeyCost: 7 });
is("and it still counts as having named a channel", own.channelMeasured, 1);

// Rows written before the migration have no page_id at all.
const old = U.summarise([row({ tokens_in: 5 }), row({ tokens_in: 5 })], PRICES);
is("history groups under empty", Object.keys(old.byChannel), [""]);
is("and nothing is claimed as measured", old.channelMeasured, 0);
is("no rows at all does not divide by zero", U.summarise([], PRICES).channelMeasured, 0);

// The other buckets must not have changed shape.
is("byArea still works", s.byArea.bot.cost, 9);
is("byFeature still works", s.byFeature["bot.chat"].calls, 3);

// ── recording, on both sides of the migration ──────────────────────────────
const calls = [];
const stub = (fail) => ({
  rpc: async (_fn, args) => {
    calls.push(args);
    // What PostgREST says when the function does not take the new argument.
    if (fail && "p_page_id" in args) return { error: { message: "Could not find the function public.record_ai_usage(p_page_id, ...) in the schema cache" } };
    return {};
  },
});

// A database that HAS the column: one call, carrying it.
U.__setSupabase(stub(false));
U.recordUsage({ clientId: "c1", kind: "chat", feature: "bot", model: "m", pageId: "PAGE_A" });
await wait();
is("the channel is sent", calls.length, 1);
is("and it is the one given", calls[0].p_page_id, "PAGE_A");

// A database that does NOT: it tries, is refused, and records anyway — because
// a migration nobody has run yet must not stop usage being counted at all.
calls.length = 0;
U.__setSupabase(stub(true));
U.recordUsage({ clientId: "c1", kind: "chat", feature: "bot", model: "m", pageId: "PAGE_A" });
await wait();
is("it tries, then falls back", calls.length, 2);
ok("the first attempt carried the channel", "p_page_id" in calls[0]);
ok("the second did not", !("p_page_id" in calls[1]));
is("and the rest of the call is unchanged", calls[1].p_client_id, "c1");

// And it remembers, so it is one attempt per process and not one per call.
calls.length = 0;
U.recordUsage({ clientId: "c1", kind: "chat", feature: "bot", model: "m", pageId: "PAGE_B" });
await wait();
is("afterwards it does not try again", calls.length, 1);
ok("and goes straight without the channel", !("p_page_id" in calls[0]));

// A call with no channel is still a call.
calls.length = 0;
U.__setSupabase(stub(false));
U.recordUsage({ clientId: "c1", kind: "embed", feature: "product", model: "m" });
await wait();
is("no channel is recorded, not skipped", calls.length, 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
