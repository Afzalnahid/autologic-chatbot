// The password rule the screens show, and the one Supabase enforces, are the
// same rule.
//
// Owner, 2026-09-25, after setting it on the project: "password 8 and there is
// upper lower number mix need." The danger this suite guards is not a broken
// regex — it is the two drifting apart, so a person is promised one thing and
// refused for another.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { MIN_LENGTH, RULES, PASSWORD_HINT, checkPassword, passwordOk } from "../src/lib/password-rules.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── the rule as the project is actually configured ─────────────────────────
ok("the minimum is 8, as set on the Supabase project", MIN_LENGTH === 8);
ok("four things are checked: length, small, capital, number",
  RULES.map((r) => r.id).join(",") === "length,lower,upper,digit");

// ── what passes ────────────────────────────────────────────────────────────
ok("eight characters with all three kinds is fine", passwordOk("Dhaka123"));
ok("longer is fine", passwordOk("AmarDokan2026"));
ok("symbols are allowed, just not required", passwordOk("Dhaka#123"));
ok("a space counts as a character, not a disqualification", passwordOk("Boro Dokan 1"));

// ── what does not ──────────────────────────────────────────────────────────
ok("seven characters is refused, however mixed", !passwordOk("Dhak123"));
ok("no capital is refused", !passwordOk("dhaka123"));
ok("no small letter is refused", !passwordOk("DHAKA123"));
ok("no number is refused", !passwordOk("DhakaCity"));
ok("empty is refused", !passwordOk(""));
ok("a missing password does not throw", !passwordOk(undefined) && !passwordOk(null));
ok("a non-string does not throw", !passwordOk(12345678));

// ── what the person is told ────────────────────────────────────────────────
{
  ok("one character short is named as a length problem",
    /at least 8 characters/i.test(checkPassword("Dhak12").firstError));
  ok("a missing capital is named exactly",
    checkPassword("dhaka123").firstError === "Your password needs a capital letter.");
  // Everything missing at once still reads as one sentence, not four complaints.
  const all = checkPassword("abc").firstError;
  ok("several problems are one sentence", (all.match(/\./g) || []).length === 1);
  ok("…and it names every missing kind", /capital letter and a number/.test(all) && /8 characters/.test(all));
  ok("nothing wrong means nothing to say", checkPassword("Dhaka123").firstError === null);
  ok("the hint names the length and all three kinds",
    /8/.test(PASSWORD_HINT) && /capital/i.test(PASSWORD_HINT) && /small/i.test(PASSWORD_HINT) && /number/i.test(PASSWORD_HINT));
}

// ── it is used everywhere a password is chosen ─────────────────────────────
// A screen that sets a password without this check sends the person to Supabase
// to be refused, with a message written for a developer.
for (const [what, file] of [
  ["creating an account", ["src", "app", "dashboard-client.js"]],
  ["resetting a forgotten password", ["src", "app", "reset", "reset-client.js"]],
  ["an admin signing up", ["src", "app", "admin", "admin-client.js"]],
]) {
  const src = read(...file);
  ok(`${what} checks the password before sending it`, /password-rules\.js/.test(src));
}

// ── and nothing states the rule in its own words ───────────────────────────
// A hard-coded "8 characters" somewhere is exactly how the screen and the
// server drift apart the day the setting changes.
for (const file of [
  ["src", "app", "dashboard-client.js"],
  ["src", "app", "reset", "reset-client.js"],
  ["src", "app", "admin", "admin-client.js"],
]) {
  // Comments stripped: a note explaining what the rule USED to be is history
  // worth keeping. What must not exist is a live string stating the rule, which
  // is how a screen and the server drift apart the day the setting changes.
  const code = read(...file).replace(/^\s*\/\/.*$/gm, "");
  ok(`${file[file.length - 1]} does not spell the rule out itself`,
    !/at least \d+ characters/i.test(code));
}

// Leaked-password checking is a Pro feature and is OFF, so no screen may claim
// the password was checked against known breaches.
for (const file of [
  ["src", "lib", "password-rules.js"],
  ["src", "app", "dashboard-client.js"],
  ["src", "app", "reset", "reset-client.js"],
]) {
  const src = read(...file);
  ok(`${file[file.length - 1]} promises nothing about breached passwords`,
    !/\b(pwned|breach(ed)?|leaked) password/i.test(src.replace(/^\s*\/\/.*$/gm, "")));
}

console.log(`t-password-rules: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
