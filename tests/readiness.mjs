// Can the bot actually sell this?
//
// The owner's rule, in their words: a product they add has to be one the bot
// can show. Three things make that true, and each one fails in a way nobody
// sees from the outside:
//
//   a name   — without it nobody can ask for it, by any wording
//   a price  — the first question every customer asks. A product with no price
//              makes the bot answer "let me check" forever, or worse, guess.
//   a photo  — this market shops by sending pictures. Without one the product
//              cannot be matched to a customer's photo at all.
//
// So they are required at the moment a product is CREATED. Deliberately not on
// edit: a catalogue imported long ago may hold products missing one of these,
// and refusing to save an edit is refusing to let anyone fix them.
//
// Pure — no supabase, no AI. The server refuses with it, the dashboard shows
// what is missing with it, and the two therefore cannot disagree.

const has = (v) => String(v ?? "").trim().length > 0;

export const MISSING = {
  name: { label: "a name", why: "Nobody can ask for it without one." },
  price: { label: "a price", why: "It is the first thing a customer asks, and the bot cannot answer it." },
  photo: { label: "a photo", why: "Customers here shop by sending pictures. Without one the bot cannot match it." },
};

// What is missing before this can be sold. Takes either a saved product
// (metadata) or a draft being built, so one rule covers both.
export function missingToSell(p = {}) {
  const out = [];
  if (!has(p.product_name)) out.push("name");
  if (!has(p.regular_price) && !has(p.sale_price)) out.push("price");
  if (!has(p.image_url) && !(Array.isArray(p.images) && p.images.length)) out.push("photo");
  return out;
}

export const canSell = (p) => missingToSell(p).length === 0;

// A saved product that is sellable but whose photo could not be read is a
// separate, quieter problem: it shows fine when asked for by name and is
// invisible to a photo search. Worth telling the owner, never worth refusing.
export const findableByPhoto = (p = {}) => has(p.visual);

// The state a product is in, for the catalogue to show.
export function productState(p = {}) {
  const missing = missingToSell(p);
  if (missing.length) return { state: "incomplete", missing };
  if (!findableByPhoto(p)) return { state: "unreadable", missing: [] };
  return { state: "ready", missing: [] };
}

// One sentence the owner can act on. Never "validation failed".
export function missingMessage(missing, thing = "product") {
  const list = missing.map((k) => MISSING[k]?.label || k);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  const why = missing.map((k) => MISSING[k]?.why).filter(Boolean).join(" ");
  return `This ${thing} needs ${joined} before it can be saved. ${why}`.trim();
}

// The same three fields, read off a multipart form before anything has been
// uploaded — so a product that will be refused costs no upload and no AI call.
// `hasPhoto` is passed in because on a form it is files plus pasted links, not
// a field.
export function missingOnForm(fields = {}, hasPhoto = false) {
  return missingToSell({
    product_name: fields.product_name,
    regular_price: fields.regular_price,
    sale_price: fields.sale_price,
    image_url: hasPhoto ? "x" : "",
  });
}
