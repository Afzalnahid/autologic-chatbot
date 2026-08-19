import { supabase } from "@/lib/supabase.js";
import { planActive } from "@/lib/plans.js";
import { sendBroadcastText, waSendText } from "@/lib/messenger.js";
import { bufferInsert } from "@/lib/bot.js";
import { sendableChannels, remainingQuota, WINDOW_HOURS } from "@/lib/broadcast.js";

// Meta's window closes exactly 24 hours after the customer's last message, so a
// follow-up must land before that. 20 hours leaves room for the run to be late.
export const MAX_DELAY_HOURS = 23;
const SAFE_WINDOW_HOURS = WINDOW_HOURS - 0.5;

// One follow-up per customer per month at most.
const REPEAT_DAYS = 30;
const PER_RUN = 20;
const THROTTLE_MIN = 15;

export const DEFAULT_FOLLOWUP = {
  enabled: false,
  delay_hours: 20,
  message_ecommerce:
    "আসসালামু আলাইকুম! আপনি আমাদের পণ্য নিয়ে জানতে চেয়েছিলেন। কোনো প্রশ্ন থাকলে জানাবেন — সাহায্য করতে পারলে খুশি হব। 🙂",
  message_agency:
    "আসসালামু আলাইকুম! আপনি আমাদের সার্ভিস নিয়ে জানতে চেয়েছিলেন। কোনো প্রশ্ন থাকলে জানাবেন — সাহায্য করতে পারলে খুশি হব। 🙂",
};

// Which conversations count as "showed interest". Tags come from Task 7.
const INTENT_TAGS = {
  ecommerce: ["Product Inquiry", "Order"],
  agency: ["Service Inquiry", "Booking"],
};

export function followupConfig(settings) {
  const raw = settings?.followup || {};
  const delay = Number(raw.delay_hours);
  return {
    ...DEFAULT_FOLLOWUP,
    ...raw,
    delay_hours: Math.min(Math.max(Number.isFinite(delay) ? delay : 20, 1), MAX_DELAY_HOURS),
  };
}

