import { fileURLToPath as __f } from "node:url";
import { readFileSync } from "node:fs";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// limit-conflicts.js imports only plans.js, which imports nothing, so both
// load as-is with no shim.
const v = Date.now();
const L = await import(__R("src/lib/limit-conflicts.js?v=").href + v);
const P = await import(__R("src/lib/plans.js?v=").href + v);
const { limitConflicts, limitMeaning, trialTotal, trialTextMismatch } = L;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);
const has = (name, list, needle) => ok(name, list.some((s) => s.includes(needle)));

// ── the trial speaks in days, not months ───────────────────────────────────
is("the trial length is a shared constant, not a magic number", P.TRIAL_DAYS, 3);

is("a trial has no monthly channel box", limitMeaning("messages_per_channel", "trial").label, "Bot replies / channel / trial");
is("nor a monthly scrape box", limitMeaning("max_scrapes_per_month", "trial").label, "Website scrapes / trial");
is("nor monthly broadcasts", limitMeaning("max_broadcasts_per_month", "trial").label, "Broadcasts / trial");
is("a paid package keeps its months", limitMeaning("max_scrapes_per_month", "pro").label, "Website scrapes / month");
is("and its monthly channel cap", limitMeaning("messages_per_channel", "pro").label, "Bot replies / channel / month");
ok("the trial's scrape note says which window", limitMeaning("max_scrapes_per_month", "trial").note.includes("3 days"));
is("a paid package's scrape box needs no note", limitMeaning("max_scrapes_per_month", "pro").note, null);
// The trial length flows into the wording rather than being written twice.
ok("the trial length reaches the label", limitMeaning("messages_per_channel", "trial", 7).note.includes("7 days"));
ok("and one day is not pluralised", limitMeaning("messages_per_channel", "trial", 1).note.includes("1 day,"));

// ── the box that is read by nothing says so ────────────────────────────────
ok("a trial's monthly messages box is marked unused", limitMeaning("messages_per_month", "trial").note.includes("Not used"));
is("a package's monthly messages box is fine", limitMeaning("messages_per_month", "pro").note, null);
ok("a package's daily box is marked unused", limitMeaning("messages_per_day", "pro").note.includes("Not used"));
is("a trial's daily box is the live one", limitMeaning("messages_per_day", "trial").note, null);
// Both of these were read by nothing until 2026-08-30 and the panel said so.
// They are enforced now, so nothing may still claim otherwise — a stale "not
// enforced" note would tell the owner to ignore a limit that now bites.
for (const k of ["channels", "max_broadcasts_per_month"]) {
  for (const plan of ["trial", "pro"]) {
    is(`${k} on ${plan} no longer claims to be unenforced`, /Not enforced/.test(limitMeaning(k, plan).note || ""), false);
  }
}
// What is left to say about the channel box is what it counts: the widget has
// its own switch and does not use one of these slots.
ok("the channel box says the widget is separate", /widget is separate/.test(limitMeaning("channels", "pro").note));
is("a package's broadcast box needs nothing said", limitMeaning("max_broadcasts_per_month", "pro").note, null);
// Products and knowledge files are counts, not windows, and are enforced.
is("products needs nothing said", limitMeaning("max_products", "trial"), { label: null, note: null });
is("knowledge files neither", limitMeaning("max_kb_files", "pro"), { label: null, note: null });
is("an unknown key keeps the caller's label", limitMeaning("something_else", "pro"), { label: null, note: null });

// ── the whole-trial total ──────────────────────────────────────────────────
const tt = trialTotal({ messages_per_day: 30 }, "trial");
is("three days of thirty is ninety", tt.total, 90);
ok("and it is said in words", tt.text.includes("3 days × 30 a day = 90"));
is("a paid package has no trial total", trialTotal({ messages_per_day: 30 }, "pro"), null);
is("an unlimited daily figure has no total", trialTotal({}, "trial"), null);
is("a longer trial multiplies out", trialTotal({ messages_per_day: 30 }, "trial", 7).total, 210);

// ── the cap that quietly becomes the ceiling ───────────────────────────────
// The owner's package: 30 a day over 3 days is 90, but 10 per channel is 10.
const trial = limitConflicts(
  { messages_per_day: 30, messages_per_month: 900, messages_per_channel: 10, channels: 1 }, "trial");
is("one warning, not one per box", trial.length, 1);
has("the real ceiling is spelled out", trial, "allows 10 for the whole trial");
has("against what the daily figure allows", trial, "below the 90");
has("with the way out", trial, "Clear the box");
// Both sides measured over the same window, so the comparison is like for like.
is("a cap that matches the trial total is fine",
  limitConflicts({ messages_per_day: 30, messages_per_channel: 90, channels: 1 }, "trial"), []);
is("and a bigger one is fine", limitConflicts({ messages_per_day: 30, messages_per_channel: 200, channels: 1 }, "trial"), []);
has("a longer trial raises the bar",
  limitConflicts({ messages_per_day: 30, messages_per_channel: 90, channels: 1 }, "trial", 7), "below the 210");

// A paid package compares against its monthly figure.
has("a cap below the monthly figure is reported",
  limitConflicts({ messages_per_month: 3000, messages_per_channel: 500, channels: 1 }, "pro"), "allows 500 a month");
is("caps that add up to the monthly figure are fine",
  limitConflicts({ messages_per_month: 3000, messages_per_channel: 1000, channels: 3 }, "pro"), []);
