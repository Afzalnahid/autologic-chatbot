// Product catalogue helpers shared by add-product, products (edit) and the
// importers. A product is one row in `products`: the bot reads `metadata`,
// search reads `embedding`, and `content` is the text that was embedded.
//
// Everything the Inventory tab edits lives in `metadata` (jsonb):
//   product_code, product_name, category, brand, tags[], description,
//   regular_price, sale_price, stock_status ("instock"|"outofstock"), stock_qty,
//   image_url (primary), images[] (gallery), visual (vision text for the
//   PRIMARY photo, kept so an edit can re-embed without calling vision again),
//   visuals[] (vision text for every photo, so a customer's picture of the back
//   of a shirt finds the shirt),
//   options[] ({name, values[]}) and variants[] ({id, name, sku, attrs{},
//   regular_price, sale_price, stock_qty, stock_status, image_url}).
import { supabase } from "@/lib/supabase.js";
import { generateEmbedding } from "@/lib/gemini.js";
import { embedMeter } from "@/lib/usage.js";
import { getClientAI } from "@/lib/ai.js";

// Must stay identical to the prompt used at message time (docs/prompts.md):
// both descriptions are embedded and compared, so any drift breaks matching.
export function visionPrompt(bType, unit) {
  return `You are an elite product cataloger for a ${bType || "business"}. Task: produce a precise, search-optimized description of the ${unit || "item"} so a semantic search can match it perfectly.

Step 1: Scan for any printed code, SKU or model number. If present, begin the output with: CODE: <exact code>
Step 2: Ignore all background, hands, gloves, packaging, boxes, watermarks and logos. Describe ONLY the ${unit || "item"} itself.
Capture with precision: exact type and subtype, primary and secondary colors, material and finish, shape and silhouette, patterns or motifs, notable components or parts, size cues, and any unique distinguishing features.
Output one dense technical paragraph. No preamble, no marketing language.`;
}

const str = (v) => (v === undefined || v === null ? "" : String(v)).trim();
const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };

