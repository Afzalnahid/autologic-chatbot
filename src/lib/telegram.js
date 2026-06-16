const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramMessage(chatId, text, parseMode = "HTML") {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

export async function sendChatAction(chatId, action = "typing") {
  await fetch(`${API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export async function getFileUrl(fileId) {
  const res = await fetch(`${API}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) throw new Error("Failed to get file: " + JSON.stringify(data));
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

export function parseTelegramUpdate(body) {
  const message = body.message;
  if (!message) return null;

  const chatId = message.chat.id;
  const text = message.caption || message.text || "";
  const photos = message.photo || [];
  const fileId = photos.length > 0 ? photos[photos.length - 1].file_id : null;

  return { chatId, text, fileId, raw: message };
}

export const PRODUCT_TEMPLATE = `Name:
Category:
Regular Price:
Sale Price:
Stock Status: instock
Description:

(Attach the product image and fill this template in the caption, then send.)`;
