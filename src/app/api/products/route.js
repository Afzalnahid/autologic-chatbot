export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { readProductForm, uploadProductImage, describeImages, embedProduct, resolveGallery, resolveVariantImages, claimedByVariants } from "@/lib/products.js";
import { findDuplicate, duplicateMessage, nameKey, codeKey, primaryPhotoKey } from "@/lib/duplicates.js";

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
// runs again only on photos that were not in the gallery before.
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

  // Renaming one product onto another's name leaves the bot with two rows it
  // cannot tell apart, exactly as adding it twice would. Only checked when the
  // name or code actually changed, and never against the row being edited.
  const renamed = fields.product_name !== undefined && nameKey(fields.product_name) !== nameKey(prev.product_name);
  const recoded = fields.product_code !== undefined && codeKey(fields.product_code) !== codeKey(prev.product_code);
  if ((renamed || recoded) && String(form.get("allow_duplicate") || "") !== "1") {
    const dup = await findDuplicate(client.id, {
      name: renamed ? fields.product_name : "", code: recoded ? fields.product_code : "", excludeId: id,
    });
    if (dup) return NextResponse.json({ error: duplicateMessage(dup, client.item_label || "product"), duplicate: dup }, { status: 409 });
  }

  // Gallery in the owner's order; "upload:N" placeholders become the new files.
  // Variants use the same placeholders for their own photo, so both are
  // resolved from the same upload list — and the ones a variant claimed are
  // kept out of the gallery.
  if (fields.image_urls !== undefined || files.length) {
    const uploaded = [];
    for (const f of files.slice(0, 32)) uploaded.push(await uploadProductImage(client.id, f));
    if (next.variants) next.variants = resolveVariantImages(next.variants, uploaded);
    const order = fields.image_urls ?? (prev.images?.length ? prev.images : (prev.image_url ? [prev.image_url] : []));
    next.images = resolveGallery(order, uploaded, claimedByVariants(fields.variants || []));
    next.image_url = next.images[0] || "";
  } else if (next.variants) {
    // No files this time, but a variant may still be pointing at a placeholder
    // from a half-finished save. Never store "upload:2" as a picture URL.
    next.variants = resolveVariantImages(next.variants, []);
  }

  // A new FILE becoming the primary photo gives a fingerprint of its bytes, so
  // the next add can recognise the same picture. Merely reordering photos that
  // are already saved does not: by then only their addresses are left, and
  // writing an address fingerprint over a byte one would make the same photo
  // look like two different ones. In that case the old key stands.
  if (files.length) {
    const key = await primaryPhotoKey(fields.image_urls, files);
    if (key.startsWith("b:")) next.photo_key = key;
  }

  // Every photo's description, carried across the edit.
  //
  // A picture that is still in the gallery keeps the words it already had:
  // re-reading a photograph nothing has happened to is a vision call spent on
  // an answer we are already holding, and reordering the gallery is not a
  // change to any photograph in it. Only pictures that were not here before are
  // read — and they are read whether or not they are the primary one, which is
  // the fix: adding a photo of the back of a shirt to a product that already
  // existed now teaches the catalogue what its back looks like.
  //
  // `prev.visuals` may be absent on every product saved before this existed. In
  // that case only the primary's description is known, which is exactly what
  // those rows have always had, and the rest are read on the next edit that
  // touches the gallery.
  let analyzeError = null;
  const primaryChanged = (next.image_url || "") !== (prev.image_url || "");
  const galleryChanged = JSON.stringify(prev.images || []) !== JSON.stringify(next.images || []);
  if (primaryChanged || galleryChanged) {
    const known = new Map();
    (prev.images || []).forEach((u, i) => {
      const v = (prev.visuals || [])[i] || (i === 0 ? prev.visual || "" : "");
      if (u && v) known.set(u, v);
    });
    const imgs = next.images?.length ? next.images : (next.image_url ? [next.image_url] : []);
    const unread = imgs.filter((u) => !known.has(u));
    if (unread.length) {
      const r = await describeImages(unread, client);
      unread.forEach((u, i) => { if (r.visuals[i]) known.set(u, r.visuals[i]); });
    }
    next.visuals = imgs.map((u) => known.get(u) || "");
    next.visual = next.visuals[0] || "";
    // Said only about the photo the bot shows and matches on first. A close-up
    // that could not be read costs that close-up; a primary that could not be
    // read is the one the owner needs to know about.
    if (imgs.length && !next.visual) analyzeError = "the photo could not be read";
  }
  next.updated_at = new Date().toISOString();

  const searchKeys = ["product_code", "product_name", "category", "brand", "tags", "description", "options", "visual", "visuals"];
  const reembed = primaryChanged || searchKeys.some(k => JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null));
  const patch = { metadata: next };
  if (reembed) Object.assign(patch, await embedProduct(next, client.id));

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
