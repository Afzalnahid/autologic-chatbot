import crypto from "crypto";

// Registering a WhatsApp number on Cloud API — the step that lets it SEND.
// Pure (no network, no database) so the decisions are tested on their own in
// tests/t-wa-register.mjs; lib/wa-connect.js does the calls.
//
// Why this exists (2026-09-20): completeWhatsApp used to register with a new
// RANDOM six-digit PIN every time, never stored, and ignored any error. Two
// failures followed. A number whose two-step PIN was set by someone else (a
// previous provider, or the owner in WhatsApp Manager) failed to register, and
// the owner was still shown "Connected" while the bot could not send. And a
// number WE registered could never be registered again (a reconnect, a move to
// another TellMore account), because the random PIN we had set was lost.

// The same PIN for the same number every time, from the server secret, so a
// reconnect by us always matches the PIN we set before, with nothing stored.
export function pinFor(phoneId, secret) {
  const h = crypto.createHmac("sha256", String(secret || "")).update("wa-pin:" + String(phoneId)).digest();
  return String(h.readUInt32BE(0) % 1000000).padStart(6, "0");
}

// Meta's error codes for /register that mean something the owner can act on.
const PIN_CODES = new Set([133005, 133008, 133009]);   // PIN mismatch / too many PIN guesses
const REVERIFY_CODES = new Set([133006]);               // number needs re-verification
const RATE_CODES = new Set([133016, 133004]);           // too many attempts / temporarily unavailable

// Decides whether the number can send after the /register call.
//   reg  — Meta's response to POST /{phone}/register ({ success } or { error })
//   info — GET /{phone}?fields=platform_type,status,... (may be null/unreadable)
// Returns { ok: true } or { ok: false, reason, message } with a plain message.
export function registerVerdict(reg, info) {
  if (reg && !reg.error) return { ok: true };
  const code = Number(reg?.error?.code) || 0;
  const sub = Number(reg?.error?.error_subcode) || 0;
  if (PIN_CODES.has(code) || PIN_CODES.has(sub)) {
    return { ok: false, reason: "pin", message:
      "This number has a two-step verification PIN that was set before (by you or a previous provider), so Meta would not let us switch it on. " +
      "Open WhatsApp Manager → Phone numbers → this number → Two-step verification, turn the PIN off, then connect again." };
  }
  if (REVERIFY_CODES.has(code) || REVERIFY_CODES.has(sub)) {
    return { ok: false, reason: "verify", message:
      "Meta needs this number verified again before it can send. Connect again and enter the code Meta sends by SMS or call." };
  }
  if (RATE_CODES.has(code) || RATE_CODES.has(sub)) {
    return { ok: false, reason: "later", message:
      "Meta is limiting attempts for this number right now. Please wait an hour, then connect again." };
  }
  // Any other refusal: the number may already be live on Cloud API — registered
  // earlier, or shared from the WhatsApp Business app (coexistence), where Meta
  // can refuse a second registration. Meta's own record of the number decides.
  if (info && !info.error && String(info.platform_type || "").toUpperCase() === "CLOUD_API") return { ok: true, already: true };
  if (info && info.is_on_biz_app === true) return { ok: true, already: true, coexistence: true };
  const detail = String(reg?.error?.error_user_msg || reg?.error?.message || "").slice(0, 200);
  return { ok: false, reason: "other", message:
    "Meta did not switch this number on for sending" + (detail ? ` (${detail})` : "") + ". Nothing was saved — please try connecting again, and tell us if it repeats." };
}
