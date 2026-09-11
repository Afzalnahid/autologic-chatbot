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

// A reply typed by a human in the dashboard — text or an attachment.
//
// Sent as a plain RESPONSE first: inside Meta's standard 24-hour window that
// is the correct type and needs no tag. The old dashboard routes tagged every
// send HUMAN_AGENT, and that tag needs its own App Review approval — without
// it Meta rejects the whole message with "(#100) Cannot tag messages with
// 'HUMAN_AGENT' without prior approval", so no dashboard reply, photo or
// voice note was ever delivered, even to a customer who wrote a minute ago.
//
// Only when Meta answers "outside allowed window" (code 10, subcode 2018278)
// is the send retried WITH the tag: once the approval exists that buys 7 more
// days, and until then the owner gets the window explained in plain words
// instead of Meta's jargon.
//
// Routed through send() so Instagram goes to graph.instagram.com — the old
// routes also posted IG replies to the FB-only /me/messages endpoint.
const outsideWindow = (e) => !!e && (e.code === 10 || e.error_subcode === 2018278);

export async function sendAgentMessage(token, id, message, platform, pageId) {
  let d = await send(token, { recipient: { id }, messaging_type: "RESPONSE", message }, platform, pageId);
  if (d?.error && outsideWindow(d.error)) {
    d = await send(token, { recipient: { id }, messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT", message }, platform, pageId);
    if (d?.error) return { error: { message:
      "This chat's 24-hour reply window has closed — Meta only lets a business reply within 24 hours of the customer's last message. It reopens the moment they write again." } };
  }
  return d;
}

// A broadcast is not a reply, so it is sent as an UPDATE rather than a RESPONSE.
// Still only ever inside Meta's 24-hour window. Returns the raw platform response
// so the caller can surface the real error instead of swallowing it.
export const sendBroadcastText = (token, id, text, platform, pageId) =>
  send(token, { recipient: { id }, messaging_type: "UPDATE", message: { text } }, platform, pageId);

export async function sendResponses(token, id, items, platform, pageId) {
  for (const it of items) {
    if (it.type === "image_msg" && it.url) await sendImageMessage(token, id, it.url, platform, pageId);
    else if (it.type === "text_msg" && it.text) await sendTextMessage(token, id, it.text, platform, pageId);
  }
}

// The Meta app ids getvoicium itself sends through (Facebook app for Messenger
// and WhatsApp, Instagram app for Instagram). Same defaults as the login
// routes; these are public OAuth client ids, not secrets. Used to tell our own
// echoed sends apart from a human's reply typed in Meta's own tools.
const OWN_APP_IDS = new Set(
  [process.env.FB_APP_ID || "914246304594380", process.env.IG_APP_ID || "1249182887184854"]
    .filter(Boolean).map(String)
);

export function parseMessengerEvent(body) {
  const platform = body?.object === "instagram" ? "instagram" : "facebook";
  const m = body?.entry?.[0]?.messaging?.[0];
  if (!m?.sender?.id || !m.message) return null;
  const atts = m.message.attachments || [];

  // An ECHO is the Page's own outgoing message coming back to us. Two very
  // different things arrive this way and only one may be dropped:
  //
  //   • Our own Send API replies. They carry OUR app_id, and we already saved
  //     them when we sent them — echoing them back would store everything twice.
  //   • A message the OWNER typed by hand in the Messenger app or Page Inbox.
  //     Meta sends no other notification for it, and it has NO app_id. This used
  //     to be dropped with the rest, so a human reply existed nowhere: not in the
  //     dashboard inbox, and not in the bot's memory. The bot then answered the
  //     next message as if the owner had never spoken — re-asking what had just
  //     been answered and contradicting a price a human had already given.
  //
  // In an echo the sender is the PAGE and the recipient is the CUSTOMER, so the
  // two ids are the other way round from an ordinary message.
  //
  // "Has an app_id" is NOT the same as "is ours". Meta's own Page Inbox /
  // Business Suite and the Messenger app stamp THEIR app id on the owner's
  // hand-typed replies, so the old `if (app_id) drop` threw away exactly the
  // human replies this branch exists to keep (owner's report, 2026-09-11: a
  // reply from Business Suite while the bot was off never reached the inbox,
  // so the bot came back with no idea it had been answered). Only an echo
  // carrying OUR app id is our own send; every other echo is a human.
  if (m.message.is_echo) {
    if (m.message.app_id && OWN_APP_IDS.has(String(m.message.app_id))) return null; // our own send, already stored
    if (!m.recipient?.id) return null;
    return {
      platform,
      echo: true,
      senderId: m.recipient.id,             // the customer this was sent TO
      pageId: m.sender.id,                  // the page it was sent FROM
      msgId: m.message.mid || null,
      text: m.message.text || "",
      images: atts.filter(a => (a.type === "image" || a.type === "share") && a.payload?.url).map(a => a.payload.url),
      audio: null,
      video: false,
    };
  }

  return {
    platform,
    senderId: m.sender.id,
    pageId: m.recipient?.id,
    // Meta's own id for this exact message. Without it a slow reply (the
    // LLM call can take several seconds) makes Meta retry the webhook
    // delivery before we've answered the first one — handleIncoming had no
    // way to tell "already working on this" from "brand new message", so
    // one customer message could produce two or three replies.
    msgId: m.message.mid || null,
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

// Private message to the commenter (comment-to-inbox).
// Meta retired the /{comment-id}/private_replies edge — it now returns a generic
// "(#100) ... does not support this operation". Private replies go through the
// Send API instead, addressed to the page with the comment id as recipient,
// exactly like the Instagram path above. Needs pages_messaging.
export const fbPrivateReply = (token, pageId, commentId, message) =>
  fetch(`https://graph.facebook.com/v24.0/${pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
      messaging_type: "RESPONSE",
      access_token: token,
    }),
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
  const change = body?.entry?.[0]?.changes?.[0];
  // Coexistence (a number running on the WhatsApp Business app AND Cloud API)
  // delivers extra webhooks the bot must NEVER answer: `history` (old messages
  // replayed in the minutes after onboarding), `smb_app_state_sync` (contact
  // sync) and `smb_message_echoes` (messages the OWNER just sent from their own
  // phone). Each arrives under its own change.field — never "messages" — so we
  // bail on anything that is not a live customer message. Without this a
  // coexistence onboard could make the bot reply to months of history, or reply
  // to the owner's own outgoing messages.
  if (change?.field && change.field !== "messages") return null;
  const value = change?.value;
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
