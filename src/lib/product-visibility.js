// Whether the bot may sell a product. Pure (no imports), because the same rule
// runs in three places: the products API (reading the switch from the form),
// the bot's search (dropping hidden rows before the prompt is built) and the
// Inventory tab (the switch and its badge). Tested in tests/t-product-visibility.
//
// Owner's design (2026-09-20): a per-product "bot sells" switch. Off means the
// product stays in the catalogue — its photos, prices and history intact — but
// the bot never offers it, matches a photo to it, or takes an order for it.
// Stored as `hidden: true` in the product's metadata; absent means visible,
// so every product from before the switch existed is sold as it always was.

export const isHidden = (m) => !!m && (m.hidden === true || m.hidden === "1" || m.hidden === "true");

// The form sends the switch as text; anything but a clear "on" reads as off.
export const parseHidden = (v) => { const s = String(v ?? "").trim().toLowerCase(); return s === "1" || s === "true" || s === "on" || s === "yes"; };

// Search rows are { id, content, metadata, similarity }; a plain metadata
// object is accepted too. Hidden rows are dropped and the first k kept, in
// the order the search ranked them.
export function dropHidden(rows, k = Infinity) {
  return (rows || []).filter((r) => r && !isHidden(r.metadata ?? r)).slice(0, k);
}
