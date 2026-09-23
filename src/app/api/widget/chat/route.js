export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { composeReply, botAllowed, bufferInsert, botReplyRows, saveMemory, getClient, notifyIncomingMessage, flagNeedsHuman } from "@/lib/bot.js";
import { rateLimit } from "@/lib/rate-limit.js";
import { withErrors } from "@/lib/route-errors.js";
import { originAllowed } from "@/lib/widget.js";
import { featureGate } from "@/lib/plan-limits.js";

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
  const savedRow = await bufferInsert({
    sender_id: senderId, client_id: clientId, role: "customer", status: "Pending",
    message_content: text, platform: PLATFORM, page_id: channel.page_id || null,
  });
  await supabase.from("contacts").upsert(
    { sender_id: senderId, client_id: clientId, name: `Website visitor · ${String(sessionId).slice(-4)}` },
    { onConflict: "client_id,sender_id" }
  ).select();
  // The owner's phone, when a visitor starts a conversation — the same rule as
  // Messenger/WhatsApp (this path used to send no push at all). The row just
  // saved is passed as the cut-off so it is not counted as "an earlier message"
  // — otherwise the first message of every chat would look mid-conversation and
  // never notify. Fire-and-forget.
  notifyIncomingMessage(clientId, senderId, text, savedRow?.created_at || null).catch(() => {});

  const block = await botAllowed(channel, senderId);
  if (!block.allowed) {
    // The visitor is told NOTHING — the owner's rule (2026-09-06): a lapsed
    // subscription must not announce itself to a customer. `off` says so
    // explicitly rather than leaving the widget to infer it from an empty
    // items array — the same flag a bot that cannot reply now uses, below.
    //
    // Their message is already saved above, so it is waiting in the inbox the
    // moment the plan is renewed.
    console.log("[widget] bot not allowed:", block.reason, { clientId });
    return NextResponse.json({ items: [], bot: false, off: true }, { headers: head });
  }

  const client = block.client || (await getClient(clientId));
  const bType = client?.business_type || "ecommerce";

  // Package gate — see FEATURE_DEFS in src/lib/features.js. Same shape as a
  // paused bot: the message is saved for the inbox, the visitor gets no reply.
  const gate = await featureGate(client, "widget");
  if (!gate.ok) {
    console.log("[widget] not in package:", { clientId });
    return NextResponse.json({ items: [], bot: false, off: true }, { headers: head });
  }

  // The same rule as every other channel (owner, 2026-09-24): a visitor is
  // never shown that the bot is broken. `off` is the widget's existing "say
  // nothing" answer — it was built for a lapsed plan, and from the visitor's
  // side a bot that cannot reply is the same thing. Their message is saved, the
  // conversation is flagged, and the owner is told to answer it themselves.
  let items, quiet = false;
  try {
    const r = await composeReply({ clientId, client, bType, senderId, combined: text, platform: PLATFORM, pageId: channel.page_id || "" });
    items = r.items;
    quiet = !!r.failed;
    if (r.handoff || r.failed) flagNeedsHuman(clientId, senderId, text, PLATFORM, r.failed ? "bot_failed" : undefined).catch(() => {});
  } catch (err) {
    console.error("[widget] composeReply:", err.message);
    items = [];
    quiet = true;
    flagNeedsHuman(clientId, senderId, text, PLATFORM, "bot_failed").catch(() => {});
  }

  // Only mark the visitor's message answered when it actually was. A failed
  // reply leaves it Pending, so the inbox still shows it waiting, exactly as on
  // Messenger, Instagram and WhatsApp.
  if (!quiet) {
    await supabase.from("message_buffer")
      .update({ status: "Replied" })
      .eq("client_id", clientId).eq("sender_id", senderId).eq("status", "Pending");
  }

  for (const row of botReplyRows(items, { sender_id: senderId, client_id: clientId, platform: PLATFORM, page_id: channel.page_id || null })) {
    await bufferInsert(row);
  }

  // Nothing was said, so there is nothing to remember. An empty bot turn in
  // the memory would teach the next reply that this question was answered.
  if (!quiet) {
    const aiText = items.filter((i) => i.text).map((i) => i.text).join("\n");
    await saveMemory(senderId, clientId, text, aiText);
  }

  return NextResponse.json({ items, bot: true, ...(quiet ? { off: true } : {}) }, { headers: head });
}, "widget-chat");
