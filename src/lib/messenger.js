const FB_API = "https://graph.facebook.com/v24.0/me/messages";

// Instagram requires the IG account ID in the path — /me/messages is FB-only.
// pageId is the IG account numeric ID stored in channels.page_id.
const igApi = (pageId) => `https://graph.instagram.com/v24.0/${pageId}/messages`;

async function send(token, body, platform, pageId) {
  const isIG = platform === "instagram" || String(token).startsWith("IGA");
  const url = isIG ? igApi(pageId) : FB_API;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: isIG
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
      body: isIG ? JSON.stringify(body) : JSON.stringify({ ...body, access_token: token }),
    });
    const d = await r.json();
    if (d.error) console.error(`${isIG ? "IG" : "FB"} send error:`, d.error.message);
    return d;
  } catch (e) {
    console.error("send failed:", e.message);
    return { error: e.message };
  }
}

export const sendTypingOn = (token, id, platform, pageId) =>
  send(token, { recipient: { id }, sender_action: "typing_on" }, platform, pageId);

export const sendTextMessage = (token, id, text, platform, pageId) =>
  send(token, { recipient: { id }, messaging_type: "RESPONSE", message: { text } }, platform, pageId);

export const sendImageMessage = (token, id, url, platform, pageId) =>
  send(token, { recipient: { id }, message: { attachment: { type: "image", payload: { url, is_reusable: true } } } }, platform, pageId);

export async function sendResponses(token, id, items, platform, pageId) {
  for (const it of items) {
    if (it.type === "image_msg" && it.url) await sendImageMessage(token, id, it.url, platform, pageId);
    else if (it.type === "text_msg" && it.text) await sendTextMessage(token, id, it.text, platform, pageId);
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

// A new comment on a Page post arrives as a "feed" change, not a message.
// We only act on freshly added top-level/reply comments from someone else.
export function parseCommentEvent(body) {
  // Facebook Page comment: object=page, changes[].field=feed, item=comment
  if (body?.object === "page") {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.find(c => c.field === "feed");
    if (!change) return null;
    const v = change.value || {};
    if (v.item !== "comment" || v.verb !== "add") return null;
    if (!v.comment_id || !v.from?.id) return null;
    if (String(v.from.id) === String(entry.id)) return null; // Page replying to itself
    return {
      platform: "facebook",
      pageId: String(entry.id),
      commentId: v.comment_id,
      postId: v.post_id || null,
      parentId: v.parent_id || null,
      senderId: String(v.from.id),
      senderName: v.from.name || "",
      text: v.message || "",
    };
  }

  // Instagram comment: object=instagram, changes[].field=comments
  if (body?.object === "instagram") {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.find(c => c.field === "comments");
    if (!change) return null;
    const v = change.value || {};
    if (!v.id || !v.from?.id) return null;
    // Ignore the account commenting on itself.
    if (String(v.from.id) === String(entry.id)) return null;
    return {
      platform: "instagram",
      pageId: String(entry.id),          // the IG account id
      commentId: v.id,
      postId: v.media?.id || null,
      parentId: v.parent_id || null,
      senderId: String(v.from.id),
      senderName: v.from.username || "",
      text: v.text || "",
    };
  }

  return null;
}

// Public reply under the comment.
export const fbReplyToComment = (token, commentId, message) =>
  fetch(`https://graph.facebook.com/v24.0/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: token }),
  }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

// Instagram public reply to a comment — graph.instagram.com with a Bearer token.
export const igReplyToComment = (token, commentId, message) =>
  fetch(`https://graph.instagram.com/v24.0/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

// Instagram private reply (comment-to-inbox) — posted to the IG messages endpoint
// with the comment id as the recipient.
export const igPrivateReply = (token, igId, commentId, message) =>
  fetch(`https://graph.instagram.com/v24.0/${igId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: message } }),
  }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

// Private message to the commenter (comment-to-inbox). Only works within
// Facebook's messaging window and needs pages_messaging.
// Turns a raw Graph API failure into something a business owner can act on.
// Facebook returns the same generic "(#100) ... does not support this operation"
// for several very different situations, so we disambiguate by subcode/context.
export function explainPrivateReplyError(err) {
  if (!err) return null;
  const code = err.code;
  const sub = err.error_subcode;
  const msg = String(err.message || "");

  if (code === 100 && sub === 2018292) {
    return "That comment was deleted on Facebook before we could reply.";
  }
  if (code === 2022) {
    return "Facebook has temporarily blocked this Page from sending messages. It usually lifts on its own.";
  }
  if (code === 10 || /permission/i.test(msg) && /pages_messaging/i.test(msg)) {
    return "The pages_messaging permission is not approved yet, so inbox messages cannot be sent.";
  }
  if (code === 100) {
    return "Facebook would not deliver an inbox message for this comment. This happens when the comment came from a Page rather than a personal profile, when the person's privacy settings block private replies, when a private reply was already sent for this comment, or when the comment is older than 7 days.";
  }
  if (code === 200) {
    return "This Page is missing a permission needed to send inbox messages.";
  }
  return msg || "Facebook rejected the inbox message.";
}

export const fbPrivateReply = (token, commentId, message) =>
  fetch(`https://graph.facebook.com/v24.0/${commentId}/private_replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: token }),
  }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

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

// Marks the customer's incoming message as read (blue ticks) and shows a typing
// bubble. WhatsApp clears the indicator when we send the reply, or after 25s.
// Must reference an INCOMING message id — outgoing ids are rejected.
export const waMarkReadTyping = (token, phoneId, messageId) =>
  waSend(token, phoneId, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });

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
    msgId: m.id,
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

// WhatsApp status events (delivered, read, failed).
// "read" status means the customer has seen the message.
export function parseWhatsAppStatus(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const s = value?.statuses?.[0];
  if (!s?.status) return null;
  return {
    platform: "whatsapp",
    type: "status",
    status: s.status,       // sent | delivered | read | failed
    msgId: s.id,
    recipientId: s.recipient_id,
    phoneId: value?.metadata?.phone_number_id,
    timestamp: s.timestamp,
  };
}
