export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { dhakaDay } from "@/lib/usage.js";
import { callsPerModel, busyModels, busyEvent, warnMark } from "@/lib/ai-alerts.js";
import { logEvent } from "@/lib/platform-events.js";

// Every half hour (with the follow-ups, .github/workflows/followups.yml): count
// today's calls on the PLATFORM's AI key, per model, and warn the owner once a
// day when a model passes the busy mark (AI_DAILY_WARN_CALLS). It is the early
// warning; a model actually reaching its limit is reported the moment it
// happens (src/lib/ai-alerts.js, from src/lib/gemini.js).
//
// Reads usage_daily across every client on purpose — this is the platform's own
// bill, not any one client's data — and writes nothing but the event.
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.warn("[cron/ai-usage] CRON_SECRET is not set — this endpoint is open."); return true; }
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const day = dhakaDay();
  const { data, error } = await supabase.from("usage_daily")
    .select("model,calls,own_key").eq("day", day).eq("own_key", false).limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const perModel = callsPerModel(data);
  const warnAt = warnMark();
  const busy = busyModels(perModel, warnAt);
  const ev = busyEvent(busy, warnAt);
  // logEvent collapses repeats (ai_busy: once in 20 hours)
  if (ev) await logEvent(ev);
  return NextResponse.json({ ok: true, day, warnAt, perModel, warned: !!ev });
}
