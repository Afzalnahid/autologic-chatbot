export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { planActive } from "@/lib/plans.js";
import { limitsFor } from "@/lib/plan-limits.js";
import { countBillableMessages } from "@/lib/message-usage.js";
import { startOfDayDhaka, startOfMonthDhaka } from "@/lib/time.js";
import { withErrors } from "@/lib/route-errors.js";

// The notification feed behind the bell — everything worth the owner's
// attention, assembled in ONE place on the server, scoped to their client_id
// at the database:
//   needs-you : a customer waiting for a person, a comment the bot could not
//               answer, and system alerts (plan, AI key, message limit, a
//               channel that needs reconnecting, a payment decision)
//   customers : recent public comments
//   business  : orders and bookings
// Messages are NOT in here — the shell already holds live conversations (10 s)
// and the bell merges them in. Read/unread state is the bell's (per device).
//
// Every item: { key, type, level, icon, title, body, time, target }. Keys are
// stable for the same fact (an alert keeps its key while it is true), so the
// bell's per-item read state survives polls.
const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } };
const DAYS = (n) => new Date(Date.now() - n * 86400000).toISOString();

const PLATFORM = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", website: "Website" };
const pl = (p) => PLATFORM[p] || p || "";

export const GET = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cid = client.id;
  const isAgency = client.business_type === "agency";
  const trial = client.plan === "trial";

  const soft = async (p) => { try { const r = await p; return r?.error ? null : (r?.data ?? r); } catch { return null; } };

  const [waiting, comments, orders, bookings, ai, channels, payments, limits, used] = await Promise.all([
    soft(supabase.from("contacts").select("sender_id,name,needs_human_at").eq("client_id", cid).eq("needs_human", true)
      .order("needs_human_at", { ascending: false }).limit(50)),
    soft(supabase.from("comments").select("id,platform,commenter_name,comment_text,reply_error,dm_error,permalink,created_at")
      .eq("client_id", cid).gte("created_at", DAYS(3)).order("created_at", { ascending: false }).limit(50)),
    soft(supabase.from("orders").select("id,order_code,customer_name,product_names,total_price,status,created_at")
      .eq("client_id", cid).gte("created_at", DAYS(7)).order("created_at", { ascending: false }).limit(30)),
    isAgency
      ? soft(supabase.from("bookings").select("id,customer_name,service_want,meeting_date,meeting_time,status,created_at")
          .eq("client_id", cid).gte("created_at", DAYS(7)).order("created_at", { ascending: false }).limit(30))
      : Promise.resolve([]),
    soft(supabase.from("client_ai").select("status,api_key_enc,last_error_at").eq("client_id", cid).maybeSingle()),
    soft(supabase.from("channels").select("id,platform,status,name,connected_at").eq("client_id", cid).limit(20)),
    soft(supabase.from("payment_requests").select("id,plan,amount,status,reviewed_at,created_at")
      .eq("client_id", cid).gte("created_at", DAYS(7)).order("created_at", { ascending: false }).limit(5)),
    limitsFor(client),
    soft(countBillableMessages(cid, (trial ? startOfDayDhaka() : startOfMonthDhaka()).toISOString())),
  ]);

  const items = [];
  const push = (it) => items.push(it);

  // ── needs you: people ──────────────────────────────────────────────────────
  for (const w of waiting || []) {
    push({ key: "human-" + w.sender_id, type: "handover", level: "urgent", icon: "ti-hand-stop",
      title: (w.name || "A customer") + " is waiting for you",
      body: "They asked to talk to a person. Reply from the inbox.",
      time: w.needs_human_at || new Date().toISOString(), target: "conversations", id: w.sender_id });
  }
  for (const c of comments || []) {
    const failed = !!(c.reply_error || c.dm_error);
    push({ key: "cmt-" + c.id, type: "comment", level: failed ? "urgent" : "info", icon: "ti-message-circle",
      title: (failed ? "Comment needs a reply · " : "New comment · ") + (c.commenter_name || "someone") + (c.platform ? " on " + pl(c.platform) : ""),
      body: String(c.comment_text || "").replace(/\s+/g, " ").slice(0, 90) || (failed ? "The bot could not reply." : "The bot replied."),
      time: c.created_at, target: "comments", id: c.id });
  }

  // ── needs you: system alerts ───────────────────────────────────────────────
  // Keys AND times are stable while the fact holds (the expiry date, the error
  // moment, the start of the metering window) — never "now" — so a poll does not
  // make an alert look new again after the owner has read it. The bell decides
  // "new" by when it FIRST saw a key, so a fresh alert is still unread.
  const now = Date.now();
  const periodStart = (trial ? startOfDayDhaka() : startOfMonthDhaka()).toISOString();
  if (!planActive(client)) {
    const plan = String(client.plan || "").toLowerCase();
    const why = client.suspended ? "This account is suspended." : plan === "trial" ? "Your free trial has ended."
      : (!plan || plan === "none") ? "You have no active plan." : "Your plan has expired.";
    const at = client.plan_expires_at || client.trial_end || client.created_at || periodStart;
    push({ key: "alert-plan-off-" + at, type: "alert", level: "urgent", icon: "ti-alert-triangle",
      title: "Your bot is not answering customers", body: why + " Choose a plan to switch it back on.",
      time: at, target: "billing" });
  } else {
    const end = trial ? client.trial_end : client.plan_expires_at;
    if (end) {
      const daysLeft = Math.ceil((new Date(end).getTime() - now) / 86400000);
      if (daysLeft <= 3) push({ key: "alert-expiring-" + end, type: "alert", level: "urgent", icon: "ti-hourglass",
        title: (trial ? "Your trial ends " : "Your plan ends ") + (daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`),
        body: "Renew now so the bot keeps answering without a gap.",
        time: new Date(new Date(end).getTime() - 3 * 86400000).toISOString(), target: "billing" });
    }
  }
  if (ai?.api_key_enc && ai.status === "failing") {
    push({ key: "alert-key-" + (ai.last_error_at || "x"), type: "alert", level: "urgent", icon: "ti-key-off",
      title: "Your AI key stopped working", body: "The bot is paused until it is fixed — check AI Engine.",
      time: ai.last_error_at || periodStart, target: "ai" });
  }
  const limit = trial ? limits.messagesPerDay : limits.messagesPerMonth;
  if (limit && used !== null && used !== undefined) {
    const pct = Math.round((Number(used) / Number(limit)) * 100);
    if (pct >= 100) push({ key: "alert-limit-hit-" + periodStart, type: "alert", level: "urgent", icon: "ti-gauge",
      title: "Message limit reached", body: `${Number(used).toLocaleString("en-IN")} of ${Number(limit).toLocaleString("en-IN")} used — the bot has stopped until ${trial ? "tomorrow" : "next month"} or an upgrade.`,
      time: periodStart, target: "billing" });
    else if (pct >= 90) push({ key: "alert-limit-near-" + periodStart, type: "alert", level: "info", icon: "ti-gauge",
      title: "Close to your message limit", body: `${pct}% used (${Number(used).toLocaleString("en-IN")} of ${Number(limit).toLocaleString("en-IN")}). Upgrade to keep the bot replying.`,
      time: periodStart, target: "billing" });
  }
  for (const ch of channels || []) {
    if (ch.status !== "expired") continue;
    push({ key: "alert-channel-" + ch.id, type: "alert", level: "urgent", icon: "ti-plug-x",
      title: pl(ch.platform) + " needs reconnecting", body: (ch.name || "This channel") + " lost its connection — press Reconnect in Channels.",
      time: ch.connected_at || periodStart, target: "channels" });
  }
  for (const p of payments || []) {
    if (p.status === "approved") push({ key: "pay-ok-" + p.id, type: "alert", level: "info", icon: "ti-circle-check",
      title: "Payment confirmed", body: `৳${Number(p.amount || 0).toLocaleString("en-IN")} verified — your ${p.plan || "plan"} is active.`,
      time: p.reviewed_at || p.created_at, target: "billing" });
    else if (p.status === "rejected") push({ key: "pay-no-" + p.id, type: "alert", level: "urgent", icon: "ti-circle-x",
      title: "Payment could not be verified", body: "See the note in Billing and submit again.",
      time: p.reviewed_at || p.created_at, target: "billing" });
  }

  // ── business ───────────────────────────────────────────────────────────────
  for (const o of orders || []) {
    const total = o.total_price;
    push({ key: "ord-" + (o.id || o.order_code), type: "order", level: "info", icon: "ti-shopping-cart",
      title: "New order · " + (o.customer_name || "customer"),
      body: [o.product_names, total ? "৳" + total : ""].filter(Boolean).join(" · "),
      time: o.created_at, target: "orders", id: o.id || o.order_code });
  }
  for (const b of bookings || []) {
    push({ key: "bk-" + b.id, type: "booking", level: "info", icon: "ti-calendar-event",
      title: (b.status === "Cancelled" ? "Booking cancelled · " : "New booking · ") + (b.customer_name || "customer"),
      body: [b.service_want, [b.meeting_date, b.meeting_time].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
      time: b.created_at, target: "orders", id: b.id });
  }

  items.sort((a, b) => new Date(b.time) - new Date(a.time));
  return NextResponse.json({ items: items.slice(0, 60), at: new Date(now).toISOString() }, NO_CACHE);
}, "notifications");
