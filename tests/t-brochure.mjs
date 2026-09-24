// The product document says the same thing the product does.
//
// Owner, 2026-09-25: "be careful, don't put any false information."
//
// A brochure is the easiest document in a company to leave wrong: a price rises
// in the app, and the PDF that was emailed to a hundred people still says the
// old one. This suite fails the moment the two disagree — on prices, on limits,
// on the trial, and on the contact details — so the document cannot quietly go
// stale while the product moves.
//
// It also checks the things a reader would notice: that every screen named in
// the document actually has a screenshot on disk, and that neither language is
// missing a section the other has.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLANS, TRIAL_DAYS } from "../src/lib/plans.js";
import { COMPANY } from "../src/lib/company.js";
import { META, COVER, INTRO, HOWITWORKS, SECTIONS, EXTRA_FEATURES } from "../docs/brochure/content.mjs";
import { PLANS_TABLE, COMPARISON, SECURITY, CONTACT } from "../docs/brochure/commercial.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── prices are the app's prices ────────────────────────────────────────────
for (const row of PLANS_TABLE.rows) {
  const p = PLANS[row.id];
  ok(`${row.id} exists in the app`, !!p);
  if (!p) continue;
  ok(`${row.id} name matches`, p.name === row.name);
  ok(`${row.id} monthly price matches (${p.monthly})`, p.monthly === row.monthly);
  ok(`${row.id} yearly price matches (${p.yearly})`, p.yearly === row.yearly);
  ok(`${row.id} own-key price matches (${p.byokMonthly})`, p.byokMonthly === row.byok);
  ok(`${row.id} monthly replies match (${p.messagesPerMonth})`, p.messagesPerMonth === row.perMonth);
}

// Every sellable package is in the document — a package the app sells and the
// brochure omits is a package nobody is offered.
{
  const sellable = Object.values(PLANS).filter((p) => p.id !== "trial").map((p) => p.id).sort();
  const listed = PLANS_TABLE.rows.map((r) => r.id).sort();
  ok(`all ${sellable.length} sellable packages are in the document`, sellable.join() === listed.join());
}

ok("the trial length matches the app", PLANS_TABLE.trialDays === TRIAL_DAYS);
ok("the trial daily allowance matches the app", PLANS_TABLE.trialPerDay === PLANS.trial.messagesPerDay);

// ── contact details are the company's ──────────────────────────────────────
ok("the product name matches", META.product === COMPANY.name);
ok("the company name matches", META.company === COMPANY.legalName);
ok("the email matches", META.email === COMPANY.email);
ok("the phone matches", META.phone === COMPANY.phone);
ok("the address contains the registered city", META.address.includes(COMPANY.city));
ok("the parent site matches", COMPANY.parentUrl.includes(META.parent.replace(/^www\./, "")));
for (const lang of ["en", "bn"]) {
  ok(`the ${lang} cover says it is an Autolinium product`, /Autolinium|অটোলিনিয়াম/.test(COVER[lang].badge));
}

// ── every screen named has a real screenshot ───────────────────────────────
for (const s of SECTIONS) {
  const p = join(root, "docs", "shots", `${s.shot}.png`);
  ok(`${s.shot} has a screenshot file`, existsSync(p));
  // A blank render is a few hundred bytes. A real screen is tens of kilobytes.
  if (existsSync(p)) ok(`${s.shot}'s screenshot is not a blank page`, statSync(p).size > 20000);
}
ok("there are screenshots for a real number of screens", SECTIONS.length >= 15);

// ── neither language is missing anything ───────────────────────────────────
for (const s of SECTIONS) {
  for (const lang of ["en", "bn"]) {
    const c = s[lang];
    ok(`${s.shot} has ${lang} text`, !!(c && c.h && c.lead && c.body && c.how));
  }
  // A screen marked as one business type in one language must be marked in the
  // other, or a reader of one edition is told something the other is not.
  ok(`${s.shot} marks its business type the same way in both`, !!s.en.biz === !!s.bn.biz);
}
for (const [name, block] of [["intro", INTRO], ["how it works", HOWITWORKS], ["extra features", EXTRA_FEATURES],
  ["packages", PLANS_TABLE], ["comparison", COMPARISON], ["security", SECURITY], ["contact", CONTACT]]) {
  ok(`${name} has both languages`, !!block.en && !!block.bn);
}
ok("both editions compare the same number of points", COMPARISON.en.rows.length === COMPARISON.bn.rows.length);
ok("both editions list the same number of packages notes", PLANS_TABLE.en.notes.length === PLANS_TABLE.bn.notes.length);
ok("both editions admit the same number of weaknesses", COMPARISON.en.honest.length === COMPARISON.bn.honest.length);

// ── the honesty rules this document was written under ──────────────────────
// Every competitor fact carries a source and the date it was read. A claim
// without one is exactly the false information the owner asked to avoid.
ok("there is at least one sourced competitor", COMPARISON.sources.length > 0);
for (const s of COMPARISON.sources) {
  ok(`${s.name} cites a url`, /\w+\.\w+/.test(s.url));
  ok(`${s.name} cites the date it was read`, /\d{4}/.test(s.read));
  ok(`${s.name} has the facts in both languages`, !!s.en && !!s.bn);
}
// The comparison must not claim to be the best — that is an opinion, and the
// document is supposed to carry only what can be checked.
for (const lang of ["en", "bn"]) {
  const text = JSON.stringify(COMPARISON[lang]);
  ok(`the ${lang} comparison does not call itself the best`, !/\bbest\b|সেরা(?!”)/i.test(text.replace(/“[^”]*”/g, "")));
  ok(`the ${lang} comparison says where we are weaker`, COMPARISON[lang].honest.length >= 2);
}
// No invented customer results anywhere in the document.
{
  const all = JSON.stringify([INTRO, HOWITWORKS, SECTIONS, EXTRA_FEATURES, PLANS_TABLE, COMPARISON, SECURITY, CONTACT]);
  ok("no percentage increase is claimed", !/\d+%\s*(more|increase|growth|বেশি বিক্রি)/i.test(all));
  ok("no customer testimonial is quoted", !/testimonial|case study|কেস স্টাডি/i.test(all));
}

console.log(`t-brochure: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
