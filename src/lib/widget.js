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