export function parseTags(v) {
  if (Array.isArray(v)) return v.map(str).filter(Boolean).slice(0, 30);
  return str(v).split(/[,\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 30);
}

export function parseJSON(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

// Options are the axes ("Size": S/M/L); variants are the sellable combinations.
export function normalizeOptions(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((o) => ({ name: str(o?.name).slice(0, 40), values: parseTags(o?.values).slice(0, 40) }))
    .filter((o) => o.name && o.values.length).slice(0, 5);
}

export function normalizeVariants(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((v, i) => {
    const attrs = {};
    if (v?.attrs && typeof v.attrs === "object") for (const [k, val] of Object.entries(v.attrs)) { const kk = str(k), vv = str(val); if (kk && vv) attrs[kk] = vv; }
    const name = str(v?.name) || Object.values(attrs).join(" / ");
    const qty = v?.stock_qty === "" || v?.stock_qty === undefined || v?.stock_qty === null ? null : Math.max(0, Math.floor(num(v.stock_qty)));
    const status = str(v?.stock_status) === "outofstock" || qty === 0 ? "outofstock" : "instock";
    return {
      id: str(v?.id) || `v${Date.now().toString(36)}${i}`,
      name, sku: str(v?.sku).slice(0, 60), attrs,
      regular_price: str(v?.regular_price), sale_price: str(v?.sale_price),
      stock_qty: qty, stock_status: status, image_url: str(v?.image_url),
    };
  }).filter((v) => v.name).slice(0, 200);
}

// Every description this product has, in gallery order, with the primary first
// and nothing said twice.
//
// `visual` has always been the description of the FIRST photo, and for a long
// time it was the only one that existed. So a shop photographs a shirt from the
// front, the back and close up, saves all three, and the catalogue knows only
// what the front looks like. A customer sends a picture of the BACK — the exact
// garment, photographed by the shop, sitting in the catalogue — and the two
// descriptions have almost nothing in common, the similarity falls under the
// 0.5 floor, and the bot says it cannot find it.
//
// `visuals` is every photo's description. `visual` is kept beside it, unchanged
// and still meaning the primary, because duplicate detection and the readiness
// rule both read it and neither is asking this question.
export function visualsOf(m) {
  const all = Array.isArray(m?.visuals) ? m.visuals : [];
  const list = (all.length ? [m?.visual, ...all] : [m?.visual]).map(str).filter(Boolean);
  // The same picture described twice only weights the repetition; it adds
  // nothing a customer could send.
  return [...new Set(list)];
}

// The text that gets embedded. Richer than before (category, brand, tags,
// option values and now every photo), so "red dress size M" finds the right row
// and so does a photograph of its back.
export function buildContent(m) {
  const lines = [
    `Product Code: ${m.product_code || ""}`,
    `Name: ${m.product_name || ""}`,
    m.category ? `Category: ${m.category}` : "",
    m.brand ? `Brand: ${m.brand}` : "",
    m.tags?.length ? `Tags: ${m.tags.join(", ")}` : "",
    m.options?.length ? `Options: ${m.options.map((o) => `${o.name}: ${o.values.join("/")}`).join("; ")}` : "",
    ...visualsOf(m),
    m.description || "",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function uploadProductImage(clientId, file) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from("product-images").upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error("upload failed: " + error.message);
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

// ── Storage cleanup ──────────────────────────────────────────────────────────
// Deleting a product deletes its ROW; the image FILES it pointed at used to be
// left behind in the bucket for ever — orphans that fill the storage quota and
// stay reachable by their public URL after the owner meant to delete them. These
// three helpers remove them, and they are deliberately CAUTIOUS about what they
// will touch: only this client's own product photos, never an imported external
// URL and never a chat image.

const IMAGE_BUCKET = "product-images";

// Every image URL a product row points at — the primary, the gallery, and each
// variant's own photo. Deduped, blanks dropped.
export function productImageUrls(metadata = {}) {
  const urls = [
    metadata.image_url,
    ...(Array.isArray(metadata.images) ? metadata.images : []),
    ...(Array.isArray(metadata.variants) ? metadata.variants : []).map((v) => v?.image_url),
  ];
  return [...new Set(urls.map((u) => String(u || "").trim()).filter(Boolean))];
}

// The storage path inside product-images for a URL WE uploaded for THIS client's
// product — or null for anything we must not delete:
//   • an external URL (a WooCommerce/Shopify import points at their server), which
//     has no /object/public/product-images/ segment at all;
//   • a file under another client's folder (the path must start `<clientId>/`);
//   • a chat image, which lives at `<clientId>/chat/…` and belongs to a
//     conversation, not a product.
// A product photo sits DIRECTLY under the client folder (`<clientId>/<file>`), so
// anything with a further slash is refused — the safe default is to touch less.
export function ownProductImagePath(url, clientId) {
  const marker = `/object/public/${IMAGE_BUCKET}/`;
  const s = String(url || "");
  const at = s.indexOf(marker);
  if (at === -1) return null;
  let path = s.slice(at + marker.length).split("?")[0];
  try { path = decodeURIComponent(path); } catch { /* keep the raw path */ }
  const prefix = `${clientId}/`;
  if (!clientId || !path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  if (!rest || rest.includes("/")) return null; // chat/ images and anything nested
  return path;
}

// Remove product image FILES from storage. Best-effort and never throws — a
// failed cleanup must not fail (or undo) the delete that asked for it. Only ever
// touches this client's own product photos (see ownProductImagePath), so passing
// it a gallery that mixes in external or chat URLs is safe.
export async function removeProductImages(clientId, urls) {
  const paths = [...new Set((urls || []).map((u) => ownProductImagePath(u, clientId)).filter(Boolean))];
  if (!paths.length) return { removed: 0, paths: [] };
  try {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
    if (error) { console.error("[storage] product image cleanup failed:", error.message); return { removed: 0, paths, error: error.message }; }
    return { removed: paths.length, paths };
  } catch (e) {
    console.error("[storage] product image cleanup threw:", e?.message || e);
    return { removed: 0, paths, error: String(e?.message || e) };
  }
}

// Reads every product field out of a multipart form (add and edit share it).
// Returns { fields, files } — files are the new image uploads, in order.
export function readProductForm(form) {
  const g = (k) => form.get(k);
  const files = form.getAll("images").filter((f) => f && typeof f !== "string");
  const single = g("image"); // legacy single-file field
  if (single && typeof single !== "string") files.unshift(single);
  const has = (k) => form.has(k);
  const fields = {};
  const set = (k, v) => { fields[k] = v; };
  if (has("product_code")) set("product_code", str(g("product_code")));
  if (has("product_name")) set("product_name", str(g("product_name")).slice(0, 160));
  if (has("category")) set("category", str(g("category")).slice(0, 80));
  if (has("brand")) set("brand", str(g("brand")).slice(0, 80));
  if (has("tags")) set("tags", parseTags(g("tags")));
  if (has("regular_price")) set("regular_price", str(g("regular_price")));
  if (has("sale_price")) set("sale_price", str(g("sale_price")));
  if (has("description")) set("description", str(g("description")).slice(0, 4000));
  // The vision description, when the caller already has it. /api/photo-draft
  // reads a photo before anything is saved so the owner can check the name it
  // proposes; sending that description back means vision does not run a second
  // time on the same picture at save.
  if (has("visual")) set("visual", str(g("visual")).slice(0, 4000));
  // The descriptions of the OTHER photos, when the browser has already read
  // them — the photo sheet and the chat both do, one call per photo, so the
  // save does not repeat work that has been done and paid for.
  if (has("visuals")) set("visuals", parseJSON(g("visuals"), []).map((v) => str(v).slice(0, 4000)).slice(0, 12));
  if (has("stock_status")) set("stock_status", str(g("stock_status")) === "outofstock" ? "outofstock" : "instock");
  if (has("stock_qty")) { const q = str(g("stock_qty")); set("stock_qty", q === "" ? null : Math.max(0, Math.floor(num(q)))); }
  if (has("options")) set("options", normalizeOptions(parseJSON(g("options"), [])));
  if (has("variants")) set("variants", normalizeVariants(parseJSON(g("variants"), [])));
  // The gallery in the owner's order: kept/pasted URLs and "upload:N"
  // placeholders standing for the Nth file in `images`, so a new photo can be
  // made primary in the same save.
  if (has("image_urls")) set("image_urls", parseJSON(g("image_urls"), []).map(str).filter((u) => /^https?:\/\//.test(u) || /^upload:\d+$/.test(u)).slice(0, 12));
  else if (has("image_url") && str(g("image_url"))) set("image_urls", [str(g("image_url"))]);
  return { fields, files };
}

// Turns the ordered gallery (URLs + "upload:N" placeholders) into final URLs.
// Uploaded files nobody referenced are appended, nothing is listed twice.
//
// `claimed` holds the indexes a variant has taken for its own photo. Those are
// deliberately NOT appended: a variant photo answers "what does the red one
// look like", and dropping twenty of them into the gallery would make the bot
// show a customer twenty near-identical pictures of the same shirt.
export function resolveGallery(order, uploaded, claimed = new Set()) {
  const out = [];
  const seen = new Set();
  const push = (u) => { if (u && !seen.has(u)) { seen.add(u); out.push(u); } };
  for (const item of order || []) {
    const m = /^upload:(\d+)$/.exec(item);
    push(m ? uploaded[Number(m[1])] : item);
  }
  uploaded.forEach((u, i) => { if (!claimed.has(i)) push(u); });
  return out.slice(0, 12);
}

// Which uploads the variants have spoken for, so resolveGallery can leave them
// out. Read before the files are turned into URLs, because the placeholder is
// what carries the index.
export function claimedByVariants(variants) {
  const claimed = new Set();
  for (const v of variants || []) {
    const m = /^upload:(\d+)$/.exec(String(v?.image_url || ""));
    if (m) claimed.add(Number(m[1]));
  }
  return claimed;
}

// Turns each variant's "upload:N" placeholder into the URL of the file that was
// actually uploaded. A variant that points at a file which never arrived keeps
// no picture rather than an unusable placeholder — a broken link in a customer's
// chat is worse than no picture at all.
export function resolveVariantImages(variants, uploaded) {
  return (variants || []).map((v) => {
    const m = /^upload:(\d+)$/.exec(String(v?.image_url || ""));
    if (!m) return v;
    return { ...v, image_url: uploaded[Number(m[1])] || "" };
  });
}

// Vision runs once per new primary image; the description is stored in
// metadata.visual so later edits can re-embed without another vision call.
// It runs on the client's own key when they have one — the same provider then
// describes photos at import time and at message time, so the embedded
// descriptions stay stylistically comparable (docs/prompts.md).
export async function describeImage(url, client) {
  if (!url) return { visual: "", analyzeError: null };
  try {
    const ai = await getClientAI(client.id, "product");
    return { visual: await ai.visionUrl(url, visionPrompt(client.business_type || "ecommerce", client.item_label || "product")), analyzeError: null };
  } catch (e) { return { visual: "", analyzeError: e.message }; }
}

// Every OTHER photo of the same product, read together.
//
// Three things make this safe to do on a route with a sixty-second budget, and
// all three matter:
//
// - It runs in parallel, not one after another. Twelve photos read in turn is a
//   minute on its own.
// - It has a deadline. Whatever has come back when the clock runs out is what
//   gets used; the rest are simply not there. A product that saves knowing ten
//   of its twelve photos is a good outcome. A product that fails to save
//   because the eleventh was slow is not.
// - It never throws. These descriptions make the product easier to FIND; they
//   are not what makes it a product. A photo nobody could read costs that photo
//   and nothing else.
//
// Most saves never reach it: the browser has usually read the photos already,
// through /api/photo-draft, and posts the descriptions back. This is the path
// for the importers, where the photos are URLs the browser never held.
export async function describeImages(urls, client, { deadlineMs = 25000, max = 12 } = {}) {
  const list = (urls || []).filter(Boolean).slice(0, max);
  if (!list.length) return { visuals: [], missed: 0 };

  const prompt = visionPrompt(client.business_type || "ecommerce", client.item_label || "product");
  let ai;
  try { ai = await getClientAI(client.id, "product"); } catch { return { visuals: list.map(() => ""), missed: list.length }; }

  const out = list.map(() => "");
  const timeUp = new Promise((r) => setTimeout(r, deadlineMs));
  await Promise.race([
    Promise.allSettled(list.map(async (u, i) => { out[i] = await ai.visionUrl(u, prompt); })),
    timeUp,
  ]);
  return { visuals: out, missed: out.filter((v) => !v).length };
}

// Embeds through the client's AI so a Gemini BYOK client indexes on their own
// key (same model, same vector space, their cost), while everyone else uses the
// platform key. clientId falls back to the one on the metadata.
export async function embedProduct(metadata, clientId) {
  const content = buildContent(metadata);
  const id = clientId || metadata?.client_id;
  const embedding = await (await getClientAI(id, "product")).embed(content);
  return { content, embedding };
}
