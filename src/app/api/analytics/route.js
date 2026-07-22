export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } };
const DHAKA_OFFSET = 6 * 3600 * 1000;
// A new conversation starts after this much silence from the same person.
const SESSION_GAP_MS = 6 * 3600 * 1000;

const STOP = new Set([
  "the","a","an","is","are","am","was","were","be","been","do","does","did","i","you","he","she","it","we","they",
  "my","your","this","that","these","those","of","to","in","on","at","for","with","and","or","but","if","so","not",
  "can","could","will","would","should","have","has","had","me","us","them","from","by","as","what","how","when",
  "where","which","who","why","please","hi","hello","hey","ok","okay","yes","no","thanks","thank","dear","sir","want",
  "আমি","আমার","আপনি","আপনার","তুমি","তোমার","এই","ওই","সেই","একটা","একটি","কি","কী","কেন","কোথায়","কিভাবে","কীভাবে",
  "আছে","নেই","হবে","হয়","করা","করবে","করেন","জন্য","থেকে","দিয়ে","সাথে","এবং","বা","না","হ্যাঁ","জি","ভাই","আপু",
  "ধন্যবাদ","ভাল","ভালো","একটু","টা","টি","ও","এ","র","এর","কে","য়",
]);

const normalize = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const dateKey = (d) => new Date(new Date(d).getTime() + DHAKA_OFFSET).toISOString().slice(0, 10);

