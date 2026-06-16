const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const API_URL = "https://graph.facebook.com/v18.0/me/messages";

async function callSendAPI(body) {
  const res = await fetch(`${API_URL}?access_token=${PAGE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Messenger API error:", err);
  }
}

export async function sendTypingOn(recipientId) {
  await callSendAPI({
    recipient: { id: recipientId },
    sender_action: "typing_on",
  });
}

export async function sendTextMessage(recipientId, text) {
  await callSendAPI({
    recipient: { id: recipientId },
    message: { text },
  });
}

export async function sendImageMessage(recipientId, imageUrl) {
  await callSendAPI({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "image",
        payload: { url: imageUrl, is_reusable: true },
      },
    },
  });
}

export async function sendResponses(recipientId, jsonArray) {
  for (const item of jsonArray) {
    await sendTypingOn(recipientId);
    if (item.type === "image_msg" && item.url) {
      await sendImageMessage(recipientId, item.url);
    } else if (item.type === "text_msg" && item.text) {
      await sendTextMessage(recipientId, item.text);
    }
  }
}

export function parseMessengerEvent(body) {
  const entry = body?.entry?.[0];
  const messaging = entry?.messaging?.[0];
  if (!messaging) return null;

  const senderId = messaging.sender?.id;
  const message = messaging.message;
  if (!senderId || !message) return null;

  const text = message.text || "";
  const attachments = message.attachments || [];

  const images = attachments
    .filter(a => a.type === "image" && a.payload?.url)
    .map(a => a.payload.url);

  const audio = attachments.find(a => a.type === "audio")?.payload?.url || null;

  return { senderId, text, images, audio, raw: messaging };
}
