export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { runFollowups } from "@/lib/followup.js";
import { followupClientIds, timeLeft } from "@/lib/followup-cron.js";

// Every 30 minutes: send the follow-ups that are due, for every account that
// switched them on. Called by .github/workflows/followups.yml — Vercel's Hobby
// plan allows a cron only once a day, and a follow-up must land inside Meta's
// 24-hour window, so a daily run would miss most of them.
//
// Until this existed, follow-ups ran only while the owner's dashboard loaded the
// inbox (GET /api/conversations still calls runFollowups too — harmless, it
// throttles itself to once per 15 minutes per account).
//
// Safe to call as often as anyone likes: runFollowups sends a customer at most
// one follow-up per 30 days and only when it is actually due. Same auth rule as
// /api/cron/expiry: `Authorization: Bearer $CRON_SECRET` when that is set.
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron/followups] CRON_SECRET is not set — this endpoint is open. Set it in the Vercel project settings.");
    return true;
  }
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();

  // Narrowed at the database (->> gives 'true' for a boolean true and for the
  // string "true" alike); followupClientIds re-checks and de-duplicates.
  const { data: rows, error } = await supabase.from("app_settings").select("id, settings")
    .eq("settings->followup->>enabled", "true").limit(5000);
  if (error) {
    console.error("[cron/followups] could not read settings:", error.message);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  const ids = followupClientIds(rows);
  const settingsOf = new Map((rows || []).map((r) => [String(r.id), r.settings || {}]));

  let sent = 0, visited = 0, unfinished = 0;
  const skipped = {};
  const failed = [];

  // One account at a time, and one failure never stops the rest.
  for (const id of ids) {
    if (!timeLeft(startedAt)) { unfinished = ids.length - visited; break; }
    visited++;
    try {
      const { data: client, error: cErr } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!client) { skipped.no_client = (skipped.no_client || 0) + 1; continue; }
      const r = await runFollowups(client, settingsOf.get(id));
      if (r?.skipped) skipped[r.skipped] = (skipped[r.skipped] || 0) + 1;
      sent += r?.sent || 0;
    } catch (e) {
      failed.push({ client_id: id, error: String(e?.message || e).slice(0, 160) });
      console.error("[cron/followups]", id, String(e?.message || e).slice(0, 200));
    }
  }

  return NextResponse.json({ accounts: ids.length, visited, unfinished, sent, skipped, failed });
}
