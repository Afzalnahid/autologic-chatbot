export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } };

// Words that carry no business meaning — dropped before counting top queries.
const STOP = new Set([
  // English
  "the","a","an","is","are","am","was","were","be","been","do","does","did","i","you","he","she","it","we","they",
  "my","your","this","that","these","those","of","to","in","on","at","for","with","and","or","but","if","so","not",
  "can","could","will","would","should","have","has","had","me","us","them","from","by","as","what","how","when",
  "where","which","who","why","please","hi","hello","hey","ok","okay","yes","no","thanks","thank","dear","sir",
  // Bangla (common function words)
  "আমি","আমার","আপনি","আপনার","তুমি","তোমার","এই","ওই","সেই","একটা","একটি","কি","কী","কেন","কোথায়","কিভাবে","কীভাবে",
  "আছে","নেই","হবে","হয়","করা","করবে","করেন","জন্য","থেকে","দিয়ে","সাথে","এবং","বা","না","হ্যাঁ","জি","ভাই","আপু",
  "ধন্যবাদ","ভাল","ভালো","একটু","টা","টি","ও","এ","র","এর","কে","য়",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(d) {
  // Local business day in Asia/Dhaka (UTC+6)
  const t = new Date(new Date(d).getTime() + 6 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 7), 90);

  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [msgQ, ordersQ, bookingsQ] = await Promise.all([
    supabase
      .from("message_buffer")
      .select("role,platform,sender_id,message_content,attachments,created_at")
      .eq("client_id", client.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(20000),
    supabase.from("orders").select("created_at,status").eq("client_id", client.id).gte("created_at", since),
    supabase.from("bookings").select("created_at").eq("client_id", client.id).gte("created_at", since),
  ]);

  const msgs = msgQ.data || [];
  const orders = ordersQ.data || [];
  const bookings = bookingsQ.data || [];

  // ---- Build the day buckets so gaps show as zero, not missing ----
  const dayMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(new Date(Date.now() - i * 86400000));
    dayMap.set(key, { date: key, customer: 0, bot: 0, agent: 0, total: 0 });
  }

  const channelMap = new Map();
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const contacts = new Set();
  const contactsByChannel = new Map();
  const wordCount = new Map();

  let customer = 0, bot = 0, agent = 0, imageMsgs = 0, voiceMsgs = 0;
  const todayKey = dateKey(new Date());
  let todayCount = 0;

  for (const m of msgs) {
    const role = m.role || "customer";
    const platform = m.platform || "facebook";
    const key = dateKey(m.created_at);

    const bucket = dayMap.get(key);
    if (bucket) {
      bucket[role] = (bucket[role] || 0) + 1;
      bucket.total += 1;
    }
    if (key === todayKey) todayCount++;

    if (role === "customer") customer++;
    else if (role === "bot") bot++;
    else if (role === "agent") agent++;

    if (!channelMap.has(platform)) channelMap.set(platform, { platform, total: 0, customer: 0, bot: 0 });
    const ch = channelMap.get(platform);
    ch.total++;
    if (role === "customer") ch.customer++;
    if (role === "bot") ch.bot++;

    if (role === "customer") {
      // Peak hours only make sense for inbound customer traffic.
      const local = new Date(new Date(m.created_at).getTime() + 6 * 3600 * 1000);
      hours[local.getUTCHours()].count++;

      if (m.sender_id) {
        contacts.add(m.sender_id);
        if (!contactsByChannel.has(platform)) contactsByChannel.set(platform, new Set());
        contactsByChannel.get(platform).add(m.sender_id);
      }

      const content = String(m.message_content || "");
      const isImage = !!m.attachments || content.includes("--- ITEM");
      const isVoice = /voice message|\[audio/i.test(content);
      if (isImage) imageMsgs++;
      if (isVoice) voiceMsgs++;

      if (!isImage && !isVoice) {
        for (const w of normalize(content).split(" ")) {
          if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
          wordCount.set(w, (wordCount.get(w) || 0) + 1);
        }
      }
    }
  }

  for (const [platform, set] of contactsByChannel) {
    const ch = channelMap.get(platform);
    if (ch) ch.contacts = set.size;
  }

  // Orders & bookings per day (same buckets)
  const convMap = new Map();
  for (const key of dayMap.keys()) convMap.set(key, { date: key, orders: 0, bookings: 0 });
  for (const o of orders) { const b = convMap.get(dateKey(o.created_at)); if (b) b.orders++; }
  for (const bk of bookings) { const b = convMap.get(dateKey(bk.created_at)); if (b) b.bookings++; }

  const daily = [...dayMap.values()];
  const totalMessages = msgs.length;
  const activeDays = daily.filter(d => d.total > 0).length;

  const topQueries = [...wordCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));

  const peak = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0]);

  return NextResponse.json({
    range_days: days,
    generated_at: new Date().toISOString(),
    kpi: {
      total_messages: totalMessages,
      messages_today: todayCount,
      customer_messages: customer,
      bot_messages: bot,
      agent_messages: agent,
      unique_contacts: contacts.size,
      // Share of replies produced by the bot vs a human agent.
      bot_handled_pct: bot + agent > 0 ? Math.round((bot / (bot + agent)) * 100) : null,
      avg_messages_per_active_day: activeDays ? Math.round((totalMessages / activeDays) * 10) / 10 : 0,
      image_messages: imageMsgs,
      voice_messages: voiceMsgs,
      orders: orders.length,
      pending_orders: orders.filter(o => (o.status || "Pending") === "Pending").length,
      bookings: bookings.length,
      peak_hour: peak.count > 0 ? peak.hour : null,
    },
    daily,
    conversions: [...convMap.values()],
    channels: [...channelMap.values()].sort((a, b) => b.total - a.total),
    hours,
    top_queries: topQueries,
  }, NO_CACHE);
}
