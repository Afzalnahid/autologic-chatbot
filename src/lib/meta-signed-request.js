// Meta's signed_request — how Facebook and Instagram prove that a deauthorize or
// data-deletion call really comes from them. It is "<sig>.<payload>", both
// base64url; the payload is JSON ({ algorithm: "HMAC-SHA256", issued_at,
// user_id }) and the signature is HMAC-SHA256 of the ENCODED payload with the
// app secret of the app the person removed.
//
// Pure (node crypto only) so tests/t-meta-signed-request.mjs can cover it.
// Nothing here throws: a malformed or forged request is simply null, so the
// routes answer 400 instead of crashing with a 500 (the old data-deletion
// route did exactly that on junk input, and the Instagram deauth route checked
// nothing at all — anyone could post a user_id and disconnect an account).
import crypto from "crypto";

const b64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function parseSignedRequest(signedRequest, secret) {
  try {
    if (!secret || typeof signedRequest !== "string") return null;
    const parts = signedRequest.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [encodedSig, payload] = parts;
    const sig = b64url(encodedSig);
    const expected = crypto.createHmac("sha256", secret).update(payload).digest();
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
    const data = JSON.parse(b64url(payload).toString("utf8"));
    if (!data || typeof data !== "object") return null;
    if (data.algorithm && String(data.algorithm).toUpperCase() !== "HMAC-SHA256") return null;
    if (data.user_id == null || String(data.user_id) === "") return null;
    return data;
  } catch {
    return null;
  }
}

// Try each app's secret in turn; the first that verifies names the app.
// secrets: { facebook: "...", instagram: "..." } (missing ones are skipped).
export function verifySignedRequest(signedRequest, secrets = {}) {
  for (const [app, secret] of Object.entries(secrets)) {
    const data = parseSignedRequest(signedRequest, secret);
    if (data) return { app, userId: String(data.user_id), data };
  }
  return null;
}

// Meta posts application/x-www-form-urlencoded; accept multipart and JSON too
// so an odd client cannot make the route throw. Returns "" when absent.
export async function readSignedRequest(request) {
  try {
    const type = String(request.headers.get("content-type") || "").toLowerCase();
    if (type.includes("application/json")) {
      const body = await request.json();
      return String(body?.signed_request || "");
    }
    const text = await request.text();
    if (type.includes("multipart/form-data")) {
      const m = text.match(/name="signed_request"\r?\n\r?\n([^\r\n]*)/);
      return m ? m[1] : "";
    }
    return String(new URLSearchParams(text).get("signed_request") || "");
  } catch {
    return "";
  }
}

// For building a valid request in tests (and nowhere else).
export function makeSignedRequest(data, secret) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${sig}.${payload}`;
}
