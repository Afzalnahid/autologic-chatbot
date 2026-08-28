// Is this product already in the catalogue?
//
// Every way into the catalogue asks this before writing: the drawer, the photo
// batch, the chat interview, the CSV, the product URL, the WooCommerce import
// and the assistant. It has to live in one place, because a duplicate that slips
// in through the sixth door is just as bad as one that comes through the first.
//
// Why it matters is not tidiness. The bot answers "how much is the box t-shirt"
// by searching the catalogue and reading back what it finds. With the same shirt
// stored twice it has two rows to choose between — two prices, two stock counts,
// two photos — and picks whichever the search scores higher that day. The
// customer gets a confident answer that may be the wrong one, and nobody can
// tell from the reply that anything is wrong.
//
// Three signals, in the order they are trusted:
//   code   — the same product code. A code is unique by definition.
//   name   — the same name once case, spacing and punctuation are ignored, so
//            "Box T-shirt" and "box t shirt" are the same product.
//   photo  — the same picture. Exact only, not "looks similar": for an upload
//            it is a hash of the bytes, for an import a hash of the image
//            address. It catches choosing the same folder twice or importing
//            the same shop twice, which is how this actually happens. A
//            re-photographed or re-compressed picture will not match, and the
//            message never claims otherwise.
//
// Never blocks an add because of its own failure. If the lookup breaks, the
// product goes in — an owner who cannot add stock has a worse problem than an
// owner with two rows to tidy up.
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase.js";
// The matching rules themselves live apart, because the dashboard needs them
// too and cannot import a file that reaches for supabase.
import { nameKey, codeKey } from "@/lib/duplicate-keys.js";
export { nameKey, codeKey };

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);

// The two photo keys are deliberately in different spaces: an uploaded file and
// a remote address are not comparable, and prefixing them means they can never
// be mistaken for one another.
export const bytesKey = (buf) => (buf?.length ? `b:${sha(buf)}` : "");
export const urlKey = (url) => (String(url || "").trim() ? `u:${sha(String(url).trim())}` : "");

// Just enough of every product to compare against. The slim form asks Postgres
// for four values out of the metadata instead of the whole document — a shop
// with a thousand products carries a paragraph of vision text in each one, and
// pulling all of it to compare two names would be megabytes per add. If a
// deployment will not serve that shape, the whole-row form always works.
const SLIM = "id, name:metadata->>product_name, code:metadata->>product_code, pkey:metadata->>photo_key";

async function index(clientId) {
  const slim = await supabase.from("products").select(SLIM).eq("client_id", clientId).limit(5000);
  if (!slim.error && Array.isArray(slim.data)) return slim.data;
  console.warn("[duplicates] slim select unavailable, reading full rows:", slim.error?.message);
  const full = await supabase.from("products").select("id,metadata").eq("client_id", clientId).limit(2000);
  return (full.data || []).map((r) => ({
    id: r.id, name: r.metadata?.product_name, code: r.metadata?.product_code, pkey: r.metadata?.photo_key,
  }));
}

// The first product that looks like the same thing, or null.
// `excludeId` is the row being edited — renaming a product must not find itself.
export async function findDuplicate(clientId, { name, code, photoKey, excludeId } = {}) {
  try {
    const nk = nameKey(name), ck = codeKey(code);
    if (!nk && !ck && !photoKey) return null;
    const rows = (await index(clientId)).filter((r) => !excludeId || String(r.id) !== String(excludeId));
    const hit = (r, reason) => ({ id: r.id, product_name: r.name || "", reason });
    let r;
    if (ck && (r = rows.find((x) => codeKey(x.code) === ck))) return hit(r, "code");
    if (nk && (r = rows.find((x) => nameKey(x.name) === nk))) return hit(r, "name");
    if (photoKey && (r = rows.find((x) => x.pkey === photoKey))) return hit(r, "photo");
    return null;
  } catch (e) {
    // Deliberately swallowed. See the note at the top of this file.
    console.error("[duplicates] lookup failed, allowing the add:", String(e?.message || e).slice(0, 200));
    return null;
  }
}

// Every row carrying a given product code. Used by the importers, where a
// second import of the same shop should REPLACE what it brought last time
// rather than refuse — that is an update, not a duplicate.
export async function findByCode(clientId, code) {
  const ck = codeKey(code);
  if (!ck) return [];
  try {
    return (await index(clientId)).filter((r) => codeKey(r.code) === ck).map((r) => r.id);
  } catch { return []; }
}

// What the owner reads. Plain, and specific about which product it clashes with,
// because "duplicate detected" tells nobody what to do next.
export function duplicateMessage(dup, thing = "product") {
  const name = dup?.product_name ? `“${dup.product_name}”` : `another ${thing}`;
  if (dup?.reason === "code") return `You already have a ${thing} with that code — ${name}. Two with the same code confuse the bot when a customer asks for one.`;
  if (dup?.reason === "photo") return `You have already added this exact photo — it is ${name}. The bot would not know which one to show when a customer sends that picture.`;
  return `You already have a ${thing} called ${name}. Two with the same name confuse the bot when a customer asks for it.`;
}

// Which of the uploaded files (or pasted addresses) ends up as the primary
// photo — the one the bot shows and matches a customer's picture against, and
// therefore the only one worth comparing.
export async function primaryPhotoKey(order, files) {
  const first = (order || [])[0] || (files?.length ? "upload:0" : "");
  const m = /^upload:(\d+)$/.exec(String(first));
  if (m) {
    const f = files?.[Number(m[1])];
    if (!f) return "";
    return bytesKey(Buffer.from(await f.arrayBuffer()));
  }
  return /^https?:\/\//.test(String(first)) ? urlKey(first) : "";
}
