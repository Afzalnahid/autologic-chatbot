export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";
import { featureGate } from "@/lib/plan-limits.js";
import { withErrors } from "@/lib/route-errors.js";
import { planActive } from "@/lib/plans.js";
import { resolveAudience, sendableChannels, remainingQuota, cannotSendReason, WINDOW_HOURS } from "@/lib/broadcast.js";
import { createBroadcast, processBroadcast, MAX_MESSAGE } from "@/lib/broadcast-send.js";
import { tagsFor } from "@/lib/tags.js";
import { checkBroadcastQuota } from "@/lib/plan-limits.js";

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

  // "Replied": recipients the broadcast reached who wrote back afterwards.
  // Counted from the same tables the Inbox reads — recipients (who, when it
  // was sent) against customer messages that came later — inside this
  // client's rows only. Fails soft to 0 so the list never waits on it.
  const list = listQ.data || [];
  const replied = {};
  if (list.length) {
    try {
      const { data: recips } = await supabase.from("broadcast_recipients")
        .select("broadcast_id,sender_id,sent_at").eq("client_id", client.id).eq("status", "sent")
        .in("broadcast_id", list.map((b) => b.id)).limit(20000);
      const rows = recips || [];
      if (rows.length) {
        const oldest = rows.reduce((a, r) => (r.sent_at && r.sent_at < a ? r.sent_at : a), rows[0].sent_at || new Date().toISOString());
        const { data: msgs } = await supabase.from("message_buffer").select("sender_id,created_at")
          .eq("client_id", client.id).eq("role", "customer").gte("created_at", oldest).limit(30000);
        const lastBy = {};
        for (const m of msgs || []) if (m.sender_id && (!lastBy[m.sender_id] || m.created_at > lastBy[m.sender_id])) lastBy[m.sender_id] = m.created_at;
        const seen = new Set();
        for (const r of rows) {
          const key = r.broadcast_id + "|" + r.sender_id;
          if (seen.has(key)) continue; seen.add(key);
          if (r.sent_at && lastBy[r.sender_id] && lastBy[r.sender_id] > r.sent_at) replied[r.broadcast_id] = (replied[r.broadcast_id] || 0) + 1;
        }
      }
    } catch (e) { console.error("[broadcast] replied count:", e?.message || e); }
  }

  return NextResponse.json({
    business_type: client.business_type || "ecommerce",
    plan_active: planActive(client),
    window_hours: WINDOW_HOURS,
    max_message: MAX_MESSAGE,
    available_tags: tagsFor(client.business_type),
    channels: channels.map((c) => ({ platform: c.platform, page_id: c.page_id })),
    quota,
    blocked_reason: quota.blocked ? cannotSendReason(quota.blocked) : null,
    broadcasts: list.map((b) => ({ ...b, replied: replied[b.id] || 0 })),
  }, NO_CACHE);
}, "broadcast");

// Preview only. Says exactly who would receive the message and why anyone else
// would not, before a single message is sent.
export const POST = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Package gate — see FEATURE_DEFS in src/lib/features.js.
  const gate = await featureGate(client, "broadcast");
  if (!gate.ok) return NextResponse.json({ error: gate.message, feature: "broadcast" }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  if (body.action === "send") {
    const { broadcast, error: cErr } = await createBroadcast(client, {
      channel: body.channel, message: body.message, segment: body.segment || {},
    });
    if (cErr) return NextResponse.json({ error: cErr }, { status: 400 });
    const progress = await processBroadcast(client, broadcast.id);
    return NextResponse.json({ ok: true, ...progress }, NO_CACHE);
  }

  if (body.action === "resume") {
    if (!body.id) return NextResponse.json({ error: "Missing broadcast id" }, { status: 400 });
    const progress = await processBroadcast(client, body.id);
    if (progress.error) return NextResponse.json({ error: progress.error }, { status: 404 });
    return NextResponse.json({ ok: true, ...progress }, NO_CACHE);
  }

  if (body.action === "recipients") {
    if (!body.id) return NextResponse.json({ error: "Missing broadcast id" }, { status: 400 });
    const { data } = await supabase.from("broadcast_recipients")
      .select("sender_id, platform, status, error, sent_at")
      .eq("broadcast_id", body.id).eq("client_id", client.id)
      .order("id", { ascending: true }).limit(500);
    return NextResponse.json({ recipients: data || [] }, NO_CACHE);
  }

  if (body.action !== "preview") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const audience = await resolveAudience(
    client.id,
    client.business_type || "ecommerce",
    body.segment || {}
  );
  const quota = await remainingQuota(client);
  // How many broadcasts are left this period, which is a different question
  // from how many messages are left. Sent with the preview so the owner learns
  // it before writing the message, not by having Send refused afterwards.
  const bq = await checkBroadcastQuota(client);

  return NextResponse.json({
    counts: audience.counts,
    quota,
    broadcast_limit: bq.limit ?? null,
    broadcasts_used: bq.used ?? 0,
    broadcasts_blocked: bq.ok ? null : bq.message,
    over_quota: !quota.unlimited && audience.counts.eligible > quota.remaining,
    // A dead plan is a different problem from a full one, and saying "0 left
    // this month" for an expired plan sends the owner looking in the wrong place.
    blocked_reason: quota.blocked ? cannotSendReason(quota.blocked) : null,
    tags_available: audience.tagsAvailable,
    // Enough to show the owner who this is, without shipping the whole list.
    sample: audience.eligible.slice(0, 8).map((r) => ({ name: r.name, platform: r.platform, last_at: r.last_at })),
    skipped_sample: audience.skipped.slice(0, 8).map((r) => ({ name: r.name, platform: r.platform, reason: r.reason })),
  }, NO_CACHE);
}, "broadcast");
