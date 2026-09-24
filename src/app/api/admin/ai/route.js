export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { callerEmail, callerRole, CAN_DELETE, checkSuperKey } from "@/lib/admin-auth.js";
import { encryptSecret, maskKey } from "@/lib/crypt.js";
import { listModels, verifyModels } from "@/lib/model-catalog.js";
import { invalidatePlatformAI, platformProviders } from "@/lib/platform-ai.js";
import { syncPlatformKeyToVercel, vercelSyncConfigured } from "@/lib/vercel-env.js";
import { PROVIDERS, PROVIDER_IDS, DEFAULT_PROVIDER, normaliseProvider, joinChain, canEnable } from "@/lib/ai-providers.js";
import { logEvent } from "@/lib/platform-events.js";

// The platform's own AI keys and models, managed from the admin panel instead
// of only a Vercel environment variable.
//
// Two providers now, with one switch between them (owner, 2026-09-24): turning
// one on turns the other off, both may be off, both on is impossible — refused
// here AND by a unique index in the database, so no bug or hand-run UPDATE can
// produce the mixture. Both off means the platform runs on the GEMINI_API_KEY
// environment variable, which is how it worked before any of this existed.
//
// These keys pay for EVERY client who is not on their own key, so changing one
// is guarded like the AI-key grant is: full-access admin AND the secret admin
// key. A key itself is never sent back to the browser — only a mask.

const envKeyFor = (id) => (id === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY) || "";

