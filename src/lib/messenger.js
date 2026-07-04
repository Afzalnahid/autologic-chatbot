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
  const m = body?.entry?.[0]?.messaging?.[0];
  if (!m?.sender?.id || !m.message) return null;
  if (m.message.is_echo) return null;
  const atts = m.message.attachments || [];
  return {
    senderId: m.sender.id,
    pageId: m.recipient?.id,
    text: m.message.text || "",
    images: atts.filter(a => a.type === "image" && a.payload?.url).map(a => a.payload.url),
    audio: atts.find(a => a.type === "audio")?.payload?.url || null,
    video: atts.some(a => a.type === "video"),
  };
}
