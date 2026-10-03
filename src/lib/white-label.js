// White-label: the same TellMore platform opened from a partner's address shows
// the partner's product name instead of ours (owner, 2026-10-03).
//
// It is ONE platform — one database, one server, the same accounts and the same
// bot. Nothing here separates data; it only decides which name the screens
// print. tellmoreai.com, and every address not listed below, stays TellMore AI.
//
// A partner gets an entry once their DNS points at Vercel and the domain is
// added to the Vercel project. `logo: false` means "name only": the partner has
// no mark of their own, and ours must not appear on their address.
//
// Pure, no imports, so tests/t-white-label.mjs can check it and both server
// pages (the host header) and client components (window.location) can use it.

export const DEFAULT_BRAND = Object.freeze({ id: "tellmore", name: "TellMore AI", logo: true });

const WHITE_LABELS = {
  // Partner: ufirstltd.com, product name "Tell Me". 60/40 revenue share.
  "tellme.ufirstltd.com": Object.freeze({ id: "tellme", name: "Tell Me", logo: false }),
};

// "TellMe.UfirstLtd.com:443" and "www.tellme.ufirstltd.com." both mean the same
// address. A host header can carry a port; a typed address can carry a trailing dot.
export function cleanHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

export function brandForHost(host) {
  return WHITE_LABELS[cleanHost(host)] || DEFAULT_BRAND;
}

export function isWhiteLabel(brand) {
  return !!brand && brand.id !== DEFAULT_BRAND.id;
}

// Swaps our product name for the partner's in a sentence. "TellMore AI" first,
// so "TellMore AI's" becomes "Tell Me's" and not "Tell Me AI's".
export function rebrand(text, brand) {
  if (!isWhiteLabel(brand) || text == null) return text;
  return String(text).replace(/TellMore AI/g, brand.name).replace(/TellMore/g, brand.name);
}

// For client components. The dashboard renders in the browser only (ssr:false),
// so reading window here cannot cause a server/client mismatch.
export function currentBrand() {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  return brandForHost(window.location.hostname);
}
