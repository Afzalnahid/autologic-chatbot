// "Revenue" used to mean: read the plan column, multiply by the price. It
// counted a package that expired last week, an account comped to 2029, a
// suspended one, and it charged a BYOK client the standard price they do not
// pay. On a platform with zero recorded payments it reported ৳8,500 a month.
// These checks hold the difference between what is BILLED and what was
// RECEIVED, and every reason a client is worth nothing.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const { clientRevenue, receivedRevenue, revenueSummary, NO_REVENUE } =
  await import(pathToFileURL(join(ROOT, "src", "lib", "revenue.js")).href + "?v=" + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const FROM = "2026-08-19T00:00:00.000Z";
const TO = "2026-09-18T00:00:00.000Z";          // exactly 30 days
const W = { from: FROM, to: TO };
const GROWTH = { id: "shop_growth", monthly: 3500, byok_monthly: 2500 };
const STARTER = { id: "shop_starter", monthly: 1500, byok_monthly: 1000 };

// ── A plain paying client ──────────────────────────────────────────────────
{
  const r = clientRevenue({ plan: "shop_growth" }, GROWTH, W);
  ok("a full window of a ৳3,500 package is ৳3,500", near(r.bdt, 3500));
  ok("and it is not flagged partial", r.partial === false && r.reason === null);
}

// ── Expiry: the bug that would have started on 2026-09-20 ──────────────────
{
  // Expires 10 days into a 30-day window.
  const r = clientRevenue({ plan: "shop_growth", plan_expires_at: "2026-08-29T00:00:00.000Z" }, GROWTH, W);
  ok("an expiry inside the window is counted to the day", near(r.bdt, (3500 / 30) * 10));
  ok("and the panel is told it was partial", r.partial === true);

  const gone = clientRevenue({ plan: "shop_growth", plan_expires_at: "2026-07-01T00:00:00.000Z" }, GROWTH, W);
  ok("a package that expired before the window earns nothing", gone.bdt === 0);
  ok("and says so", gone.reason === "expired_before" && NO_REVENUE.expired_before);

  const later = clientRevenue({ plan: "shop_growth", plan_expires_at: "2029-08-17T00:00:00.000Z" }, GROWTH, W);
  ok("an expiry after the window does not shorten it", near(later.bdt, 3500));
}

// ── The exclusions ─────────────────────────────────────────────────────────
{
  ok("an internal account earns nothing", clientRevenue({ plan: "svc_growth", internal: true }, GROWTH, W).reason === "internal");
  ok("a suspended one earns nothing", clientRevenue({ plan: "shop_growth", suspended: true }, GROWTH, W).reason === "suspended");
  ok("a trial earns nothing", clientRevenue({ plan: "trial" }, null, W).reason === "trial");
  ok("no plan earns nothing", clientRevenue({ plan: "none" }, null, W).reason === "no_plan");
  ok("a plan the catalogue does not know earns nothing", clientRevenue({ plan: "ghost" }, null, W).reason === "no_plan");
  ok("a zero-priced package earns nothing", clientRevenue({ plan: "x" }, { monthly: 0 }, W).reason === "free");
  ok("internal beats suspended in the reason shown",
    clientRevenue({ plan: "shop_growth", internal: true, suspended: true }, GROWTH, W).reason === "internal");
  ok("every reason has a sentence for the owner",
    ["internal", "suspended", "no_plan", "trial", "expired_before", "free"].every((k) => typeof NO_REVENUE[k] === "string" && NO_REVENUE[k].length > 3));
}

// ── BYOK is a different price, and it was never applied ────────────────────
{
  const std = clientRevenue({ plan: "shop_growth" }, GROWTH, W);
  const own = clientRevenue({ plan: "shop_growth" }, GROWTH, { ...W, ownKey: true });
  ok("a client on their own key is billed the own-key price", near(own.bdt, 2500));
  ok("which is less than the standard one", own.bdt < std.bdt);
  ok("and it is marked", own.ownKey === true && std.ownKey === false);
  const noByok = clientRevenue({ plan: "p" }, { monthly: 1500 }, { ...W, ownKey: true });
  ok("a package with no own-key price falls back to the standard one", near(noByok.bdt, 1500));
}

// ── Bad input must not invent money ────────────────────────────────────────
{
  ok("no window, no revenue", clientRevenue({ plan: "shop_growth" }, GROWTH, {}).bdt === 0);
  ok("a backwards window earns nothing", clientRevenue({ plan: "shop_growth" }, GROWTH, { from: TO, to: FROM }).bdt === 0);
  ok("no client at all does not throw", clientRevenue(undefined, undefined, W).bdt === 0);
}

// ── Received: only approved money, dated when it was approved ──────────────
{
  const pay = [
    { status: "approved", amount: 3500, reviewed_at: "2026-09-01T00:00:00.000Z" },
    { status: "pending", amount: 9999, created_at: "2026-09-02T00:00:00.000Z" },
    { status: "approved", amount: 1500, paid_at: "2026-09-03T00:00:00.000Z", reviewed_at: "2026-07-01T00:00:00.000Z" },
    { status: "approved", amount: 6000, reviewed_at: "2026-01-01T00:00:00.000Z" },   // before the window
    { status: "rejected", amount: 500, reviewed_at: "2026-09-04T00:00:00.000Z" },
    { status: "approved", amount: 0, reviewed_at: "2026-09-05T00:00:00.000Z" },
  ];
  const got = receivedRevenue(pay, W);
  ok("only approved payments inside the window count", near(got.bdt, 5000) && got.count === 2);
  ok("a pending request is not income", !/9999/.test(String(got.bdt)));
  ok("paid_at wins over reviewed_at", near(got.bdt, 5000));  // the 1500 dated 09-03, not 07-01
  ok("an empty book is zero, not a crash", receivedRevenue([], W).bdt === 0 && receivedRevenue(undefined, W).count === 0);
}

// ── The whole platform, as the panel reads it ──────────────────────────────
{
  // The real shape on 2026-09-18: three paid accounts, one of them internal,
  // one expiring inside the window, and no payments at all.
  const clients = [
    { id: "a", plan: "shop_growth", plan_expires_at: "2026-08-29T00:00:00.000Z" },
    { id: "b", plan: "svc_growth", internal: true, plan_expires_at: "2029-08-17T00:00:00.000Z" },
    { id: "c", plan: "shop_starter", plan_expires_at: "2026-11-09T00:00:00.000Z" },
    { id: "d", plan: "trial" },
    { id: "e", plan: "trial" },
  ];
  const s = revenueSummary(clients, { shop_growth: GROWTH, svc_growth: GROWTH, shop_starter: STARTER }, [], W);
  ok("billed counts only what is really owed", near(s.billed, (3500 / 30) * 10 + 1500));
  ok("nothing was received", s.received === 0 && s.payments === 0);
  ok("so everything billed is outstanding", near(s.outstanding, s.billed));
  ok("the internal account is counted as excluded, not as revenue", s.excluded.internal === 1);
  ok("both trials are named too", s.excluded.trial === 2);
  ok("a row comes back per client", s.rows.length === 5 && s.rows[0].client_id === "a");
  // The old number, for contrast: 3500 + 3500 + 1500 = 8500.
  ok("and it is far below the old plan-column figure", s.billed < 8500 * 0.6);
}

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
