export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";
import { withErrors } from "@/lib/route-errors.js";
import { planActive } from "@/lib/plans.js";
import { resolveAudience, sendableChannels, remainingQuota, WINDOW_HOURS } from "@/lib/broadcast.js";

const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } };

export const GET = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [channels, quota, listQ] = await Promise.all([
    sendableChannels(client.id),
    remainingQuota(client),
    supabase.from("broadcasts").select("*")
      .eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    business_type: client.business_type || "ecommerce",
    plan_active: planActive(client),
    window_hours: WINDOW_HOURS,
    channels: channels.map((c) => ({ platform: c.platform, page_id: c.page_id })),
    quota,
    broadcasts: listQ.data || [],
  }, NO_CACHE);
}, "broadcast");

// Preview only. Says exactly who would receive the message and why anyone else
// would not, before a single message is sent.
export const POST = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.action !== "preview") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const audience = await resolveAudience(
    client.id,
    client.business_type || "ecommerce",
    body.segment || {}
  );
  const quota = await remainingQuota(client);

  return NextResponse.json({
    counts: audience.counts,
    quota,
    over_quota: !quota.unlimited && audience.counts.eligible > quota.remaining,
    tags_available: audience.tagsAvailable,
    // Enough to show the owner who this is, without shipping the whole list.
    sample: audience.eligible.slice(0, 8).map((r) => ({ name: r.name, platform: r.platform, last_at: r.last_at })),
    skipped_sample: audience.skipped.slice(0, 8).map((r) => ({ name: r.name, platform: r.platform, reason: r.reason })),
  }, NO_CACHE);
}, "broadcast");
