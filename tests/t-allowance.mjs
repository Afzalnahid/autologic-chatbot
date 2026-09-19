// Products and knowledge documents are counted as ADDS (owner's rule,
// 2026-09-19): every add uses one, a delete does not give it back, and the
// catalogue itself may never hold more than the package number either.
import { addVerdict, addRefusal } from "../src/lib/allowance.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};

// No limit set → always allowed.
ok("no max means no limit", addVerdict({ max: null, added: 9999, stored: 9999 }).ok);
ok("undefined max means no limit", addVerdict({ added: 5, stored: 5 }).ok);

// The ordinary case.
ok("room left → allowed", addVerdict({ max: 500, added: 10, stored: 10 }).ok);
ok("the last one fits exactly", addVerdict({ max: 500, added: 499, stored: 499 }).ok);
ok("one past the limit is refused", !addVerdict({ max: 500, added: 500, stored: 400 }).ok);

// Delete-and-re-add: catalogue has room, but the package's total adds are spent.
const churn = addVerdict({ max: 500, added: 500, stored: 3 });
ok("deleting does not give an add back", !churn.ok && churn.reason === "added", churn);

// A full catalogue refuses even with adds left (e.g. products from before adds were counted).
const full = addVerdict({ max: 500, added: 0, stored: 500 });
ok("a full catalogue refuses even with adds left", !full.ok && full.reason === "stored", full);

// A batch counts as its size.
ok("a batch that fits is allowed", addVerdict({ max: 500, added: 480, stored: 480, adding: 20 }).ok);
ok("a batch that overflows is refused", !addVerdict({ max: 500, added: 481, stored: 481, adding: 20 }).ok);
ok("adding 0 is treated as 1", !addVerdict({ max: 500, added: 500, stored: 0, adding: 0 }).ok);

// Limits stored as text (Postgres numerics can arrive as strings).
ok("text limits are compared as numbers", addVerdict({ max: "500", added: "499", stored: "10" }).ok);

// The sentences.
const m1 = addRefusal(churn, { planName: "Basic", noun: "products" });
ok("the added refusal says deleting does not give it back", /Deleting does not give an add back/.test(m1), m1);
ok("and names the number as a total", /500 products in total/.test(m1), m1);
ok("and never promises a monthly reset", !/a month|resets on the 1st/.test(m1) && /does not reset each month/.test(m1), m1);
const m2 = addRefusal(full, { planName: "Basic", noun: "products" });
ok("the stored refusal tells them to remove some", /Remove some/.test(m2), m2);
const m3 = addRefusal(churn, { planName: "Free Trial", noun: "knowledge documents", trial: true });
ok("the trial refusal points to a package", /Choose a package/.test(m3) && !/a month/.test(m3), m3);

console.log(`t-allowance: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
