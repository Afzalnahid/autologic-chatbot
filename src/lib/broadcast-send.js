import { supabase } from "@/lib/supabase.js";
import { sendBroadcastText, waSendText } from "@/lib/messenger.js";
import { bufferInsert } from "@/lib/bot.js";
import { planActive } from "@/lib/plans.js";
import { resolveAudience, sendableChannels, remainingQuota, BROADCAST_CHANNELS } from "@/lib/broadcast.js";

// How many people one request sends to. Kept small so a serverless invocation
// always finishes well inside its time limit; the dashboard calls back for the
// next batch until the broadcast is done. No cron needed.
export const BATCH = 20;
const GAP_MS = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const MAX_MESSAGE = 900;

export async function createBroadcast(client, { channel, message, segment }) {
  if (!planActive(client)) {
    return { error: "Your plan is not active, so messages cannot be sent." };
  }
  const text = String(message || "").trim();
  if (text.length < 2) return { error: "Write the message you want to send." };
  if (text.length > MAX_MESSAGE) return { error: `Keep the message under ${MAX_MESSAGE} characters.` };

  const ch = channel && channel !== "all" ? channel : "all";
  if (ch !== "all" && !BROADCAST_CHANNELS.includes(ch)) {
    return { error: "That channel cannot be used for broadcasts." };
  }

  // One broadcast at a time keeps sending predictable and the quota honest.
  const { data: running } = await supabase
    .from("broadcasts").select("id").eq("client_id", client.id).eq("status", "sending").limit(1);
  if (running?.length) {
    return { error: "A broadcast is already being sent. Wait for it to finish." };
  }

  const seg = { ...(segment || {}), channel: ch };
  const audience = await resolveAudience(client.id, client.business_type || "ecommerce", seg);
  if (!audience.eligible.length) {
    return { error: "Nobody in this segment can be messaged right now. Check the preview for the reason." };
  }

  const quota = await remainingQuota(client);
  if (!quota.unlimited && audience.eligible.length > quota.remaining) {
    return {
      error: `This would need ${audience.eligible.length} messages but only ${quota.remaining} are left in your plan this ${quota.period}.`,
    };
  }

  const { data: bc, error: insErr } = await supabase.from("broadcasts").insert({
    client_id: client.id,
    channel: ch,
    message: text,
    segment: seg,
    status: "sending",
    total: audience.eligible.length,
    started_at: new Date().toISOString(),
  }).select().single();

  if (insErr) {
    console.error("[broadcast] create:", insErr.message);
    return { error: "Could not start the broadcast. Please try again." };
  }

  const rows = audience.eligible.map((r) => ({
    broadcast_id: bc.id,
    client_id: client.id,
    sender_id: r.sender_id,
    platform: r.platform,
    status: "pending",
  }));

  // The unique (broadcast_id, sender_id) index means a duplicate can never be
  // created, so nobody receives the same broadcast twice.
  for (let i = 0; i < rows.length; i += 200) {
    const { error: rErr } = await supabase.from("broadcast_recipients").insert(rows.slice(i, i + 200));
    if (rErr) console.error("[broadcast] recipients:", rErr.message);
  }

  return { broadcast: bc };
}

// Sends the next batch. Safe to call repeatedly; each recipient is claimed before
// sending, so two overlapping calls cannot double-send.
export async function processBroadcast(client, broadcastId, limit = BATCH) {
  const { data: bc } = await supabase
    .from("broadcasts").select("*")
    .eq("id", broadcastId).eq("client_id", client.id).maybeSingle();
  if (!bc) return { error: "Broadcast not found." };
  if (bc.status !== "sending") return { done: true, broadcast: bc };

  // If an earlier request died mid-send, its claimed rows would block the
  // broadcast forever. Anything claimed more than five minutes ago is retried.
  await supabase.from("broadcast_recipients")
    .update({ status: "pending" })
    .eq("broadcast_id", bc.id).eq("status", "sending")
    .lt("claimed_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const { data: pending } = await supabase
    .from("broadcast_recipients").select("*")
    .eq("broadcast_id", bc.id).eq("client_id", client.id).eq("status", "pending")
    .order("id", { ascending: true }).limit(limit);

  const channels = await sendableChannels(client.id);
  const byPlatform = new Map(channels.map((c) => [c.platform, c]));

  for (const r of pending || []) {
    // Claim first: only the caller that flips pending → sending may send.
    const { data: claimed } = await supabase
      .from("broadcast_recipients")
      .update({ status: "sending", claimed_at: new Date().toISOString() })
      .eq("id", r.id).eq("status", "pending")
      .select();
    if (!claimed?.length) continue;

    const ch = byPlatform.get(r.platform);
    if (!ch) {
      await supabase.from("broadcast_recipients")
        .update({ status: "skipped", error: "That channel is paused or disconnected." })
        .eq("id", r.id);
      continue;
    }

    let res;
    try {
      res = r.platform === "whatsapp"
        ? await waSendText(ch.access_token, ch.page_id, r.sender_id, bc.message)
        : await sendBroadcastText(ch.access_token, r.sender_id, bc.message, r.platform, ch.page_id);
    } catch (e) {
      res = { error: { message: e.message } };
    }

    // The platform's own words, not a generic failure. The owner needs to see
    // "outside the allowed window" or "user unavailable" to act on it.
    const err = res?.error
      ? (typeof res.error === "string" ? res.error : res.error.message || JSON.stringify(res.error))
      : null;

    if (err) {
      await supabase.from("broadcast_recipients")
        .update({ status: "failed", error: String(err).slice(0, 500) })
        .eq("id", r.id);
    } else {
      await supabase.from("broadcast_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", r.id);
      // Show it in the conversation too, so the inbox tells the whole story.
      try {
        await bufferInsert({
          sender_id: r.sender_id, client_id: client.id, role: "bot", status: "Replied",
          message_content: bc.message, platform: r.platform,
        });
      } catch (e) {
        console.error("[broadcast] inbox copy:", e.message);
      }
    }

    await sleep(GAP_MS);
  }

  const counts = {};
  for (const st of ["pending", "sending", "sent", "failed", "skipped"]) {
    const { count } = await supabase.from("broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", bc.id).eq("status", st);
    counts[st] = count || 0;
  }

  const remaining = counts.pending + counts.sending;
  const patch = {
    sent: counts.sent,
    failed: counts.failed,
    skipped: counts.skipped,
  };
  if (remaining === 0) {
    patch.status = counts.sent === 0 ? "failed" : "sent";
    patch.finished_at = new Date().toISOString();
  }
  const { data: updated } = await supabase.from("broadcasts")
    .update(patch).eq("id", bc.id).eq("client_id", client.id).select().single();

  return { done: remaining === 0, remaining, broadcast: updated || { ...bc, ...patch } };
}
