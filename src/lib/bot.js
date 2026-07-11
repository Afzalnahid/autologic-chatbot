import { supabase } from "@/lib/supabase.js";
import { analyzeImage, transcribeAudio, chatWithGemini, generateEmbedding } from "@/lib/gemini.js";
import { sendTypingOn, sendResponses, waSendResponses, waSendText } from "@/lib/messenger.js";
import { analyzeImageBase64 } from "@/lib/gemini.js";

function visionPrompt(businessType, itemLabel) {
  const unit = itemLabel || "item";
  return `You are an expert product cataloger for a ${businessType || "business"}. First scan the image for any visible ${unit} code or SKU. If found, output only: CODE: <code>. Otherwise ignore background, hands, packaging and logos, and describe ONLY the ${unit} itself with precise physical and visual attributes: type, color, material, shape, distinguishing features. One dense technical paragraph.`;
}

const DEFAULT_PROMPT = "You are a helpful sales assistant. Reply ONLY with a JSON array of objects like {\"type\":\"text_msg\",\"text\":\"...\"}.";

const sb = () => supabase;

export async function getChannelByPage(pageId) {
  const { data } = await sb().from("channels").select("*").eq("status", "connected").limit(200);
  return (data || []).find(c => c.page_id === pageId) || null;
}

export async function getClient(clientId) {
  const { data } = await sb().from("clients").select("*").limit(200);
  return (data || []).find(c => c.id === clientId) || null;
}

async function botAllowed(channel, senderId) {
  if (channel.bot_enabled === false) return false;
  const { data: contacts } = await sb().from("contacts").select("*").limit(1000);
  const ct = (contacts || []).find(c => c.sender_id === senderId);
  if (ct && ct.bot_enabled === false) return false;
  const client = await getClient(channel.client_id);
  if (!client) return false;
  if (client.plan === "trial") {
    if (!client.trial_end || new Date(client.trial_end) <= new Date()) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: msgs } = await sb().from("message_buffer").select("client_id,role,created_at").limit(2000);
    const used = (msgs || []).filter(m => m.client_id === client.id && (m.role || "customer") === "customer" && new Date(m.created_at) >= today).length;
    if (used > 30) return false;
  } else if (client.plan !== "pro") {
    return false;
  }
  return true;
}

export async function bufferInsert(row) {
  const { data, error } = await sb().from("message_buffer").insert(row).select("id,created_at").single();
  if (error) console.error("buffer insert:", error.message);
  return data;
}

async function pendingFor(senderId, clientId) {
  const { data } = await sb().from("message_buffer").select("*").order("created_at", { ascending: true }).limit(500);
  return (data || []).filter(m => m.sender_id === senderId && m.client_id === clientId && m.status === "Pending");
}

async function getMemory(senderId, clientId) {
  const { data } = await sb().from("chat_memory").select("*").order("id", { ascending: false }).limit(300);
  return (data || []).filter(m => m.session_id === senderId).slice(0, 10).reverse()
    .map(r => {
      const t = r.message?.type;
      const content = r.message?.data?.content || r.message?.content || "";
      return { role: t === "ai" ? "assistant" : "user", content };
    }).filter(m => m.content);
}

async function saveMemory(senderId, clientId, userText, aiText) {
  await sb().from("chat_memory").insert([
    { session_id: senderId, client_id: clientId, message: { type: "human", data: { content: userText } } },
    { session_id: senderId, client_id: clientId, message: { type: "ai", data: { content: aiText } } },
  ]);
}

async function getSystemPrompt(clientId) {
  const { data } = await sb().from("app_settings").select("*").limit(200);
  const row = (data || []).find(r => r.id === String(clientId));
  return row?.settings?.systemPrompt || DEFAULT_PROMPT;
}

async function searchProducts(clientId, query, k = 3) {
  try {
    const emb = await generateEmbedding(query);
    const { data, error } = await sb().rpc("match_documents", {
      query_embedding: emb, match_count: k, filter: { client_id: String(clientId) },
    });
    if (error) { console.error("match_documents:", error.message); return []; }
    return data || [];
  } catch (e) { console.error("search:", e.message); return []; }
}

