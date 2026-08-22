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
    // Show a SHORT, sensible menu — the few models that make sense for a bot,
    // cheapest first — not the provider's full catalogue of dozens (many are
    // experimental, image/audio-only, or costly). Verification (POST /api/ai-key)
    // still checks against the full live list, so any of these is always valid.
    const models = curate(provider, all);
    return NextResponse.json({ ok: true, provider, models: models.length ? models : all.slice(0, 6) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Could not read models: " + String(e.message || "unknown").slice(0, 200) }, { status: 400 });
  }
}, "ai-key-models");

// Trim the provider's list to a handful of chat models that suit a support bot,
// cheapest/fastest first so the default main choice is cost-efficient.
function curate(provider, models) {
  if (provider === "google") {
    // Keep only the general flash/pro chat models; drop experimental, image,
    // audio, thinking and other special variants.
    const drop = /embedding|image|tts|audio|vision|thinking|\bexp\b|gemma|learnlm|aqa|dialog|native/i;
    const good = models.filter((m) => /flash|pro/i.test(m) && !drop.test(m));
    // flash (cheapest) before pro.
    good.sort((a, b) => (/(flash)/i.test(b) ? 1 : 0) - (/(flash)/i.test(a) ? 1 : 0));
    return good.slice(0, 6);
  }
  // OpenAI: the mainstream gpt-4o / gpt-4.1 / o-series chat models only.
  const drop = /instruct|search|audio|realtime|transcribe|tts|image|moderation|embedding|babbage|davinci/i;
  return models.filter((m) => /^(gpt-4o|gpt-4\.1|o[0-9])/i.test(m) && !drop.test(m)).sort().slice(0, 6);
}