export function followupMessage(cfg, businessType) {
  const t = businessType === "agency" ? cfg.message_agency : cfg.message_ecommerce;
  return String(t || "").trim() ||
    (businessType === "agency" ? DEFAULT_FOLLOWUP.message_agency : DEFAULT_FOLLOWUP.message_ecommerce);
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

/**
 * Finds contacts who showed interest, never converted, and have been quiet long
 * enough — while still inside Meta's window. Sends at most one message each.
 * Safe to call often: it throttles itself and does nothing when disabled.
 */
export async function runFollowups(client, settings) {
  const cfg = followupConfig(settings);
  if (!cfg.enabled) return { skipped: "disabled" };
  if (!planActive(client)) return { skipped: "plan_inactive" };

  const lastRun = settings?.followup?.last_run_at;
  if (lastRun && Date.now() - new Date(lastRun).getTime() < THROTTLE_MIN * 60 * 1000) {
    return { skipped: "throttled" };
  }
  // Claim the run before doing any work, so two dashboard loads cannot both send.
  await saveLastRun(client.id, settings);

  const bType = client.business_type === "agency" ? "agency" : "ecommerce";
  const quota = await remainingQuota(client);
  if (!quota.unlimited && quota.remaining <= 0) return { skipped: "no_quota" };

  const channels = await sendableChannels(client.id);
  if (!channels.length) return { skipped: "no_channel" };
  // Same page/account/number the customer wrote to; platform map is the
  // fallback for rows from before page_id existed.
  const byPage = new Map(channels.map((c) => [`${c.platform}:${c.page_id}`, c]));
  const byPlatform = new Map(channels.map((c) => [c.platform, c]));

  // The window is anchored on the customer's own last message.
  const { data: inbound } = await supabase
    .from("message_buffer")
    .select("sender_id, platform, page_id, created_at")
    .eq("client_id", client.id).eq("role", "customer")
    .gte("created_at", hoursAgo(SAFE_WINDOW_HOURS))
    .lte("created_at", hoursAgo(cfg.delay_hours))
    .order("created_at", { ascending: false })
    .limit(500);

  const candidates = new Map();
  for (const r of inbound || []) {
    if (!r.sender_id || candidates.has(r.sender_id)) continue;
    if (!byPlatform.has(r.platform)) continue;
    candidates.set(r.sender_id, r);
  }
  if (!candidates.size) return { sent: 0, considered: 0 };

  const ids = [...candidates.keys()];

  // Anyone who spoke again after the anchor is not quiet, so they are not due.
  const { data: newer } = await supabase
    .from("message_buffer").select("sender_id, created_at")
    .eq("client_id", client.id).eq("role", "customer")
    .in("sender_id", ids).gt("created_at", hoursAgo(cfg.delay_hours));
  for (const r of newer || []) candidates.delete(r.sender_id);

  const [tagsQ, doneQ, contactsQ, convQ] = await Promise.all([
    supabase.from("conversation_tags").select("sender_id, tag").eq("client_id", client.id).in("sender_id", ids),
    supabase.from("followups").select("sender_id, sent_at").eq("client_id", client.id).in("sender_id", ids)
      .gte("sent_at", hoursAgo(REPEAT_DAYS * 24)),
    supabase.from("contacts").select("sender_id, bot_enabled, broadcast_opt_out").eq("client_id", client.id).in("sender_id", ids),
    supabase.from(bType === "agency" ? "bookings" : "orders").select("sender_id").eq("client_id", client.id).in("sender_id", ids),
  ]);

  const wanted = new Set(INTENT_TAGS[bType]);
  const interested = new Set((tagsQ.data || []).filter((r) => wanted.has(r.tag)).map((r) => r.sender_id));
  const already = new Set((doneQ.data || []).map((r) => r.sender_id));
  const converted = new Set((convQ.data || []).map((r) => r.sender_id).filter(Boolean));
  const contact = new Map((contactsQ.data || []).map((c) => [c.sender_id, c]));

  const due = [];
  for (const [senderId, row] of candidates) {
    if (already.has(senderId)) continue;
    if (converted.has(senderId)) continue;
    // No tag means no evidence of interest — silence is the safer default.
    if (!interested.has(senderId)) continue;
    const c = contact.get(senderId);
    if (c?.broadcast_opt_out) continue;
    if (c?.bot_enabled === false) continue;
    due.push(row);
    if (due.length >= PER_RUN) break;
  }

  let sent = 0;
  const text = followupMessage(cfg, bType);

  for (const row of due) {
    if (!quota.unlimited && sent >= quota.remaining) break;
    const ch = (row.page_id && byPage.get(`${row.platform}:${row.page_id}`)) || byPlatform.get(row.platform);
    if (!ch) continue;

    let res;
    try {
      res = row.platform === "whatsapp"
        ? await waSendText(ch.access_token, ch.page_id, row.sender_id, text)
        : await sendBroadcastText(ch.access_token, row.sender_id, text, row.platform, ch.page_id);
    } catch (e) {
      res = { error: { message: e.message } };
    }

    const err = res?.error
      ? (typeof res.error === "string" ? res.error : res.error.message || "send failed")
      : null;

    await supabase.from("followups").insert({
      client_id: client.id, sender_id: row.sender_id, platform: row.platform,
      status: err ? "failed" : "sent", error: err ? String(err).slice(0, 400) : null,
    });

    if (!err) {
      sent++;
      try {
        await bufferInsert({
          sender_id: row.sender_id, client_id: client.id, role: "bot", status: "Replied",
          message_content: text, platform: row.platform,
        });
      } catch (e) {
        console.error("[followup] inbox copy:", e.message);
      }
    } else {
      console.error("[followup] send failed:", err);
    }
  }

  console.log("[followup] due:", due.length, "sent:", sent, { clientId: client.id });
  return { sent, considered: due.length };
}

async function saveLastRun(clientId, settings) {
  const next = { ...(settings || {}), followup: { ...(settings?.followup || {}), last_run_at: new Date().toISOString() } };
  const { error } = await supabase.from("app_settings")
    .upsert({ id: clientId, settings: next, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("[followup] throttle stamp:", error.message);
}