function parseReply(raw) {
  const cleaned = String(raw || "").replace(/```json|```/g, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return arr.filter(x => x && (x.type === "text_msg" || x.type === "image_msg"));
  } catch {}
  return cleaned ? [{ type: "text_msg", text: cleaned }] : [];
}

async function maybeSaveOrder(items, clientId) {
  for (const it of items) {
    if (it.type !== "order" || !it.order_code) continue;
    await sb().from("orders").insert({
      client_id: clientId,
      order_code: it.order_code,
      customer_name: it.customer_name || "",
      phone_number: it.phone_number || "",
      address: it.address || "",
      product_ids: it.product_ids || "",
      product_names: it.product_names || "",
      quantity: it.quantity || "",
      total_price: it.total_price || "",
      image_urls: it.image_urls || "",
      status: "Pending",
    });
  }
  return items.filter(it => it.type !== "order");
}

export async function processConversation(channel, senderId, myRowId) {
  const clientId = channel.client_id;
  const client = await getClient(clientId);
  const bType = client?.business_type || "ecommerce";
  await new Promise(r => setTimeout(r, 3000));

  let rows = await pendingFor(senderId, clientId);
  if (!rows.length) return;
  const newest = rows[rows.length - 1];
  if (myRowId && newest.id !== myRowId) return;

  for (let i = 0; i < 5; i++) {
    if (rows.every(r => r.message_content)) break;
    await new Promise(r => setTimeout(r, 2000));
    rows = await pendingFor(senderId, clientId);
  }
  rows = rows.filter(r => r.message_content);
  if (!rows.length) return;

  if (channel.platform !== "whatsapp") await sendTypingOn(channel.access_token, senderId);

  const combined = rows.map(r => r.message_content).join("\n");
  const [systemPrompt, history, products] = await Promise.all([
    getSystemPrompt(clientId),
    getMemory(senderId, clientId),
    searchProducts(clientId, combined, combined.includes("--- PRODUCT") ? 4 : 3),
  ]);

  const context = products.length
    ? "\n\nSEARCH RESULTS (source of truth, pick from these only):\n" +
      products.map(p => JSON.stringify(p.metadata || {})).join("\n")
    : "\n\nSEARCH RESULTS: none found.";

  const orderRule = "\n\nORDER SAVING: When the customer finally confirms an order with name, phone and address, ALSO append one object to the JSON array: {\"type\":\"order\",\"order_code\":\"<unique alphanumeric>\",\"customer_name\":\"..\",\"phone_number\":\"..\",\"address\":\"..\",\"product_ids\":\"codes comma separated\",\"product_names\":\"..\",\"quantity\":\"..\",\"total_price\":\"..\",\"image_urls\":\"..\"}. Never mention this object in text.";

  let raw;
  try {
    const rules = bType === "ecommerce" ? orderRule : "";
    raw = await chatWithGemini(systemPrompt + context + rules, [...history, { role: "user", content: combined }]);
  } catch (e) {
    console.error("gemini chat:", e.message);
    raw = "";
  }

  let items = parseReply(raw);
  items = await maybeSaveOrder(items, clientId);
  if (!items.length) items = [{ type: "text_msg", text: "দুঃখিত, একটু পরে আবার চেষ্টা করুন।" }];

  if (channel.platform === "whatsapp") await waSendResponses(channel.access_token, channel.page_id, senderId, items);
  else await sendResponses(channel.access_token, senderId, items);

  const ids = rows.map(r => r.id);
  for (const id of ids) await sb().from("message_buffer").update({ status: "Replied" }).eq("id", id);

  for (const it of items) {
    await bufferInsert({
      sender_id: senderId, client_id: clientId, role: "bot", status: "Replied",
      message_content: it.type === "image_msg" ? "📷 Photo" : it.text,
      attachments: it.type === "image_msg" ? it.url : null,
      platform: channel.platform || "facebook",
    });
  }

  await saveMemory(senderId, clientId, combined, items.filter(i => i.text).map(i => i.text).join("\n"));

  const orphans = await pendingFor(senderId, clientId);
  if (orphans.length) await processConversation(channel, senderId, null);
}

