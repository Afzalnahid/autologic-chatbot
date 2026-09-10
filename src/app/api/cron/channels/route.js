export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { notify } from "@/lib/push.js";
import { notifyChannelExpired } from "@/lib/email.js";

// Once a day: find Facebook Pages whose stored token no longer works and mark
// them "expired", telling the owner on the phone and by email — ONCE, on the
// flip. Until this existed nothing ever wrote such a status: a token Facebook
// had revoked left the channel showing "connected" while every message to it
// went unanswered, and the owner learnt it from a customer.
//
// Deliberately narrow, because a wrong verdict here would be worse than none:
//   • Facebook page tokens only — Instagram and WhatsApp tokens are checked
//     against different hosts and are left alone until each is verified.
//   • Only Graph's own "invalid/expired token" answer (error code 190) counts.
//     A network error, a rate limit or any other code changes nothing.
// Reconnecting through the normal Connect flow writes a fresh token and status
// "connected" (the channel row is upserted on client + platform + page_id).
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.warn("[cron/channels] CRON_SECRET is not set — this endpoint is open."); return true; }
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

async function tokenIsRevoked(token) {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    return !!(body && body.error && Number(body.error.code) === 190);
  } catch { return false; } // unreachable Graph is not a dead token
}

export async function GET(request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: rows, error } = await supabase.from("channels")
    .select("id,client_id,platform,page_id,name,access_token,status")
    .eq("platform", "facebook").eq("status", "connected").not("access_token", "is", null).limit(500);
  if (error) return NextResponse.json({ error: "lookup failed" }, { status: 500 });

  let checked = 0, expired = 0;
  const failed = [];
  for (const ch of rows || []) {
    checked++;
    try {
      if (!(await tokenIsRevoked(ch.access_token))) continue;
      // Atomic flip: only a row still "connected" is marked, so two overlapping
      // runs cannot both notify.
      const { data: flipped } = await supabase.from("channels").update({ status: "expired" })
        .eq("id", ch.id).eq("status", "connected").select("id").maybeSingle();
      if (!flipped) continue;
      expired++;
      notify(ch.client_id, {
        title: "⚠️ Facebook needs reconnecting",
        body: (ch.name || "Your Page") + " lost its connection — the bot cannot answer there until you reconnect.",
        url: "/dashboard#channels", tag: "channel-" + ch.id,
      }).catch(() => {});
      const { data: c } = await supabase.from("clients").select("owner_email,business_name").eq("id", ch.client_id).maybeSingle();
      if (c?.owner_email) notifyChannelExpired(c.owner_email, { business: c.business_name, platform: "facebook", name: ch.name }).catch(() => {});
    } catch (e) {
      failed.push({ id: ch.id, error: String(e?.message || e).slice(0, 160) });
    }
  }
  console.log(`[cron/channels] checked ${checked}, expired ${expired}, failed ${failed.length}`);
  return NextResponse.json({ ok: true, checked, expired, failed }, { headers: { "Cache-Control": "no-store" } });
}
