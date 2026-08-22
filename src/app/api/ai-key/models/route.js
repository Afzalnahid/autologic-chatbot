export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { listGoogleModels } from "@/lib/gemini.js";
import { listOpenAIModels } from "@/lib/openai.js";

// Reads the LIVE list of chat-capable models a pasted key can use, so the BYOK
// screen can offer a real main/fallback picker instead of a hardcoded id that
// Google or OpenAI may have retired. Same guards as /api/ai-key: the account
// must have been granted permission, and attempts are rate-limited because each
// one calls the provider with an unverified key.
export const POST = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = rateLimit(`ai-key-models:${client.id}`, 20, 3600000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, "Too many attempts — please wait a few minutes and try again.");

  const { data: row } = await supabase.from("client_ai").select("client_id").eq("client_id", client.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Your account is not enabled for its own API key. Please contact support." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const provider = body.provider === "openai" ? "openai" : body.provider === "google" ? "google" : null;
  const apiKey = String(body.api_key || "").trim();
  if (!provider || !apiKey) return NextResponse.json({ error: "Choose a provider and paste the key." }, { status: 400 });

  try {
    const all = provider === "google" ? await listGoogleModels(apiKey) : await listOpenAIModels(apiKey);
    if (!all.length) return NextResponse.json({ error: "This key has no usable chat models." }, { status: 400 });
    // Show a SHORT, sensible menu — a few fast/cheap models AND a couple of
    // higher-quality ones — not the provider's full catalogue of dozens. Each
    // carries a tier so the UI can label it and pick smart defaults (fast as
    // main, higher-quality as fallback). Verification (POST /api/ai-key) still
    // checks against the full live list, so any of these is always valid.
    let models = curate(provider, all);
    if (!models.length) models = all.slice(0, 6).map((m) => ({ id: m.id, name: m.displayName || m.id, tier: "fast", note: "" }));
    return NextResponse.json({ ok: true, provider, models }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Could not read models: " + String(e.message || "unknown").slice(0, 200) }, { status: 400 });
  }
}, "ai-key-models");

// "fast"  = cheap, quick — the right default for most replies.
// "smart" = higher quality, higher cost — a good fallback / upgrade.
const tierOf = (provider, m) =>
  provider === "google"
    ? (/pro/i.test(m) ? "smart" : "fast")
    : (/mini|nano|small/i.test(m) ? "fast" : "smart");

// Keep the FULL set of text chat models (with their official names), dropping
// only the ones a text bot can't use — image, audio, TTS, embedding and other
// special-purpose variants — since picking those would just break replies.
// Cheapest/fastest are sorted first so the default main choice stays economical.
// Input is [{id, displayName}]; output carries the official name + tier + note.
function curate(provider, all) {
  let good;
  if (provider === "google") {
    const drop = /embedding|image|tts|audio|vision|native|dialog|aqa|gemma|learnlm/i;
    good = all.filter((m) => !drop.test(m.id));
  } else {
    const drop = /instruct|search|audio|realtime|transcribe|tts|image|moderation|embedding|babbage|davinci/i;
    good = all.filter((m) => /^(gpt-5|gpt-4\.5|gpt-4\.1|gpt-4o|o[0-9])/i.test(m.id) && !drop.test(m.id));
  }
  // Fast/cheap first, then the higher-quality models.
  good.sort((a, b) => (tierOf(provider, a.id) === "fast" ? 0 : 1) - (tierOf(provider, b.id) === "fast" ? 0 : 1));
  return good.slice(0, 24).map((m) => {
    const tier = tierOf(provider, m.id);
    return {
      id: m.id,
      name: m.displayName || m.id,
      tier,
      note: tier === "fast" ? "Low cost · Fast" : "More powerful · Higher cost",
    };
  });
}
