// A pragmatic email-FORMAT check for the sign-in / create-account screens.
// Not full RFC 5322 — that standard accepts strings no real mailbox uses and
// rejects nothing a typo would produce. This catches the mistakes an owner or
// a customer actually makes: no "@", nothing before it, no dot in the domain,
// a stray space (common on a phone keyboard), or an empty field.
//
// This is the FIRST gate, not the only one: it stops an obviously wrong
// address before a round trip to the server. Whether the address really
// belongs to the person typing it is a second, separate gate — Supabase's own
// "confirm your email" link, when that project setting is on (see AuthGate's
// "Check your email to confirm" message). Format-valid is not the same as
// real; both gates matter and neither replaces the other.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 && s.length <= 254 && EMAIL_RE.test(s);
}
