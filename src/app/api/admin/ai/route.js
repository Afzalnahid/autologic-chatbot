export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { callerEmail, callerRole, CAN_DELETE, checkSuperKey } from "@/lib/admin-auth.js";
import { encryptSecret, maskKey } from "@/lib/crypt.js";
import { listModels, verifyModels } from "@/lib/model-catalog.js";
import { invalidatePlatformAI } from "@/lib/platform-ai.js";

// The platform's own AI key and models, managed from the admin panel instead of
// only a Vercel environment variable.
//
// This key pays for EVERY client who is not on their own key, so it is guarded
// like the AI-key grant is: full-access admin AND the secret admin key. The key
// itself is never sent back to the browser — only a mask.

const ROW = "main";

const shape = (r, envKey) => ({
  provider: r?.provider || "google",
  key_mask: r?.api_key_enc ? r.key_mask : null,
  has_key: !!r?.api_key_enc,
  model_chain: r?.model_chain || "",
  status: r?.api_key_enc ? (r.status || "verified") : "no_key",
  last_verified_at: r?.last_verified_at || null,
  last_error: r?.last_error || null,
  // Honest about the fallback: with no saved key the bot still runs, on the
  // environment variable — the admin needs to know which one is live.
  using_env: !r?.api_key_enc && !!envKey,
  env_present: !!envKey,
});

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data } = await supabase.from("platform_ai").select("*").eq("id", ROW).maybeSingle();
  return NextResponse.json({ role, ...shape(data, process.env.GEMINI_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const provider = body.provider === "openai" ? "openai" : "google";

  // Listing models only reads from the provider, so it needs no second factor.
  if (action === "list_models") {
    const key = String(body.api_key || "").trim() || (provider === "google" ? process.env.GEMINI_API_KEY : "");
    if (!key) return NextResponse.json({ error: "Paste a key first — there is none saved or in the environment." }, { status: 400 });
    try {
      const models = await listModels(provider, key);
      if (!models.length) return NextResponse.json({ error: "This key has no usable chat models." }, { status: 400 });
      return NextResponse.json({ ok: true, provider, models });
    } catch (e) {
      return NextResponse.json({ error: "Could not read models: " + String(e.message || "unknown").slice(0, 200) }, { status: 400 });
    }
  }

  // Anything that CHANGES the platform key or models needs the secret key too.
  const keyErr = checkSuperKey(request);
  if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });

  const models = (Array.isArray(body.models) ? body.models : String(body.model_chain || "").split(","))
    .map((s) => String(s).trim()).filter(Boolean).slice(0, 2);

  if (action === "save") {
    const apiKey = String(body.api_key || "").trim();
    const { data: existing } = await supabase.from("platform_ai").select("api_key_enc").eq("id", ROW).maybeSingle();
    // A key must exist somewhere to verify the chosen models against: the new
    // one being pasted, the one already saved, or the environment variable.
    const keyForCheck = apiKey || (existing?.api_key_enc ? null : process.env.GEMINI_API_KEY);
    if (models.length && (apiKey || keyForCheck)) {
      const check = await verifyModels(provider, apiKey || keyForCheck, models);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const patch = {
      id: ROW, provider,
      model_chain: models.join(",") || null,
      updated_by: email, updated_at: now,
    };
    if (apiKey) {
      patch.api_key_enc = encryptSecret(apiKey);
      patch.key_mask = maskKey(apiKey);
      patch.status = "verified";
      patch.last_verified_at = now;
      patch.last_error = null;
    }
    const { error } = await supabase.from("platform_ai").upsert(patch, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidatePlatformAI();
    const { data } = await supabase.from("platform_ai").select("*").eq("id", ROW).maybeSingle();
    return NextResponse.json({ ok: true, ...shape(data, process.env.GEMINI_API_KEY) });
  }

  // Removing the saved key drops the platform back to the environment variable
  // — the bot keeps working, which is why this is safe to offer.
  if (action === "remove_key") {
    const { error } = await supabase.from("platform_ai").update({
      api_key_enc: null, key_mask: null, status: "no_key",
      last_verified_at: null, last_error: null, updated_by: email, updated_at: new Date().toISOString(),
    }).eq("id", ROW);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidatePlatformAI();
    const { data } = await supabase.from("platform_ai").select("*").eq("id", ROW).maybeSingle();
    return NextResponse.json({ ok: true, ...shape(data, process.env.GEMINI_API_KEY) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