// Percentage change between two periods. null when there is no baseline to compare against.
function pctChange(cur, prev) {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// Order totals are stored as free text (e.g. "Shirt (2 pc) = 900 TK + Delivery = 80 TK | Total = 980 TK").
function parsePrice(s) {
  if (!s) return 0;
  const str = String(s);
  const m = str.match(/total\s*[=:]\s*([\d,]+(?:\.\d+)?)/i);
  if (m) return parseFloat(m[1].replace(/,/g, "")) || 0;
  const nums = str.match(/[\d,]+(?:\.\d+)?/g);
  if (!nums) return 0;
  return Math.max(...nums.map((n) => parseFloat(n.replace(/,/g, "")) || 0));
}

// Split one person's messages into conversations separated by long silences.
function buildConversations(msgs) {
  const bySender = new Map();
  for (const m of msgs) {
    const id = m.sender_id || "unknown";
    if (!bySender.has(id)) bySender.set(id, []);
    bySender.get(id).push(m);
  }
  const convos = [];
  for (const [senderId, list] of bySender) {
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let cur = null;
    for (const m of list) {
      const t = new Date(m.created_at).getTime();
      if (!cur || t - cur.lastAt > SESSION_GAP_MS) {
        cur = { senderId, platform: m.platform || "facebook", startAt: t, lastAt: t, messages: 0, customer: 0, bot: 0, agent: 0 };
        convos.push(cur);
      }
      cur.lastAt = t;
      cur.messages++;
      const role = m.role || "customer";
      if (role === "customer") cur.customer++;
      else if (role === "bot") cur.bot++;
      else if (role === "agent") cur.agent++;
    }
  }
  return convos;
}

function summarizeConversations(convos) {
  const total = convos.length;
  const handoff = convos.filter((c) => c.agent > 0).length;
  const botResolved = convos.filter((c) => c.bot > 0 && c.agent === 0).length;
  const answered = convos.filter((c) => c.bot > 0 || c.agent > 0).length;
  const msgs = convos.reduce((a, c) => a + c.messages, 0);
  return {
    total,
    handoff,
    bot_resolved: botResolved,
    unanswered: total - answered,
    avg_messages: total ? Math.round((msgs / total) * 10) / 10 : 0,
    bot_resolved_pct: answered ? Math.round((botResolved / answered) * 100) : null,
    handoff_pct: total ? Math.round((handoff / total) * 100) : 0,
  };
}

function topOf(map, limit) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
}

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 7), 90);
  const isAgency = (client.business_type || "ecommerce") === "agency";

  const now = Date.now();
  const sinceMs = now - days * 86400000;
  const since = new Date(sinceMs).toISOString();
  const prevSince = new Date(now - days * 2 * 86400000).toISOString();

  const [msgQ, ordersQ, bookingsQ, priorQ] = await Promise.all([
    // Two periods in one query — split in JS so we can show growth.
    supabase.from("message_buffer")
      .select("role,platform,sender_id,message_content,attachments,created_at")
      .eq("client_id", client.id).gte("created_at", prevSince)
      .order("created_at", { ascending: true }).limit(30000),
    supabase.from("orders").select("created_at,status,total_price,product_names")
      .eq("client_id", client.id).gte("created_at", prevSince).limit(5000),
    supabase.from("bookings").select("created_at,status,service_want,sender_id")
      .eq("client_id", client.id).gte("created_at", prevSince).limit(5000),
    // Everyone who wrote before this window — used to tell new from returning customers.
    supabase.from("message_buffer").select("sender_id")
      .eq("client_id", client.id).eq("role", "customer").lt("created_at", since).limit(30000),
  ]);

  const allMsgs = msgQ.data || [];
  const curMsgs = allMsgs.filter((m) => new Date(m.created_at).getTime() >= sinceMs);
  const prevMsgs = allMsgs.filter((m) => new Date(m.created_at).getTime() < sinceMs);

  const allOrders = ordersQ.data || [];
  const orders = allOrders.filter((o) => new Date(o.created_at).getTime() >= sinceMs);
  const prevOrders = allOrders.filter((o) => new Date(o.created_at).getTime() < sinceMs);

  const allBookings = bookingsQ.data || [];
  const bookings = allBookings.filter((b) => new Date(b.created_at).getTime() >= sinceMs);
  const prevBookings = allBookings.filter((b) => new Date(b.created_at).getTime() < sinceMs);

  const knownSenders = new Set((priorQ.data || []).map((r) => r.sender_id).filter(Boolean));

  // ---------- Daily buckets ----------
  const dayMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(new Date(now - i * 86400000));
    dayMap.set(key, { date: key, customer: 0, bot: 0, agent: 0, total: 0 });
  }

  const channelMap = new Map();
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const contacts = new Set();
  const newContacts = new Set();
  const contactsByChannel = new Map();
  const wordCount = new Map();

  let customer = 0, bot = 0, agent = 0, imageMsgs = 0, voiceMsgs = 0;
  const todayKey = dateKey(new Date());
  let todayCount = 0;

  for (const m of curMsgs) {
    const role = m.role || "customer";
    const platform = m.platform || "facebook";
    const key = dateKey(m.created_at);

    const bucket = dayMap.get(key);
    if (bucket) { bucket[role] = (bucket[role] || 0) + 1; bucket.total += 1; }
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
      const local = new Date(new Date(m.created_at).getTime() + DHAKA_OFFSET);
      hours[local.getUTCHours()].count++;

      if (m.sender_id) {
        contacts.add(m.sender_id);
        if (!knownSenders.has(m.sender_id)) newContacts.add(m.sender_id);
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

  const prevContacts = new Set(prevMsgs.filter((m) => (m.role || "customer") === "customer" && m.sender_id).map((m) => m.sender_id));
  const prevBot = prevMsgs.filter((m) => m.role === "bot").length;
  const prevAgent = prevMsgs.filter((m) => m.role === "agent").length;

  // ---------- Conversations ----------
  const convStats = summarizeConversations(buildConversations(curMsgs));
  const prevConvStats = summarizeConversations(buildConversations(prevMsgs));

  // ---------- Conversions per day ----------
  const convMap = new Map();
  for (const key of dayMap.keys()) convMap.set(key, { date: key, orders: 0, bookings: 0, revenue: 0 });
  for (const o of orders) {
    const b = convMap.get(dateKey(o.created_at));
    if (b) { b.orders++; b.revenue += parsePrice(o.total_price); }
  }
  for (const bk of bookings) { const b = convMap.get(dateKey(bk.created_at)); if (b) b.bookings++; }

  // ---------- Business-specific ----------
  const revenue = orders.reduce((a, o) => a + parsePrice(o.total_price), 0);
  const prevRevenue = prevOrders.reduce((a, o) => a + parsePrice(o.total_price), 0);

  const productCount = new Map();
  for (const o of orders) {
    for (const raw of String(o.product_names || "").split(",")) {
      const name = raw.trim();
      if (name) productCount.set(name, (productCount.get(name) || 0) + 1);
    }
  }

  const orderStatus = new Map();
  for (const o of orders) {
    const s = o.status || "Pending";
    orderStatus.set(s, (orderStatus.get(s) || 0) + 1);
  }

  const serviceCount = new Map();
  for (const b of bookings) {
    const s = String(b.service_want || "").trim();
    if (s) serviceCount.set(s, (serviceCount.get(s) || 0) + 1);
  }
  const bookingSenders = new Set(bookings.map((b) => b.sender_id).filter(Boolean));

  const conversions = isAgency ? bookings.length : orders.length;
  const prevConversions = isAgency ? prevBookings.length : prevOrders.length;
  // How many of the people who talked to the bot actually converted.
  const convertedPeople = isAgency ? bookingSenders.size : orders.length;
  const conversionPct = contacts.size ? Math.round((convertedPeople / contacts.size) * 1000) / 10 : null;

  const daily = [...dayMap.values()];
  const activeDays = daily.filter((d) => d.total > 0).length;
  const peak = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0]);
  const botPct = bot + agent > 0 ? Math.round((bot / (bot + agent)) * 100) : null;
  const prevBotPct = prevBot + prevAgent > 0 ? Math.round((prevBot / (prevBot + prevAgent)) * 100) : null;

  return NextResponse.json({
    range_days: days,
    business_type: isAgency ? "agency" : "ecommerce",
    generated_at: new Date().toISOString(),
    kpi: {
      total_messages: curMsgs.length,
      messages_today: todayCount,
      customer_messages: customer,
      bot_messages: bot,
      agent_messages: agent,
      unique_contacts: contacts.size,
      new_contacts: newContacts.size,
      returning_contacts: contacts.size - newContacts.size,
      bot_handled_pct: botPct,
      avg_messages_per_active_day: activeDays ? Math.round((curMsgs.length / activeDays) * 10) / 10 : 0,
      image_messages: imageMsgs,
      voice_messages: voiceMsgs,
      orders: orders.length,
      pending_orders: orders.filter((o) => (o.status || "Pending") === "Pending").length,
      revenue,
      avg_order_value: orders.length ? Math.round(revenue / orders.length) : 0,
      bookings: bookings.length,
      conversion_pct: conversionPct,
      peak_hour: peak.count > 0 ? peak.hour : null,
    },
    conversations: convStats,
    growth: {
      messages: pctChange(curMsgs.length, prevMsgs.length),
      contacts: pctChange(contacts.size, prevContacts.size),
      conversations: pctChange(convStats.total, prevConvStats.total),
      conversions: pctChange(conversions, prevConversions),
      revenue: pctChange(revenue, prevRevenue),
      // Percentage-point difference, not a ratio.
      bot_handled_points: botPct !== null && prevBotPct !== null ? botPct - prevBotPct : null,
      previous: {
        messages: prevMsgs.length,
        contacts: prevContacts.size,
        conversations: prevConvStats.total,
        conversions: prevConversions,
        revenue: prevRevenue,
      },
    },
    daily,
    conversions_daily: [...convMap.values()],
    channels: [...channelMap.values()].sort((a, b) => b.total - a.total),
    hours,
    top_queries: topOf(wordCount, 10).map((x) => ({ term: x.name, count: x.count })),
    top_products: topOf(productCount, 6),
    top_services: topOf(serviceCount, 6),
    order_status: [...orderStatus.entries()].map(([status, count]) => ({ status, count })),
  }, NO_CACHE);
}
