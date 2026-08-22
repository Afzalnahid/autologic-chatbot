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
    if (!models.length) models = all.slice(0, 6).map((id) => ({ id, tier: "fast", note: "" }));
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

// Trim the provider's list to a balanced handful: keep both a few fast models
// AND a couple of higher-quality ones, so there is always a real fallback.
function curate(provider, models) {
  let good;
  if (provider === "google") {
    const drop = /embedding|image|tts|audio|vision|thinking|\bexp\b|gemma|learnlm|aqa|dialog|native/i;
    good = models.filter((m) => /flash|pro/i.test(m) && !drop.test(m));
  } else {
    const drop = /instruct|search|audio|realtime|transcribe|tts|image|moderation|embedding|babbage|davinci/i;
    good = models.filter((m) => /^(gpt-4o|gpt-4\.1|o[0-9])/i.test(m) && !drop.test(m));
  }
  const fast = good.filter((m) => tierOf(provider, m) === "fast");
  const smart = good.filter((m) => tierOf(provider, m) === "smart");
  // Up to 3 fast + up to 2 higher-quality — fast first so the main default is cheap.
  return [...fast.slice(0, 3), ...smart.slice(0, 2)].map((id) => ({
    id,
    tier: tierOf(provider, id),
    note: tierOf(provider, id) === "fast" ? "Fast · low cost" : "Higher quality · higher cost",
  }));
}
