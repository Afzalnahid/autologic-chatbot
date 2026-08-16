// Product catalogue helpers shared by add-product, products (edit) and the
// importers. A product is one row in `products`: the bot reads `metadata`,
// search reads `embedding`, and `content` is the text that was embedded.
//
// Everything the Inventory tab edits lives in `metadata` (jsonb):
//   product_code, product_name, category, brand, tags[], description,
//   regular_price, sale_price, stock_status ("instock"|"outofstock"), stock_qty,
//   image_url (primary), images[] (gallery), visual (vision text, kept so an
//   edit can re-embed without calling vision again),
//   options[] ({name, values[]}) and variants[] ({id, name, sku, attrs{},
//   regular_price, sale_price, stock_qty, stock_status, image_url}).
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding } from "@/lib/gemini.js";

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

// The text that gets embedded. Richer than before (category, brand, tags and
// option values), so "red dress size M" finds the right row.
export function buildContent(m) {
  const lines = [
    `Product Code: ${m.product_code || ""}`,
    `Name: ${m.product_name || ""}`,
    m.category ? `Category: ${m.category}` : "",
    m.brand ? `Brand: ${m.brand}` : "",
    m.tags?.length ? `Tags: ${m.tags.join(", ")}` : "",
    m.options?.length ? `Options: ${m.options.map((o) => `${o.name}: ${o.values.join("/")}`).join("; ")}` : "",
    m.visual || m.description || "",
    m.visual && m.description ? m.description : "",
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
  if (has("stock_status")) set("stock_status", str(g("stock_status")) === "outofstock" ? "outofstock" : "instock");
  if (has("stock_qty")) { const q = str(g("stock_qty")); set("stock_qty", q === "" ? null : Math.max(0, Math.floor(num(q)))); }
  if (has("options")) set("options", normalizeOptions(parseJSON(g("options"), [])));
  if (has("variants")) set("variants", normalizeVariants(parseJSON(g("variants"), [])));
  // Existing gallery URLs the owner kept (edit) or pasted (add).
  if (has("image_urls")) set("image_urls", parseJSON(g("image_urls"), []).map(str).filter((u) => /^https?:\/\//.test(u)).slice(0, 12));
  else if (has("image_url") && str(g("image_url"))) set("image_urls", [str(g("image_url"))]);
  return { fields, files };
}

// Vision runs once per new primary image; the description is stored in
// metadata.visual so later edits can re-embed without another vision call.
export async function describeImage(url, client) {
  if (!url) return { visual: "", analyzeError: null };
  try {
    return { visual: await analyzeImage(url, visionPrompt(client.business_type || "ecommerce", client.item_label || "product")), analyzeError: null };
  } catch (e) { return { visual: "", analyzeError: e.message }; }
}

export async function embedProduct(metadata) {
  const content = buildContent(metadata);
  const embedding = await generateEmbedding(content);
  return { content, embedding };
}
