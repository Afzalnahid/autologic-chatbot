import crypto from "crypto";

// OAuth callbacks arrive as plain redirects and form POSTs, so they carry no
// session JWT. Without a signature, anyone could POST a client_id to the
// /select routes and attach their own Page to another tenant's account.
//
// We therefore mint a short-lived signed token when the flow starts and verify
// it before writing anything. The signing key is the app secret, which never
// leaves the server.

const SECRET =
  process.env.OAUTH_STATE_SECRET ||
  process.env.FB_APP_SECRET ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

const TTL_MS = 30 * 60 * 1000; // a connect flow should finish well within 30 min

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

// Returns "<clientId>.<issuedAt>.<signature>", safe to put in a URL.
export function signState(clientId) {
  if (!SECRET) throw new Error("OAuth state secret is not configured");
  const payload = `${clientId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

// Returns the client id, or null if the token is missing, tampered with or old.
export function verifyState(state) {
  if (!SECRET || !state) return null;

  const parts = String(state).split(".");
  if (parts.length !== 3) return null;

  const [clientId, issuedAt, signature] = parts;
  const payload = `${clientId}.${issuedAt}`;
  const expected = sign(payload);

  // Constant-time compare; Buffers must match in length first.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > TTL_MS) return null;

  return clientId || null;
}
