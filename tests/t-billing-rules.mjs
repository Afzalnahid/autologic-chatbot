// Payment rows that block, wait for a person, or can still become a plan
// (lib/billing-rules.js). Found 2026-10-03: an online checkout the customer
// walked away from stayed "pending" for ever — it blocked their next payment and
// sat in the admin queue, where approving it gave a plan for money never received.
// Also here: a package saved with a blank Channels box became a 1-channel cap.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const B = await import(pathToFileURL(join(root, "src", "lib", "billing-rules.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const now = Date.parse("2026-10-03T12:00:00Z");
const ago = (min) => new Date(now - min * 60000).toISOString();
const online = (min, status = "pending") => ({ method: "online", status, created_at: ago(min) });
const manual = (min, status = "pending") => ({ method: "bkash", status, created_at: ago(min) });

ok("a fresh online checkout is not abandoned", !B.isAbandonedOnline(online(5), now));
ok("an online checkout past the hour is abandoned", B.isAbandonedOnline(online(B.ONLINE_CHECKOUT_TTL_MIN + 1), now));
ok("a manual payment is never abandoned, however old", !B.isAbandonedOnline(manual(60 * 24 * 7), now));
ok("an approved online row is not abandoned", !B.isAbandonedOnline(online(500, "approved"), now));
ok("a fresh online checkout blocks a new payment", B.blocksNewPayment(online(5), now));
ok("an abandoned online checkout does not block", !B.blocksNewPayment(online(120), now));
ok("a pending manual payment blocks", B.blocksNewPayment(manual(600), now));
ok("an expired row does not block", !B.blocksNewPayment(online(5, "expired"), now));
ok("a rejected row does not block", !B.blocksNewPayment(manual(5, "rejected"), now));
ok("a gateway can still activate an expired checkout", B.ACTIVATABLE.includes("expired") && B.ACTIVATABLE.includes("pending"));
ok("an approved row cannot be activated twice", !B.ACTIVATABLE.includes("approved"));
ok("an admin may approve a pending manual payment", B.adminMayApprove(manual(5)));
ok("an admin may NOT approve an online payment by hand", !B.adminMayApprove(online(5)));
ok("an admin may not approve an already rejected payment", !B.adminMayApprove(manual(5, "rejected")));

const act = read("src", "lib", "billing-activate.js");
ok("activation claims with the ACTIVATABLE list", /\.in\("status", ACTIVATABLE\)/.test(act));
ok("abandoned checkouts are expired by method online + pending + age", /eq\("method", "online"\)\.eq\("status", "pending"\)\.lt\("created_at", cutoff\)/.test(act));
const manualRoute = read("src", "app", "api", "billing", "route.js");
ok("manual payment closes abandoned checkouts before the one-at-a-time check", /await expireAbandonedCheckouts\(client\.id\);\s*const \{ data: existing \}/.test(manualRoute));
ok("billing GET reports only blocking rows as pending", /requests\.find\(\(r\) => blocksNewPayment\(r\)\)/.test(manualRoute));
const checkout = read("src", "app", "api", "billing", "checkout", "route.js");
ok("online checkout closes abandoned checkouts first", /await expireAbandonedCheckouts\(client\.id\);\s*const \{ data: existing \}/.test(checkout));
const callback = read("src", "app", "api", "billing", "callback", "route.js");
ok("a cancelled/failed gateway return closes that checkout", /status: "expired"[\s\S]*\.eq\("txn_id", tranId\)\.eq\("method", "online"\)\.eq\("status", "pending"\)/.test(callback));
const admin = read("src", "app", "api", "admin", "route.js");
ok("admin approval refuses online rows", /decision === "approve" && !adminMayApprove\(pr\)/.test(admin));
ok("admin counts only manual pending payments", /pending_payments: payRows\.filter\(adminMayApprove\)\.length/.test(admin));
const adminUi = read("src", "app", "admin", "admin-client.js");
ok("admin queue lists only payments a person can approve", /const pending = payments\.filter\(adminMayApprove\)/.test(adminUi));

// Blank Channels box = no cap.
const pkgRoute = read("src", "app", "api", "admin", "packages", "route.js");
ok("saving a package keeps a blank Channels box as no cap", /channels: int\(p\.channels\),/.test(pkgRoute) && !/channels: int\(p\.channels\) \?\? 1/.test(pkgRoute));
const pkgUi = read("src", "app", "admin", "Packages.js");
ok("a new package starts with no channel cap", /channels: null, features: \{\}/.test(pkgUi));

console.log(`t-billing-rules: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
