// What a password has to be, in one place.
//
// Owner, 2026-09-25: "I need to mention the password setting to my login page —
// password 8 and there is upper lower number mix need."
//
// These MUST match what Supabase Auth actually enforces, because Supabase is the
// one that says no. If the screen promises something looser, the person types a
// password, presses the button, and gets a refusal for a rule nobody told them
// about. If it promises something stricter, they are turned away from a password
// that would have worked.
//
// Set on the project 2026-09-25 (Authentication → Sign In / Providers → Email):
//   Minimum password length ....... 8
//   Password requirements ......... Lowercase, uppercase letters and digits
//
// Leaked-password checking (HaveIBeenPwned) is NOT on — Supabase only offers it
// on the Pro plan. So nothing here can promise a password is not already in a
// public breach, and nothing here says so.
//
// **If those dashboard settings ever change, change these two constants in the
// same hour.** They are the only description of the rule the customer ever sees.

export const MIN_LENGTH = 8;

/** Each test a password must pass, in the order they are shown. */
export const RULES = [
  { id: "length", label: `At least ${MIN_LENGTH} characters`, test: (p) => p.length >= MIN_LENGTH },
  { id: "lower", label: "A small letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "A capital letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "A number (0–9)", test: (p) => /[0-9]/.test(p) },
];

/** One line, for a hint under the field before anything is typed. */
export const PASSWORD_HINT =
  `At least ${MIN_LENGTH} characters, with a capital letter, a small letter and a number.`;

/**
 * Which rules this password passes. Never throws, and a null/undefined password
 * is simply one that passes nothing.
 * → { ok, passed: {id: bool}, failed: [rule], firstError: string|null }
 */
export function checkPassword(pw) {
  const p = typeof pw === "string" ? pw : "";
  const passed = {};
  const failed = [];
  for (const r of RULES) {
    const good = r.test(p);
    passed[r.id] = good;
    if (!good) failed.push(r);
  }
  return {
    ok: failed.length === 0,
    passed,
    failed,
    // Worth saying only once, and only about the first thing wrong — a list of
    // four complaints about an empty box helps nobody.
    firstError: failed.length ? messageFor(failed) : null,
  };
}

/** True when this password would be accepted. */
export const passwordOk = (pw) => checkPassword(pw).ok;

// One sentence naming everything still missing, so somebody who is one
// character away is not sent round the loop four times.
function messageFor(failed) {
  const short = failed.find((f) => f.id === "length");
  const missing = failed.filter((f) => f.id !== "length").map((f) => ({
    lower: "a small letter", upper: "a capital letter", digit: "a number",
  }[f.id]));
  const list = missing.length === 0 ? ""
    : missing.length === 1 ? missing[0]
    : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  if (short && list) return `Your password needs at least ${MIN_LENGTH} characters, and ${list}.`;
  if (short) return `Your password needs at least ${MIN_LENGTH} characters.`;
  return `Your password needs ${list}.`;
}
