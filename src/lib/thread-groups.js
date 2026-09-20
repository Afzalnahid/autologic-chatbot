// How the inbox draws a thread: which pictures belong together. Pure (no
// imports) so the Inbox and the test suite run the same code.
//
// Owner, 2026-09-21: pictures sent together should show as one group, the way
// Facebook Messenger shows them, and open full screen on a tap. A burst of
// photos reaches us two ways — several attachments on ONE message, or one
// message PER photo a second apart — and both must come out as one group.

// What a message says once the placeholders a picture carries are taken out:
// the bot's stored reply has a "🖼️ Image" line per picture, and a customer's
// photo arrives as "📷 Photo".
export function plainText(m) {
  const has = (m?.attachments || []).length > 0;
  const t = has
    ? String(m?.text || "").split("\n").filter((l) => l.trim() !== "🖼️ Image").join("\n").trim()
    : String(m?.text || "");
  return t === "📷 Photo" ? "" : t;
}

// The window inside which picture-only messages from the same side are one burst.
export const BURST_MS = 120000;

// msgs: [{ role, text, attachments[], time }] oldest first.
// productFor(url): the product whose own image that is, or null — a picture the
// BOT sent that is a product's image stays a product card and never joins a group.
// Returns [{ m, text, cards[], imgs[], onlyPics, lastTime }]; `m` is the first
// message of the item (its time and role are the item's).
export function groupThread(msgs, productFor = () => null) {
  const out = [];
  for (const m of msgs || []) {
    const cards = [], imgs = [];
    for (const u of m.attachments || []) {
      const p = m.role === "bot" ? productFor(u) : null;
      if (p) cards.push(p); else imgs.push(u);
    }
    const text = plainText(m);
    const onlyPics = imgs.length > 0 && !cards.length && !text;
    const last = out[out.length - 1];
    if (onlyPics && last && last.onlyPics && last.m.role === m.role
      && Math.abs(new Date(m.time) - new Date(last.lastTime)) <= BURST_MS
      && new Date(m.time).toDateString() === new Date(last.m.time).toDateString()) {
      last.imgs.push(...imgs);
      last.lastTime = m.time;
      continue;
    }
    out.push({ m, text, cards, imgs, onlyPics, lastTime: m.time });
  }
  return out;
}
