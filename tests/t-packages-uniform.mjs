// A package is a SIZE, not a smaller product.
//
// The owner's rule, 2026-09-18: every package carries every feature, and what
// separates them is how much — replies, channels, products, documents, imports,
// broadcasts. Before it, four capabilities were withheld by tier (photo
// matching, comment automation, calendar booking, own AI key), the free trial
// gave MORE than the ৳1,500 package that followed it, and the public pricing
// table disagreed with the enforced truth in three places at once.
//
// The machinery that can switch a feature off per package stays — it is what a
// per-client exception is built on, and a future package may need it. What is
// held here is the VALUES, in the two places a customer meets them: the seed a
// fresh database is built from, and the comparison table on the pricing page.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const { FEATURE_KEYS } = await import(pathToFileURL(join(ROOT, "src", "lib", "features.js")).href + "?v=" + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── The seed every fresh database is built from ────────────────────────────
{
  const sql = read("docs", "sql", "2026-08-31-plans-biz.sql");
  const maps = [...sql.matchAll(/'(\{"vision"[^']*\})'::jsonb/g)].map((m) => JSON.parse(m[1]));
  ok("the seed carries every package", maps.length === 7);
  for (const [i, m] of maps.entries()) {
    ok(`seed package ${i + 1} names all ${FEATURE_KEYS.length} switches`, FEATURE_KEYS.every((k) => k in m));
    ok(`seed package ${i + 1} withholds nothing`, Object.values(m).every((v) => v === true));
  }
}

// ── The public comparison table ────────────────────────────────────────────
{
  const src = read("src", "app", "pricing", "pricing-client.js");
  const block = src.slice(src.indexOf("const COMPARE = ["), src.indexOf("];", src.indexOf("const COMPARE = [")));
  const rows = [...block.matchAll(/\{[^}]*label: "([^"]+)"[^}]*\}/g)].map((m) => ({ label: m[1], raw: m[0] }));
  ok("the table has rows to check", rows.length >= 15);

  // A capability row is one whose cells are booleans. Every one of them must be
  // true across the board — except priority support, which is a human promise
  // and not a switch the product enforces.
  const caps = rows.filter((r) => /trial: (true|false)/.test(r.raw));
  ok("there are capability rows", caps.length >= 10);
  for (const r of caps) {
    if (/Priority support/i.test(r.label)) {
      ok("priority support is still the one top-tier line", /enterprise: true/.test(r.raw) && /pro: false/.test(r.raw));
      continue;
    }
    ok(`"${r.label}" is on for every tier`, !/: false/.test(r.raw));
  }

  // The numbers are what the table is FOR, so they must still differ.
  const replies = rows.find((r) => r.label === "Bot replies");
  ok("bot replies are still a ladder", replies && /"2,000 \/ mo"/.test(replies.raw) && /"12,000 \/ mo"/.test(replies.raw));
  const channels = rows.find((r) => r.label === "Channels");
  ok("channels still climb", channels && /basic: "2"/.test(channels.raw) && /pro: "All 3"/.test(channels.raw));
  ok("the table leads with the numbers", rows[0].label === "Bot replies" && rows[1].label === "Channels");
  ok("and says so above itself", /Every plan has every feature/.test(src));
}

// ── The bullets sell size, not a feature somebody else cannot have ─────────
{
  const { PLANS } = await import(pathToFileURL(join(ROOT, "src", "lib", "plans.js")).href + "?v=" + Date.now());
  const paid = Object.values(PLANS).filter((p) => Number(p.monthly) > 0);
  ok("there are paid packages", paid.length === 3);
  for (const p of paid) {
    const first = (p.features || [])[0] || "";
    ok(`${p.id} leads with its reply allowance`, /bot replies \/ month/i.test(first));
  }
  // The old bullets promised capabilities as if they were exclusive.
  const all = Object.values(PLANS).flatMap((p) => p.features || []);
  for (const gone of ["Photo product matching (Vision AI)", "Comment automation on your posts", "Google Calendar booking with Meet links", "Use your own AI key"]) {
    ok(`no bullet still sells "${gone}" as a step up`, !all.includes(gone));
  }
}

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
