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
    const models = provider === "google" ? await listGoogleModels(apiKey) : await listOpenAIModels(apiKey);
    if (!models.length) return NextResponse.json({ error: "This key has no usable chat models." }, { status: 400 });
    return NextResponse.json({ ok: true, provider, models }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Could not read models: " + String(e.message || "unknown").slice(0, 200) }, { status: 400 });
  }
}, "ai-key-models");
