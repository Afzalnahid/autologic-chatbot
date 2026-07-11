const API = "https://graph.facebook.com/v24.0/me/messages";

async function send(token, body) {
  try {
    const r = await fetch(`${API}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.error) console.error("FB send error:", d.error.message);
    return d;
  } catch (e) {
    console.error("FB send failed:", e.message);
    return { error: e.message };
  }
}

export const sendTypingOn = (token, id) =>
  send(token, { recipient: { id }, sender_action: "typing_on" });

export const sendTextMessage = (token, id, text) =>
  send(token, { recipient: { id }, messaging_type: "RESPONSE", message: { text } });

export const sendImageMessage = (token, id, url) =>
  send(token, { recipient: { id }, message: { attachment: { type: "image", payload: { url, is_reusable: true } } } });

export async function sendResponses(token, id, items) {
  for (const it of items) {
    if (it.type === "image_msg" && it.url) await sendImageMessage(token, id, it.url);
    else if (it.type === "text_msg" && it.text) await sendTextMessage(token, id, it.text);
  }
}

export function parseMessengerEvent(body) {
  const platform = body?.object === "instagram" ? "instagram" : "facebook";
  const m = body?.entry?.[0]?.messaging?.[0];
  if (!m?.sender?.id || !m.message) return null;
  if (m.message.is_echo) return null;
  const atts = m.message.attachments || [];
  return {
    platform,
    senderId: m.sender.id,
    pageId: m.recipient?.id,
    text: m.message.text || "",
    images: atts.filter(a => (a.type === "image" || a.type === "share") && a.payload?.url).map(a => a.payload.url),
    audio: atts.find(a => a.type === "audio")?.payload?.url || null,
    video: atts.some(a => a.type === "video"),
  };
}

const WA_API = (phoneId) => `https://graph.facebook.com/v24.0/${phoneId}/messages`;

async function waSend(token, phoneId, body) {
  try {
    const r = await fetch(WA_API(phoneId), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.error) console.error("WA send error:", d.error.message);
    return d;
  } catch (e) {
    console.error("WA send failed:", e.message);
    return { error: e.message };
  }
}

export const waSendText = (token, phoneId, to, text) =>
  waSend(token, phoneId, { messaging_product: "whatsapp", to, type: "text", text: { body: text } });

export const waSendImage = (token, phoneId, to, url) =>
  waSend(token, phoneId, { messaging_product: "whatsapp", to, type: "image", image: { link: url } });

export async function waSendResponses(token, phoneId, to, items) {
  for (const it of items) {
    if (it.type === "image_msg" && it.url) await waSendImage(token, phoneId, to, it.url);
    else if (it.type === "text_msg" && it.text) await waSendText(token, phoneId, to, it.text);
  }
}

export function parseWhatsAppEvent(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const m = value?.messages?.[0];
  if (!m?.from) return null;
  return {
    platform: "whatsapp",
    senderId: m.from,
    pageId: value?.metadata?.phone_number_id,
    text: m.text?.body || m.button?.text || "",
    images: [],
    mediaId: m.image?.id || null,
    audio: null,
    audioId: m.audio?.id || null,
    video: !!m.video,
    profileName: value?.contacts?.[0]?.profile?.name || "",
  };
}