export async function handleIncoming(event) {
  const channel = await getChannelByPage(event.pageId);
  if (!channel) return;
  const clientId = channel.client_id;
  const client = await getClient(clientId);
  const bType = client?.business_type || "ecommerce";
  const iLabel = client?.item_label || "product";

  if (event.video) {
    const { sendTextMessage } = await import("@/lib/messenger.js");
    const msg = "দুঃখিত, আমরা ভিডিও মেসেজ প্রসেস করতে পারি না। পণ্যের ছবি বা কোড পাঠান।";
    const isWa = (event.platform || channel.platform) === "whatsapp";
    await bufferInsert({ sender_id: event.senderId, client_id: clientId, role: "customer", status: "Replied", message_content: "🎥 Video", platform: event.platform || channel.platform || "facebook" });
    if (isWa) await waSendText(channel.access_token, channel.page_id, event.senderId, msg);
    else await sendTextMessage(channel.access_token, event.senderId, msg);
    await bufferInsert({ sender_id: event.senderId, client_id: clientId, role: "bot", status: "Replied", message_content: msg, platform: event.platform || channel.platform || "facebook" });
    return;
  }

  let content = event.text || "";
  let attachments = null;

  if (event.audio) {
    try { content = await transcribeAudio(event.audio); } catch (e) {
      console.error("transcribe:", e.message);
      content = event.text || "(voice message)";
    }
  }

  if (event.mediaId && channel.platform === "whatsapp") {
    try {
      const meta = await fetch(`https://graph.facebook.com/v24.0/${event.mediaId}`, { headers: { Authorization: `Bearer ${channel.access_token}` } }).then(r => r.json());
      if (meta.url) {
        const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${channel.access_token}` } });
        const b64 = Buffer.from(await bin.arrayBuffer()).toString("base64");
        const mime = bin.headers.get("content-type") || "image/jpeg";
        const desc = await analyzeImageBase64(b64, mime, visionPrompt(bType, iLabel));
        const idBlock = `IDENTIFIED ITEMS:\n--- ITEM 1 ---\n${desc}`;
        content = content ? `${content}\n${idBlock}` : idBlock;
        attachments = "whatsapp-media";
      }
    } catch (e) { console.error("wa media:", e.message); }
  }

  if (event.images.length) {
    attachments = event.images.join(",");
    const parts = [];
    for (let i = 0; i < event.images.length; i++) {
      try {
        const desc = await analyzeImage(event.images[i], visionPrompt(bType, iLabel));
        parts.push(`--- ITEM ${i + 1} ---\n${desc}`);
      } catch (e) { console.error("vision:", e.message); }
    }
    const idBlock = parts.length ? `IDENTIFIED ITEMS:\n${parts.join("\n")}` : "📷 Photo";
    content = content ? `${content}\n${idBlock}` : idBlock;
  }

  if (!content) return;

  const row = await bufferInsert({
    sender_id: event.senderId, client_id: clientId, role: "customer", status: "Pending",
    message_content: content, attachments, platform: event.platform || channel.platform || "facebook",
  });

  const allowed = await botAllowed(channel, event.senderId);
  if (!allowed) return;

  await processConversation(channel, event.senderId, row?.id || null);
}

export async function runDemo(clientId, userText, history = []) {
  const [systemPrompt, products] = await Promise.all([
    getSystemPrompt(clientId),
    searchProducts(clientId, userText, 3),
  ]);
  const context = products.length
    ? "\n\nSEARCH RESULTS (source of truth, pick from these only):\n" +
      products.map(p => JSON.stringify(p.metadata || {})).join("\n")
    : "\n\nSEARCH RESULTS: none found.";
  let raw;
  try {
    raw = await chatWithGemini(systemPrompt + context, [...history, { role: "user", content: userText }]);
  } catch (e) {
    return { error: e.message, items: [] };
  }
  return { items: parseReply(raw) };
}
