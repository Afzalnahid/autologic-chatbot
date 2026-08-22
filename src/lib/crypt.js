import crypto from "crypto";

// Client AI keys are encrypted at rest with AES-256-GCM. The master key is
// derived from AI_KEY_SECRET when set, otherwise from the Supabase service key
// — already secret, already present in every environment, so the owner has
// nothing new to configure. The service key lives under SUPABASE_SERVICE_KEY in
// this project (see src/lib/supabase.js); SUPABASE_SERVICE_ROLE_KEY is accepted
// too as a legacy alias. If that secret is ever rotated, old ciphertexts become
// unreadable and the super admin simply re-enters the affected keys (they are
// shown as "failing" because decryption errors fall back to the platform key
// rather than crashing a reply).
let _master = null;
function masterKey() {
  if (_master) return _master;
  const secret = process.env.AI_KEY_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No AI_KEY_SECRET, SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY set — cannot encrypt or decrypt keys");
  _master = crypto.scryptSync(secret, "autologic-client-ai-v1", 32);
  return _master;
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
}

export function decryptSecret(enc) {
  const [v, ivB, tagB, ctB] = String(enc || "").split(".");
  if (v !== "v1" || !ivB || !tagB || !ctB) throw new Error("unknown key format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}

// The only form of a key any dashboard ever sees.
export function maskKey(k) {
  const s = String(k || "");
  return s.length <= 10 ? "••••••" : `${s.slice(0, 5)}…${s.slice(-4)}`;
}
