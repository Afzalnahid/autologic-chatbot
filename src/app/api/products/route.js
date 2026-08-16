export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { readProductForm, uploadProductImage, describeImage, embedProduct } from "@/lib/products.js";

export const GET = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  const { data: rows } = await supabase.from("products").select("id,metadata,client_id,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1000);
  const products = (rows || []).map(r => ({ id: r.id, created_at: r.created_at, ...(r.metadata || {}) }));
  return NextResponse.json(products);
}, "products");

// Edit one product from the Inventory tab. Multipart form: `id`, any of the
// fields readProductForm() knows, `image_urls` (the gallery the owner kept, in
// order) and new `images` files. Only fields present in the form change.
// The row is re-embedded when anything the search reads has changed; vision
// runs again only when the primary image is new.
export const PATCH = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rl = rateLimit(`edit-product:${client.id}`, 120, 3600000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are editing products very quickly. Please wait a moment.");

  const form = await request.formData();
  const id = String(form.get("id") || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data: row } = await supabase.from("products").select("id,metadata").eq("id", id).eq("client_id", client.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { fields, files } = readProductForm(form);
  const prev = row.metadata || {};
  const next = { ...prev, ...fields };
  delete next.image_urls;
  if (fields.product_name !== undefined && !fields.product_name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Gallery: kept URLs (in the owner's order) followed by new uploads.
  if (fields.image_urls !== undefined || files.length) {
    const images = [...(fields.image_urls ?? (prev.images?.length ? prev.images : (prev.image_url ? [prev.image_url] : [])))];
    for (const f of files.slice(0, 8)) images.push(await uploadProductImage(client.id, f));
    next.images = images.slice(0, 12);
    next.image_url = next.images[0] || "";
  }

  let analyzeError = null;
  const primaryChanged = (next.image_url || "") !== (prev.image_url || "");
  if (primaryChanged) {
    const r = await describeImage(next.image_url, client);
    next.visual = r.visual; analyzeError = r.analyzeError;
  }
  next.updated_at = new Date().toISOString();

  const searchKeys = ["product_code", "product_name", "category", "brand", "tags", "description", "options", "visual"];
  const reembed = primaryChanged || searchKeys.some(k => JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null));
  const patch = { metadata: next };
  if (reembed) Object.assign(patch, await embedProduct(next));

  const { error } = await supabase.from("products").update(patch).eq("id", id).eq("client_id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, product: { id, ...next }, reembedded: reembed, analyzeError });
}, "products");

// Delete one product ({id}) or several ({ids:[...]}) — always scoped to the
// signed-in client at the database.
export const DELETE = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : (body.id ? [String(body.id)] : []);
  if (!ids.length) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("products").delete().in("id", ids.slice(0, 500)).eq("client_id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "deleted", count: ids.length });
}, "products");
