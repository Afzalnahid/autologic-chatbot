// How two products are judged to be the same thing.
//
// Split out of duplicates.js because that file reaches for supabase and
// node:crypto and so can only run on the server, while the dashboard needs the
// same rules to point at the twins a catalogue is already carrying. One copy of
// the rule, two places that ask it — the alternative is a browser that
// disagrees with the server about what a duplicate is.

// Case, punctuation and spacing carry no meaning in a product name typed twice
// by the same person on two different days.
export function nameKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const codeKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// ── Twins already in the catalogue ───────────────────────────────────────────
// Stopping the next duplicate does nothing about the ones already there, and
// those are the ones confusing the bot today. This finds them in the product
// list the dashboard already holds, so it costs no request at all.
//
// Products are grouped by connection, not by one key at a time. A and B may
// share a code while B and C share a photo — that is one pile of three, not two
// pairs with B in both, and showing it as two pairs would have the owner delete
// B twice.

const SIGNALS = {
  code: (p) => codeKey(p?.product_code),
  name: (p) => nameKey(p?.product_name),
  photo: (p) => String(p?.photo_key || ""),
};

// How much a row actually says. The fullest one is the one worth keeping, so it
// is the one suggested — the owner can pick another.
export function richness(p) {
  return [
    p?.image_url, p?.regular_price, p?.description || p?.visual,
    p?.category, p?.brand,
    p?.stock_qty !== undefined && p?.stock_qty !== null ? "1" : "",
    (p?.images || []).length > 1 ? "1" : "",
    (p?.options || []).length ? "1" : "",
  ].filter(Boolean).length;
}

export function findTwins(products) {
  const list = (products || []).filter((p) => p && p.id != null);
  if (list.length < 2) return [];

  // Union-find: every shared key joins two products into the same pile.
  const parent = new Map(list.map((p) => [p.id, p.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  for (const read of Object.values(SIGNALS)) {
    const seen = new Map();
    for (const p of list) {
      const k = read(p);
      if (!k) continue;
      if (seen.has(k)) union(seen.get(k), p.id); else seen.set(k, p.id);
    }
  }

  const piles = new Map();
  for (const p of list) {
    const root = find(p.id);
    if (!piles.has(root)) piles.set(root, []);
    piles.get(root).push(p);
  }

  const out = [];
  for (const [root, items] of piles) {
    if (items.length < 2) continue;
    // Which signals actually did the joining, so the owner is told WHY these
    // are together rather than being asked to trust a verdict.
    const reasons = Object.entries(SIGNALS).filter(([, read]) => {
      const keys = items.map(read).filter(Boolean);
      return new Set(keys).size < keys.length;
    }).map(([name]) => name);
    const sorted = [...items].sort((a, b) =>
      richness(b) - richness(a) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
    out.push({ id: String(root), reasons, keep: sorted[0].id, items: sorted });
  }
  // Biggest piles first: they are the ones doing the most damage.
  return out.sort((a, b) => b.items.length - a.items.length);
}

export const twinReason = (reasons) => {
  const parts = [];
  if (reasons.includes("code")) parts.push("the same code");
  if (reasons.includes("name")) parts.push("the same name");
  if (reasons.includes("photo")) parts.push("the same photo");
  return parts.length ? parts.join(" and ") : "the same details";
};
