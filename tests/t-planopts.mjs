// planOptions decides what the admin console may move a client onto. It has no
// imports, so it loads as-is.
const M = await import(new URL("../src/lib/plan-options.js", import.meta.url).href + "?v=" + Date.now());
const { planOptions } = M;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);
const ids = (r) => r.map((x) => x.id);

const CAT = [
  { id: "trial", name: "Free Trial", biz: "both", active: true },
  { id: "shop_starter", name: "Shop Starter", biz: "ecommerce", active: true },
  { id: "shop_growth", name: "Shop Growth", biz: "ecommerce", active: true },
  { id: "svc_starter", name: "Service Starter", biz: "agency", active: true },
  { id: "svc_growth", name: "Service Growth", biz: "agency", active: true },
  { id: "pro", name: "Pro", biz: "both", active: false },       // retired
];

// ── a shop sees shop packages ──────────────────────────────────────────────
is("a shop is offered the trial and the shop packages",
  ids(planOptions(CAT, "shop_starter", "ecommerce")).sort(),
  ["shop_growth", "shop_starter", "trial"]);
is("and never the service ones",
  ids(planOptions(CAT, "shop_starter", "ecommerce")).some((i) => i.startsWith("svc_")), false);
is("a service is offered its own",
  ids(planOptions(CAT, "svc_starter", "agency")).sort(),
  ["svc_growth", "svc_starter", "trial"]);

// ── the rule that is easy to get wrong ─────────────────────────────────────
// A select whose value is not among its options renders BLANK, which reads as
// "this client has no plan". So the current one is always there.
ok("a client on a RETIRED package still sees it",
  ids(planOptions(CAT, "pro", "ecommerce")).includes("pro"));
ok("and it is offered first, where the reader is looking",
  planOptions(CAT, "pro", "ecommerce")[0].id === "pro");
ok("a client on the OTHER type's package still sees it",
  ids(planOptions(CAT, "svc_growth", "ecommerce")).includes("svc_growth"));
// But a retired package is not on the menu for anybody else.
is("nobody else is offered a retired one",
  ids(planOptions(CAT, "shop_starter", "ecommerce")).includes("pro"), false);

// ── before the catalogue arrives ───────────────────────────────────────────
is("an empty catalogue still shows what they are on", ids(planOptions([], "shop_growth", "ecommerce")), ["shop_growth"]);
is("and marks it as the current one", planOptions([], "shop_growth")[0].current, true);
is("no catalogue and no plan is an empty list", planOptions([], null), []);
is("undefined arguments do not throw", planOptions(), []);
is("a non-array catalogue does not throw", ids(planOptions(null, "trial")), ["trial"]);

// ── shapes that turn up in real rows ───────────────────────────────────────
// A row written before the biz column has none, and belongs to everybody —
// hiding it from the people it was written for is the worse mistake.
const OLD = [{ id: "legacy", name: "Legacy", active: true }];
ok("a package with no business type is offered to a shop", ids(planOptions(OLD, "trial", "ecommerce")).includes("legacy"));
ok("and to a service", ids(planOptions(OLD, "trial", "agency")).includes("legacy"));
// active is only false when it says so.
const NOFLAG = [{ id: "x", name: "X", biz: "both" }];
ok("a package with no active flag counts as active", ids(planOptions(NOFLAG, "trial")).includes("x"));
// Defaults to a shop, which is what business_type defaults to on a client row.
ok("no business type given reads as a shop", ids(planOptions(CAT, "trial")).includes("shop_starter"));
is("and not as a service", ids(planOptions(CAT, "trial")).includes("svc_starter"), false);
// Nulls in the list must not crash the console.
ok("a null row is skipped", ids(planOptions([null, ...CAT], "trial", "ecommerce")).includes("trial"));

// It only ever reads.
const before = JSON.parse(JSON.stringify(CAT));
planOptions(CAT, "pro", "ecommerce");
is("the catalogue handed in is not touched", CAT, before);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