has("channels is pluralised",
  limitConflicts({ messages_per_month: 3000, messages_per_channel: 100, channels: 2 }, "pro"), "2 channels");
// An empty "Channels allowed" box means unlimited, the same as every other
// box, so there is no number to multiply by and no ceiling to claim.
is("a missing channel count says nothing rather than guessing at one",
  limitConflicts({ messages_per_month: 3000, messages_per_channel: 100 }, "pro"), []);
is("an unlimited plan with a cap says nothing",
  limitConflicts({ messages_per_channel: 100, channels: 1 }, "pro"), []);
// A package being created has no id, so nothing can be judged about its period.
is("a package with no id is not judged",
  limitConflicts({ messages_per_month: 3000, messages_per_channel: 10 }, ""), []);

// ── empty is unlimited, not zero ───────────────────────────────────────────
is("an empty box is not a limit of zero", limitConflicts({ messages_per_month: "", messages_per_channel: "" }, "trial"), []);
is("junk in a box is ignored", limitConflicts({ messages_per_month: "abc" }, "trial"), []);
is("no limits at all is quiet", limitConflicts({}, "pro"), []);
is("no arguments at all does not throw", limitConflicts(), []);
is("strings read the same as numbers",
  limitConflicts({ messages_per_day: "30", messages_per_month: "900", messages_per_channel: "10", channels: "1" }, "trial"),
  trial);
// A zero IS a real limit — it stops the channel — so it must be reported.
has("a cap of zero is reported, not treated as empty",
  limitConflicts({ messages_per_month: 3000, messages_per_channel: 0, channels: 1 }, "pro"), "allows 0 a month");

// ── it only ever describes ─────────────────────────────────────────────────
const before = { messages_per_day: 30, messages_per_month: 900, messages_per_channel: 10, channels: 1 };
const copy = JSON.parse(JSON.stringify(before));
limitConflicts(before, "trial"); trialTotal(before, "trial");
is("the limits handed in are not touched", before, copy);
is("TRIAL is the same plan as trial", limitMeaning("max_scrapes_per_month", " TRIAL ").label, "Website scrapes / trial");

// ── the number written in the owner's own words ────────────────────────────
// Changing the box does not change the tagline, and the tagline is what a
// customer reads on the pricing page.
ok("a stale tagline is caught", trialTextMismatch("Try everything for 3 days", 5).includes("3 days"));
ok("and it says what the trial really runs", trialTextMismatch("Try everything for 3 days", 5).includes("runs 5 days"));
is("a tagline that agrees is quiet", trialTextMismatch("Try everything for 5 days", 5), null);
is("a tagline that says nothing about days is quiet", trialTextMismatch("For growing businesses", 5), null);
is("one day is not pluralised in the answer", trialTextMismatch("Try it for 4 days", 1).includes("runs 1 day."), true);
// The forms an owner actually types.
ok("a hyphen still reads", trialTextMismatch("A 3-day free trial", 5) !== null);
ok("the singular still reads", trialTextMismatch("Just 1 day free", 5) !== null);
is("and the singular that agrees is quiet", trialTextMismatch("Just 1 day free", 1), null);
// Not every number in a sentence is a length: only the one attached to "day".
is("other numbers are left alone", trialTextMismatch("3,000 messages and 20 products", 5), null);
is("nor is a word that merely starts with day", trialTextMismatch("Daylight support", 5), null);
// Nothing to compare against, nothing to say.
is("no text is quiet", trialTextMismatch("", 5), null);
is("no text at all is quiet", trialTextMismatch(null, 5), null);
is("no length is quiet", trialTextMismatch("Try everything for 3 days", null), null);
is("bullets are joined and still read", trialTextMismatch(["Full access", "3 days of it"].join(" "), 5) !== null, true);

// ── Channels are not rationed by package (owner, 2026-09-24) ───────────────
// "Every channel will exist in every package, because if we give the full
// access of the channel there is no loss for us — the AI reply remains the
// same." A reply costs a model call; a connected channel costs nothing. The
// caps only ever produced shops with an unanswered Instagram.
{
  const ids = ["trial", ...P.PAID_PLANS];
  for (const id of ids) ok(id + " places no cap on channels", P.PLANS[id].channels === null);
  ok("and none of them is merely missing the field", ids.every((id) => "channels" in P.PLANS[id]));
  // The words on the cards have to agree with the rule, or the pricing page
  // goes on selling a limit that no longer exists.
  const promises = ids.flatMap((id) => P.PLANS[id].features || []).filter((f) => /channel/i.test(f));
  ok("every card that mentions channels says every channel",
    promises.length > 0 && promises.every((f) => f.startsWith("Every channel:")));
  ok("no card counts them any more",
    !promises.some((f) => /\b(1|2|3|one|two|three)\b/i.test(f.replace(/Messenger|Instagram|WhatsApp/g, ""))));
}

// The fallback used when the plans table cannot be read must not quietly
// reintroduce a cap of one — which is exactly what it used to do.
{
  const src = readFileSync(new URL("../src/lib/plan-limits.js", import.meta.url), "utf8");
  ok("the constant fallback leaves channels unlimited", src.includes("channels: p.channels ?? null,"));
  ok("it no longer defaults to a single channel", !src.includes("channels: p.channels ?? 1,"));
  ok("an unset channel limit still means no limit", src.includes('channels: pick("channels") ?? null,'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

