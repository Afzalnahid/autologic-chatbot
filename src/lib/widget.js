import crypto from "crypto";

// The public widget key. Safe to publish — it identifies the tenant's widget but
// grants nothing on its own; the origin allow-list is what authorises a request.
export function newWidgetKey() {
  return "wk_" + crypto.randomBytes(24).toString("base64url");
}

export function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// "https://www.Example.com/shop" -> "example.com". Returns "" when unusable.
export function normalizeDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const d = raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .trim();
  if (!d) return "";
  if (d === "localhost" || d === "127.0.0.1") return d;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return "";
  return d;
}

// A request is allowed from the domain itself and from any of its subdomains.
export function originAllowed(origin, allowed) {
  const host = hostOf(origin);
  if (!host) return false;
  return (allowed || []).some((entry) => {
    const d = normalizeDomain(entry);
    if (!d) return false;
    return host === d || host.endsWith("." + d);
  });
}

// ---- the owner's replies, fetched by the widget ------------------------------
// A website visitor has no address to push a message to, so the widget asks
// every few seconds whether the owner has answered by hand from the inbox
// (owner, 2026-10-02: replies to website visitors went nowhere). These two
// pure helpers are the rules; the route is GET /api/widget/chat.

// The cut-off the widget sends back: a timestamp it got from us. Anything
// unreadable, or older than a day, becomes "now minus a day" so a bad value
// can never page through a visitor's whole history.
// A good value is passed through as written: the database keeps microseconds,
// and rounding "…07.123456+00:00" to "…07.123Z" would hand the same row back
// on every poll.
const STAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/;
export function pollSince(after, now = Date.now()) {
  const raw = String(after || "");
  const t = Date.parse(raw);
  const floor = now - 24 * 60 * 60 * 1000;
  if (!STAMP.test(raw) || !Number.isFinite(t) || t < floor) return new Date(floor).toISOString();
  if (t > now) return new Date(now).toISOString();
  return raw;
}

// message_buffer rows written by the owner (role "agent") → the widget's items.
// A photo row carries its public URL in `attachments`; its text is only the
// "📷 Photo" placeholder, which the visitor does not need to see.
// Every item carries its row's `at`, so the widget can skip one it has shown.
export function agentItems(rows) {
  const out = [];
  for (const r of rows || []) {
    const at = r.created_at || null;
    const urls = String(r.attachments || "").split(",").map((u) => u.trim()).filter((u) => /^https:\/\//.test(u));
    for (const url of urls) out.push({ type: "image_msg", url, at });
    const text = String(r.message_content || "").trim();
    if (text && !(urls.length && /^📷/.test(text))) out.push({ type: "text_msg", text, at });
  }
  return out;
}

// The cut-off for the next poll. With rows: the newest one shown. Without: a
// little BEHIND now, because a reply being saved while we looked can carry a
// timestamp just before "now" and would otherwise be stepped over for ever;
// the widget drops the repeat by its `at`.
export const POLL_OVERLAP_MS = 10 * 1000;
export function nextSince(rows, since, now = Date.now()) {
  if (rows?.length) return rows[rows.length - 1].created_at;
  const back = now - POLL_OVERLAP_MS;
  return since && Date.parse(since) > back ? since : new Date(back).toISOString();
}
