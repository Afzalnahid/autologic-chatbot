export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { listModels } from "@/lib/model-catalog.js";

// Reads the LIVE list of chat models a pasted key can use, so the BYOK screen
// offers real choices instead of a hardcoded id the provider may have retired.
// The list itself comes from src/lib/model-catalog.js, shared with the admin
// panel's platform-AI screen so the two can never disagree.
//
// Same guards as /api/ai-key: the account must have been granted permission,
// and attempts are rate-limited because each one calls the provider.
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
    const models = await listModels(provider, apiKey);
    if (!models.length) return NextResponse.json({ error: "This key has no usable chat models." }, { status: 400 });
    return NextResponse.json({ ok: true, provider, models }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Could not read models: " + String(e.message || "unknown").slice(0, 200) }, { status: 400 });
  }
}, "ai-key-models");
