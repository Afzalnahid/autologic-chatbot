import { supabase } from "@/lib/supabase.js";
import { PLANS } from "@/lib/plans.js";
import { startOfDayDhaka, startOfMonthDhaka } from "@/lib/time.js";

// A website visitor has no address to send to once the tab is closed, so the
// website channel cannot be broadcast to at all.
export const BROADCAST_CHANNELS = ["facebook", "instagram", "whatsapp"];

// Meta's standard messaging window. Outside it, only non-promotional tagged
// messages are permitted, and misuse risks the Page. This build never sends
// outside the window — see docs/architecture.md.
export const WINDOW_HOURS = 24;

export const SKIP = {
  window: "Outside Meta's 24-hour window — this person has not messaged recently",
  paused: "Bot paused for this contact",
  optOut: "This contact opted out of broadcasts",
  channelOff: "That channel is paused or not connected",
};

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

// The channels a broadcast may actually use right now.
export async function sendableChannels(clientId) {
  const { data } = await supabase
    .from("channels").select("*")
    .eq("client_id", clientId).eq("status", "connected");
  return (data || []).filter(
    (c) => BROADCAST_CHANNELS.includes(c.platform) && c.bot_enabled !== false
  );
}

// Last inbound message per person, which is what opens the window.
async function lastInboundBySender(clientId, lookbackHours) {
  const { data } = await supabase
    .from("message_buffer")
    .select("sender_id, platform, page_id, created_at")
    .eq("client_id", clientId).eq("role", "customer")
    .gte("created_at", hoursAgo(Math.max(lookbackHours, WINDOW_HOURS)))
    .order("created_at", { ascending: false })
    .limit(5000);

  const map = new Map();
  for (const r of data || []) {
    if (!r.sender_id) continue;
    if (!map.has(r.sender_id)) {
      // page_id says WHICH page/account/number they wrote to, so the send
      // goes back out through the same one (null on old rows → platform match).
      map.set(r.sender_id, { sender_id: r.sender_id, platform: r.platform, page_id: r.page_id || null, last_at: r.created_at });
    }
  }
  return map;
}

async function taggedSenders(clientId, tags) {
  const { data } = await supabase
    .from("conversation_tags").select("sender_id")
    .eq("client_id", clientId).in("tag", tags);
  return new Set((data || []).map((r) => r.sender_id));
}

async function converted(clientId, businessType) {
  const table = businessType === "agency" ? "bookings" : "orders";
  const { data } = await supabase
    .from(table).select("sender_id").eq("client_id", clientId).not("sender_id", "is", null);
  return new Set((data || []).map((r) => r.sender_id));
}

/**
 * Works out exactly who would receive a broadcast, and why everyone else would not.
 * Nothing is sent here.
 *
 * segment = {
 *   channel: "all" | "facebook" | "instagram" | "whatsapp",
 *   activeWithinHours: number,          // narrows the audience, never widens it
 *   converted: "any" | "yes" | "no",    // ecommerce: ordered · agency: booked
 *   tags: string[]                      // Task 7; ignored until tags exist
 * }
 */
export async function resolveAudience(clientId, businessType, segment = {}) {
  const channel = segment.channel && segment.channel !== "all" ? segment.channel : null;
  const activeWithin = Math.min(Math.max(Number(segment.activeWithinHours) || WINDOW_HOURS, 1), 720);
  const convertedFilter = ["yes", "no"].includes(segment.converted) ? segment.converted : "any";

  const tags = Array.isArray(segment.tags) ? segment.tags.filter(Boolean) : [];
  const tagged = tags.length ? await taggedSenders(clientId, tags) : null;

  const channels = await sendableChannels(clientId);
  const live = new Set(channels.map((c) => c.platform));

  const [inbound, contactsQ, convertedSet] = await Promise.all([
    lastInboundBySender(clientId, activeWithin),
    supabase.from("contacts").select("sender_id, name, bot_enabled, broadcast_opt_out").eq("client_id", clientId),
    convertedFilter === "any" ? Promise.resolve(new Set()) : converted(clientId, businessType),
  ]);

  const contactById = new Map((contactsQ.data || []).map((c) => [c.sender_id, c]));
  const cutoff = Date.now() - activeWithin * 3600 * 1000;
  const windowCutoff = Date.now() - WINDOW_HOURS * 3600 * 1000;

  const eligible = [];
  const skipped = [];

  for (const person of inbound.values()) {
    if (channel && person.platform !== channel) continue;
    if (!BROADCAST_CHANNELS.includes(person.platform)) continue;

    const lastAt = new Date(person.last_at).getTime();
    if (lastAt < cutoff) continue; // outside the segment the owner asked for

    const ct = contactById.get(person.sender_id) || null;
    const row = {
      sender_id: person.sender_id,
      platform: person.platform,
      page_id: person.page_id || null,
      name: ct?.name || "User " + String(person.sender_id).slice(-4),
      last_at: person.last_at,
    };

    if (tagged && !tagged.has(person.sender_id)) continue;
    if (convertedFilter === "yes" && !convertedSet.has(person.sender_id)) continue;
    if (convertedFilter === "no" && convertedSet.has(person.sender_id)) continue;

    if (!live.has(person.platform)) { skipped.push({ ...row, reason: SKIP.channelOff }); continue; }
    if (ct?.broadcast_opt_out) { skipped.push({ ...row, reason: SKIP.optOut }); continue; }
    if (ct?.bot_enabled === false) { skipped.push({ ...row, reason: SKIP.paused }); continue; }
    if (lastAt < windowCutoff) { skipped.push({ ...row, reason: SKIP.window }); continue; }

    eligible.push(row);
  }

  eligible.sort((a, b) => new Date(b.last_at) - new Date(a.last_at));

  return {
    eligible,
    skipped,
    counts: { eligible: eligible.length, skipped: skipped.length },
    tagsAvailable: true,
  };
}

// Broadcasts are messages too, so they draw on the same monthly allowance the
// bot does. Counted the same way `botAllowed` counts, plus what broadcasts have
// already sent in the period.
export async function remainingQuota(client) {
  const plan = PLANS[client?.plan];
  if (!plan) return { limit: 0, used: 0, remaining: 0, unlimited: false };

  const daily = plan.messagesPerDay ?? null;
  const monthly = plan.messagesPerMonth ?? null;
  if (!daily && !monthly) return { limit: null, used: 0, remaining: Infinity, unlimited: true };

  // Reset at Dhaka midnight, not the server's UTC midnight (which is 6am in
  // Bangladesh) — otherwise a tenant's quota window is six hours off from the
  // day they actually experience.
  const start = daily ? startOfDayDhaka() : startOfMonthDhaka();
  const since = start.toISOString();

  const [msgQ, bcQ] = await Promise.all([
    supabase.from("message_buffer").select("id", { count: "exact", head: true })
      .eq("client_id", client.id).eq("role", "customer").gte("created_at", since),
    supabase.from("broadcast_recipients").select("id", { count: "exact", head: true })
      .eq("client_id", client.id).eq("status", "sent").gte("sent_at", since),
  ]);

  const limit = daily || monthly;
  const used = (msgQ.count || 0) + (bcQ.count || 0);
  return { limit, used, remaining: Math.max(0, limit - used), unlimited: false, period: daily ? "day" : "month" };
}
