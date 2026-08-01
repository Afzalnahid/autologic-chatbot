export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { composeReply, botAllowed, bufferInsert, saveMemory, getClient } from "@/lib/bot.js";
import { rateLimit } from "@/lib/rate-limit.js";
import { withErrors } from "@/lib/route-errors.js";

const PLATFORM = "website";

// The widget posts as text/plain so the browser treats it as a simple request and
// skips the preflight. The response still needs the origin header for the script
// to be allowed to read it.
function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// A domain matches when it is the host itself or any subdomain of it.
function originAllowed(origin, allowed) {
  const host = hostOf(origin);
  if (!host) return false;
  return (allowed || []).some((entry) => {
    const d = String(entry || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    if (!d) return false;
    return host === d || host.endsWith("." + d);
  });
}

async function channelForKey(key) {
  if (!key || String(key).length < 12) return null;
  const { data } = await supabase
    .from("channels").select("*")
    .eq("platform", PLATFORM).eq("page_id", String(key)).eq("status", "connected")
    .maybeSingle();
  return data || null;
}

export async function OPTIONS(request) {
  const origin = request.headers.get("origin") || "";
  const key = new URL(request.url).searchParams.get("k");
  const channel = await channelForKey(key);
  const ok = channel && originAllowed(origin, channel.allowed_domains);
  return new Response(null, {
    status: 204,
    headers: {
      ...cors(ok ? origin : ""),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const POST = withErrors(async (request) => {
  const origin = request.headers.get("origin") || request.headers.get("referer") || "";

  const raw = await request.text();
  let body = {};
  try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
  const { key, session_id: sessionId, message } = body;

  const channel = await channelForKey(key);
  // A bad key and a disallowed origin get the same answer on purpose: the widget
  // key is public, so this endpoint must not confirm which keys exist.
  if (!channel || !originAllowed(origin, channel.allowed_domains)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403, headers: cors("") });
  }

  const head = cors(origin);

  if (!sessionId || String(sessionId).length < 8) {
    return NextResponse.json({ error: "bad_session" }, { status: 400, headers: head });
  }
  const text = String(message || "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "empty_message" }, { status: 400, headers: head });

  const rl = rateLimit(`widget:${channel.id}:${sessionId}`, 20, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { items: [{ type: "text_msg", text: "একটু ধীরে পাঠান — কয়েক সেকেন্ড পরে আবার চেষ্টা করুন। / You're sending messages very quickly. Please try again in a moment." }] },
      { headers: head }
    );
  }

  const senderId = `web_${sessionId}`;
  const clientId = channel.client_id;

  // The visitor's message is recorded first, so the owner sees it in the inbox
  // even when the bot is not allowed to answer.
  await bufferInsert({
    sender_id: senderId, client_id: clientId, role: "customer", status: "Pending",
    message_content: text, platform: PLATFORM,
  });
  await supabase.from("contacts").upsert(
    { sender_id: senderId, client_id: clientId, name: `Website visitor · ${String(sessionId).slice(-4)}` },
    { onConflict: "sender_id" }
  ).select();

  const block = await botAllowed(channel, senderId);
  if (!block.allowed) {
    // On the website the visitor is watching an empty panel, so silence is not an
    // option the way it is on Messenger. Say something true and stop.
    const note = "ধন্যবাদ! আপনার মেসেজটি পৌঁছেছে — আমাদের টিম শিগগিরই উত্তর দেবে। / Thanks! Your message has reached us and our team will reply shortly.";
    await bufferInsert({
      sender_id: senderId, client_id: clientId, role: "bot", status: "Replied",
      message_content: note, platform: PLATFORM,
    });
    console.log("[widget] bot not allowed:", block.reason, { clientId });
    return NextResponse.json({ items: [{ type: "text_msg", text: note }], bot: false }, { headers: head });
  }

  const client = block.client || (await getClient(clientId));
  const bType = client?.business_type || "ecommerce";

  let items;
  try {
    const r = await composeReply({ clientId, client, bType, senderId, combined: text, platform: PLATFORM });
    items = r.items;
  } catch (e) {
    console.error("[widget] composeReply:", e.message);
    items = [{ type: "text_msg", text: "একটু সমস্যা হচ্ছে — আবার একবার চেষ্টা করুন। / Something went wrong at our end. Please try that again." }];
  }

  await supabase.from("message_buffer")
    .update({ status: "Replied" })
    .eq("client_id", clientId).eq("sender_id", senderId).eq("status", "Pending");

  for (const it of items) {
    await bufferInsert({
      sender_id: senderId, client_id: clientId, role: "bot", status: "Replied",
      message_content: it.type === "image_msg" ? "📷 Photo" : it.text,
      attachments: it.type === "image_msg" ? it.url : null,
      platform: PLATFORM,
    });
  }

  const aiText = items.filter((i) => i.text).map((i) => i.text).join("\n");
  await saveMemory(senderId, clientId, text, aiText);

  return NextResponse.json({ items, bot: true }, { headers: head });
}, "widget-chat");
