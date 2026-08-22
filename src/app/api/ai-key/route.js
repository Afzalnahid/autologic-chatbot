export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { encryptSecret, maskKey } from "@/lib/crypt.js";
import { verifyOpenAIKey, listOpenAIModels } from "@/lib/openai.js";
import { listGoogleModels } from "@/lib/gemini.js";

// The client side of BYOK. The super admin grants permission (creates the
// client_ai row from the admin console); only then does the dashboard show
// the key box this route serves. The key itself is pasted BY THE CLIENT,
// verified with the provider before saving, stored encrypted, and returned
// only masked. Once saved, the client's bot runs exclusively on it.

const shape = (row) => row ? ({
  allowed: true,
  provider: row.provider || null,
  model: row.model || null,
  key_mask: row.api_key_enc ? row.key_mask : null,
  has_key: !!row.api_key_enc,
  status: row.api_key_enc ? row.status : "no_key",
  last_verified_at: row.last_verified_at,
  key_added_at: row.key_added_at,
  last_error: row.last_error,
  last_error_at: row.last_error_at,
}) : { allowed: false };

export const GET = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase.from("client_ai").select("*").eq("client_id", client.id).maybeSingle();
  return NextResponse.json(shape(data), { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}, "ai-key");

export const POST = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Each attempt verifies against the provider — keep a lost client from
  // hammering it with bad keys.
  const rl = rateLimit(`ai-key:${client.id}`, 10, 3600000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, "Too many attempts — please wait a few minutes and try again.");

  const { data: row } = await supabase.from("client_ai").select("client_id").eq("client_id", client.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Your account is not enabled for its own API key. Please contact support." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const provider = body.provider === "openai" ? "openai" : body.provider === "google" ? "google" : null;
  const apiKey = String(body.api_key || "").trim();
  // The client picks a main model and an optional fallback. Arrives as an array
  // [main, fallback] or a comma string; we keep the chain (main first) in the
  // existing text column so no schema change is needed.
  const models = (Array.isArray(body.models) ? body.models : String(body.model || "").split(","))
    .map((s) => String(s).trim()).filter(Boolean).slice(0, 2);
  if (!provider || !apiKey) return NextResponse.json({ error: "Choose a provider and paste the key." }, { status: 400 });

  const check = await verifyAIKey(provider, apiKey, models);
  if (!check.ok) return NextResponse.json({ error: "The key did not work: " + check.error }, { status: 400 });

  const model = models.join(",").slice(0, 80) || null;
  const now = new Date().toISOString();
  const { data: saved, error } = await supabase.from("client_ai").update({
    provider, model,
    api_key_enc: encryptSecret(apiKey), key_mask: maskKey(apiKey),
    status: "verified", last_verified_at: now, key_added_at: now,
    last_error: null, last_error_at: null, updated_at: now,
  }).eq("client_id", client.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...shape(saved) });
}, "ai-key");

// Removing the key puts the client back on the platform key; the permission
// row stays, so the box remains and they can paste a new key any time.
export const DELETE = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: saved, error } = await supabase.from("client_ai").update({
    provider: null, model: null, api_key_enc: null, key_mask: "",
    status: "no_key", last_verified_at: null, key_added_at: null,
    last_error: null, last_error_at: null, updated_at: new Date().toISOString(),
  }).eq("client_id", client.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...shape(saved) });
}, "ai-key");

// Verify the key by asking the provider for its LIVE model list (this is also
// the real proof the key works), then confirm every model the client chose is
// actually on that list. Never assumes a hardcoded model id — that is exactly
// what produced the "gemini-2.5-flash is no longer available" 404.
async function verifyAIKey(provider, apiKey, models) {
  try {
    const available = provider === "google"
      ? await listGoogleModels(apiKey)
      : await listOpenAIModels(apiKey);
    if (!available.length) return { ok: false, error: "This key has no usable chat models." };
    for (const m of models) {
      if (m && !available.includes(m)) {
        return { ok: false, error: `This key cannot use "${m}". Available: ${available.slice(0, 4).join(", ")}${available.length > 4 ? "…" : ""}` };
      }
    }
    return { ok: true, available };
  } catch (e) {
    return { ok: false, error: String(e.message || "unknown").slice(0, 200) };
  }
}
