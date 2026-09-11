// Which conversations are UNREAD — Messenger's rule, kept pure so it can be
// tested. A chat is unread when its newest CUSTOMER message is newer than
// the last time this device looked at that chat (`seen[id]`) AND newer than
// the last "Mark all as read" (`watermark`). Opening a chat marks it seen at
// its newest customer message; Mark-all moves the watermark to now. A bot or
// dashboard reply does not make a chat read — the owner has not looked at it.
//
// The list carries a recent window of messages per chat, ascending by time;
// a chat whose window holds no customer message counts as read (there is
// nothing new to look at).

// Time (ms) of the newest customer message in this chat, or 0 if none.
export function lastCustomerAt(convo) {
  const msgs = Array.isArray(convo?.messages) ? convo.messages : [];
  let t = 0;
  for (const m of msgs) {
    if (!m || m.role !== "customer") continue;
    const ms = new Date(m.time).getTime();
    if (ms > t) t = ms;
  }
  return t;
}

export function isUnreadConvo(convo, state) {
  const at = lastCustomerAt(convo);
  if (!at) return false;
  const seen = Number(state?.seen?.[String(convo.id)]) || 0;
  const wm = Number(state?.watermark) || 0;
  return at > seen && at > wm;
}

export function unreadConvoCount(convos, state) {
  return (Array.isArray(convos) ? convos : []).filter((c) => isUnreadConvo(c, state)).length;
}

// "Mark all as read": every chat is seen up to its newest customer message,
// recorded per chat from the MESSAGE times, not the device clock — so a phone
// whose clock runs behind the server can never see "all unread again" after
// marking everything read. The watermark still moves, to the later of now
// and the newest message seen, for chats not in the current list.
export function markAllSeen(convos, state, now = Date.now()) {
  const seen = { ...(state?.seen || {}) };
  let newest = 0;
  for (const c of Array.isArray(convos) ? convos : []) {
    if (!c?.id) continue;
    const at = lastCustomerAt(c);
    if (!at) continue;
    if (at > (Number(seen[String(c.id)]) || 0)) seen[String(c.id)] = at;
    if (at > newest) newest = at;
  }
  return { seen, watermark: Math.max(Number(state?.watermark) || 0, Number(now) || 0, newest) };
}

// Newest N entries only, so the map never grows without bound.
export function trimSeen(seen, cap = 500) {
  const entries = Object.entries(seen || {}).filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, cap);
  return Object.fromEntries(entries);
}
