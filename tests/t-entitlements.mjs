// The feature/meter display logic. features.js has no imports, so it loads as-is.
const M = await import(new URL("../src/lib/features.js", import.meta.url).href + "?v=" + Date.now());
const { featureList, shapeMeter, FEATURE_DEFS } = M;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);

// ── featureList: biz relevance ───────────────────────────────────────────────
const shopKeys = featureList({}, "ecommerce").map((f) => f.key);
const svcKeys = featureList({}, "agency").map((f) => f.key);
ok("a shop sees photo matching (vision)", shopKeys.includes("vision"));
ok("a shop never sees calendar", !shopKeys.includes("calendar"));
ok("a shop never sees knowledge base", !shopKeys.includes("kb"));
ok("a service sees calendar", svcKeys.includes("calendar"));
ok("a service sees knowledge base", svcKeys.includes("kb"));
ok("a service never sees photo matching", !svcKeys.includes("vision"));
ok("both sides see broadcasts", shopKeys.includes("broadcast") && svcKeys.includes("broadcast"));
ok("both sides see BYOK", shopKeys.includes("byok") && svcKeys.includes("byok"));

// ── featureList: on/off, unknown defaults on ─────────────────────────────────
const shop = featureList({ vision: true, comments: false }, "ecommerce");
is("an explicitly-on feature reads on", shop.find((f) => f.key === "vision").on, true);
is("an explicitly-off feature reads off", shop.find((f) => f.key === "comments").on, false);
is("a feature nobody set defaults on", shop.find((f) => f.key === "widget").on, true);
is("missing biz defaults to shop", featureList({}).map((f) => f.key).includes("vision"), true);
ok("every entry carries a label", featureList({}, "ecommerce").every((f) => typeof f.label === "string" && f.label.length));

// ── shapeMeter ───────────────────────────────────────────────────────────────
is("used under a limit", shapeMeter("m", "M", 420, 3000), { key: "m", label: "M", used: 420, limit: 3000, remaining: 2580, unlimited: false, pct: 14 });
is("at the limit → 0 remaining, 100%", shapeMeter("m", "M", 3000, 3000), { key: "m", label: "M", used: 3000, limit: 3000, remaining: 0, unlimited: false, pct: 100 });
is("over the limit clamps remaining at 0 and pct at 100", shapeMeter("m", "M", 3200, 3000), { key: "m", label: "M", used: 3200, limit: 3000, remaining: 0, unlimited: false, pct: 100 });
is("null limit is unlimited (no remaining, no pct)", shapeMeter("p", "P", 12, null), { key: "p", label: "P", used: 12, limit: null, remaining: null, unlimited: true, pct: null });
is("null used shows as null, never 0", shapeMeter("p", "P", null, 300), { key: "p", label: "P", used: null, limit: 300, remaining: null, unlimited: false, pct: null });
is("zero used is a real 0, not unread", shapeMeter("p", "P", 0, 300), { key: "p", label: "P", used: 0, limit: 300, remaining: 300, unlimited: false, pct: 0 });

// ── FEATURE_DEFS is the single labelled source ───────────────────────────────
is("FEATURE_DEFS covers all nine capability keys",
  FEATURE_DEFS.map((d) => d.key).sort(),
  ["broadcast", "byok", "calendar", "comments", "followup", "kb", "vision", "voice", "widget"]);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