async function state() {
  const rows = await platformProviders();
  return {
    providers: rows.map((r) => ({
      ...r,
      label: PROVIDERS[r.id].label,
      key_label: PROVIDERS[r.id].keyLabel,
      key_hint: PROVIDERS[r.id].keyHint,
      default_chain: PROVIDERS[r.id].defaultChain,
      embed_model: PROVIDERS[r.id].embedModel,
      // Honest about the fallback: with no saved key the bot may still run, on
      // the environment variable — the admin needs to know which one is live.
      env_present: !!envKeyFor(r.id),
    })),
    active: rows.find((r) => r.enabled)?.id || null,
    // Nothing switched on: the environment key answers, and it is Gemini's.
    using_env: !rows.some((r) => r.enabled && r.has_key),
    env_present: !!envKeyFor(DEFAULT_PROVIDER),
  };
}

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ role, vercel_sync: vercelSyncConfigured(), ...(await state()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const provider = normaliseProvider(body.provider) || DEFAULT_PROVIDER;

  // Listing models only reads from the provider, so it needs no second factor.
  if (action === "list_models") {
    const key = String(body.api_key || "").trim() || envKeyFor(provider);
    if (!key) return NextResponse.json({ error: `Paste a ${PROVIDERS[provider].keyLabel} first — there is none saved or in the environment.` }, { status: 400 });
    try {
      const models = await listModels(provider, key);
      if (!models.length) return NextResponse.json({ error: "This key has no usable chat models." }, { status: 400 });
      return NextResponse.json({ ok: true, provider, models });
    } catch (e) {
      return NextResponse.json({ error: "Could not read models: " + String(e.message || "unknown").slice(0, 200) }, { status: 400 });
    }
  }

  // Anything that CHANGES a key, the models or the switch needs the secret key.
  const keyErr = checkSuperKey(request);
  if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });

  // ── the switch ────────────────────────────────────────────────────────────
  // Written as two steps, off-then-on, never on-then-off: the database's unique
  // index allows at most one enabled row, so turning the new one on first would
  // be refused. The moment in between has NEITHER on, which is a safe state —
  // the platform answers on the environment key — and it lasts milliseconds.
  if (action === "set_active") {
    const wanted = body.active === null || body.active === "" ? null : normaliseProvider(body.active);
    if (body.active && !wanted) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

    const rows = await platformProviders();
    if (wanted) {
      const row = rows.find((r) => r.id === wanted);
      if (!canEnable(row) && !envKeyFor(wanted)) {
        return NextResponse.json({
          error: `Save a ${PROVIDERS[wanted].keyLabel} before switching ${PROVIDERS[wanted].label} on — turning it on with no key would stop every bot.`,
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const off = await supabase.from("platform_ai").update({ enabled: false, updated_by: email, updated_at: now }).in("id", PROVIDER_IDS);
    if (off.error) return NextResponse.json({ error: off.error.message }, { status: 500 });
    if (wanted) {
      const on = await supabase.from("platform_ai").update({ enabled: true, updated_by: email, updated_at: now }).eq("id", wanted);
      if (on.error) return NextResponse.json({ error: on.error.message }, { status: 500 });
    }
    invalidatePlatformAI();

    // The single most consequential switch on the platform: it changes which
    // provider answers every message for every client on the platform key, and
    // it makes their saved vectors invisible until the sweep rebuilds them. It
    // goes on the record with the name of whoever threw it.
    logEvent({
      kind: "provider_switched",
      title: wanted ? `AI provider switched to ${PROVIDERS[wanted]?.label || wanted}` : "AI providers all switched off",
      body: wanted
        ? `By ${email}. Saved vectors are being rebuilt in the background.`
        : `By ${email}. The platform falls back to the GEMINI_API_KEY environment variable.`,
      url: "/admin#ai",
    }).catch(() => {});

    // The vector space may have just changed for every client on the platform
    // key. Kick the rebuild now rather than leaving it until the night — it is
    // bounded per run and safe to call at any time.
    kickReembed(request);
    return NextResponse.json({ ok: true, reembedding: true, ...(await state()) });
  }

  const models = (Array.isArray(body.models) ? body.models : String(body.model_chain || "").split(","))
    .map((s) => String(s).trim()).filter(Boolean).slice(0, 2);

  if (action === "save") {
    const apiKey = String(body.api_key || "").trim();
    const { data: existing } = await supabase.from("platform_ai").select("api_key_enc").eq("id", provider).maybeSingle();
    // A key must exist somewhere to verify the chosen models against: the new
    // one being pasted, the one already saved, or the environment variable.
    const keyForCheck = apiKey || (existing?.api_key_enc ? null : envKeyFor(provider));
    if (models.length && (apiKey || keyForCheck)) {
      const check = await verifyModels(provider, apiKey || keyForCheck, models);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const patch = {
      id: provider, provider,
      model_chain: joinChain(models[0], models[1]) || null,
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

    // Optionally mirror a GOOGLE key into the Vercel env var (GEMINI_API_KEY),
    // if a Vercel token is configured. The database copy above is what goes
    // live immediately; this keeps the env in sync as a backup. Google only —
    // GEMINI_API_KEY is a Google key by definition, and writing an OpenAI key
    // into it would give the fallback path a key it cannot use.
    let vercel = null;
    if (apiKey && provider === "google" && vercelSyncConfigured()) {
      vercel = await syncPlatformKeyToVercel(apiKey);
    } else if (apiKey && provider === "google") {
      vercel = { skipped: true, reason: "Vercel env sync is off (no VERCEL_TOKEN set)." };
    }

    return NextResponse.json({ ok: true, vercel, ...(await state()) });
  }

  // Removing a saved key. If that provider was the one switched on, it is
  // switched off in the same breath — a provider that is "on" with no key would
  // stop every bot, and leaving that state reachable is how an outage happens.
  if (action === "remove_key") {
    const { error } = await supabase.from("platform_ai").update({
      api_key_enc: null, key_mask: null, status: "no_key", enabled: false,
      last_verified_at: null, last_error: null, updated_by: email, updated_at: new Date().toISOString(),
    }).eq("id", provider);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidatePlatformAI();
    return NextResponse.json({ ok: true, ...(await state()) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

// Fire-and-forget: the admin's answer never waits on a catalogue rebuild.
function kickReembed(request) {
  try {
    const url = new URL("/api/cron/embeddings", new URL(request.url).origin).toString();
    const headers = process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
    fetch(url, { method: "POST", headers, cache: "no-store" }).catch(() => {});
  } catch { /* the nightly run covers it */ }
}
