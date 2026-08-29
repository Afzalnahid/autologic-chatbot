export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { readProductForm, uploadProductImage, describeImage, describeImages, embedProduct, resolveGallery, resolveVariantImages, claimedByVariants } from "@/lib/products.js";
import { checkProductQuota } from "@/lib/plan-limits.js";
import { findDuplicate, duplicateMessage, primaryPhotoKey } from "@/lib/duplicates.js";
import { missingOnForm, missingMessage } from "@/lib/readiness.js";

// Create one product from the Inventory tab. Multipart form: the fields in
// readProductForm(), plus `images` (several files) — the first image is the
// primary one the bot shows. Vision describes EVERY image, so a customer photo
// can be matched to it later whichever side of the thing they photographed.
export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Each import runs AI calls — cap the burst rate per account.
    const rl = rateLimit(`add-product:${client.id}`, 60, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are adding products very quickly. Please wait a moment.");

    // The package's product allowance. Checked before any AI call so a client
    // over their limit is told plainly instead of being charged for work that
    // is then thrown away.
    const q = await checkProductQuota(client);
    if (!q.ok) return NextResponse.json({ error: q.message }, { status: 403 });

    const form = await request.formData();
    const { fields, files } = readProductForm(form);

    // A name, a price and a photo, before anything is uploaded or read. The
    // owner's rule: a product they add is one the bot can actually show, and
    // each of these fails invisibly — no price and it cannot answer the first
    // question a customer asks; no photo and it cannot be found by picture at
    // all. Enforced only here, at creation. The edit route deliberately does
    // NOT enforce it, because editing is how an older incomplete product gets
    // fixed and refusing the save would trap it.
    const hasPhoto = files.length > 0 || (fields.image_urls || []).some((u) => /^https?:\/\//.test(u));
    const missing = missingOnForm(fields, hasPhoto);
    if (missing.length) {
      return NextResponse.json(
        { error: missingMessage(missing, client.item_label || "product"), missing },
        { status: 400 },
      );
    }

    // Asked before anything is uploaded, described or embedded: a duplicate
    // that is going to be refused should not cost the client an AI call or
    // leave a photo behind in the bucket. `allow_duplicate` is what the owner
    // presses when they have read the warning and meant it anyway.
    const photoKey = await primaryPhotoKey(fields.image_urls, files);
    if (String(form.get("allow_duplicate") || "") !== "1") {
      const dup = await findDuplicate(client.id, { name: fields.product_name, code: fields.product_code, photoKey });
      if (dup) return NextResponse.json({ error: duplicateMessage(dup, client.item_label || "product"), duplicate: dup }, { status: 409 });
    }

    // 8 was enough when every photo went into the gallery. A variant can now
    // carry its own picture, so a shirt in twelve colours sends more files than
    // that in one save. The real limit is the request size, which the platform
    // enforces and the browser now stays under by resizing first; this cap is
    // only here so a malformed request cannot ask for unbounded work.
    const uploaded = [];
    for (const f of files.slice(0, 32)) uploaded.push(await uploadProductImage(client.id, f));
    const variants = resolveVariantImages(fields.variants || [], uploaded);
    const images = resolveGallery(fields.image_urls || [], uploaded, claimedByVariants(fields.variants || []));
    const image_url = images[0] || "";

    // A photo already read by /api/photo-draft arrives with its description, so
    // vision does not run twice on the same picture. Anything else is read here,
    // exactly as before.
    const { visual, analyzeError } = fields.visual
      ? { visual: fields.visual, analyzeError: null }
      : await describeImage(image_url, client);
    const code = fields.product_code || (visual.match(/CODE:\s*([A-Za-z0-9\s-]+)/i)?.[1]?.trim()) || `M-${Date.now()}`;

    // And now the REST of the gallery. Every photo gets read, not only the one
    // the bot shows — that was the whole gap. A shop photographs a shirt front,
    // back and close-up; the catalogue knew the front; a customer sent the back
    // and was told it could not be found.
    //
    // `visuals` lines up with `images`, one description per photo, so a later
    // edit can tell which picture each description belongs to and re-read only
    // what is actually new.
    //
    // Sent by the browser wherever the browser has already read them (the photo
    // sheet, the chat), so nothing is paid for twice. Read here otherwise, which
    // is how the importers get theirs — in parallel, under a deadline, and never
    // able to fail the save. See describeImages().
    const given = fields.visuals || [];
    const visuals = given.length
      ? images.map((_, i) => given[i] || (i === 0 ? visual : ""))
      : [visual, ...(images.length > 1 ? (await describeImages(images.slice(1), client)).visuals : [])];

    const now = new Date().toISOString();
    const metadata = {
      client_id: String(client.id),
      product_code: code, product_name: fields.product_name,
      category: fields.category || "", brand: fields.brand || "", tags: fields.tags || [],
      regular_price: fields.regular_price || "", sale_price: fields.sale_price || "",
      stock_status: fields.stock_status || "instock", stock_qty: fields.stock_qty ?? null,
      image_url, images, visual, visuals, description: fields.description || "",
      // Kept so the next add can tell it is the same picture. See duplicates.js.
      photo_key: photoKey,
      options: fields.options || [], variants,
      created_at: now, updated_at: now,
    };
    const { content, embedding } = await embedProduct(metadata);
    const { data, error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // `read` is how many of this product's photos a customer could send and be
    // matched on — the primary plus every other one that came back with words.
    // `read` is how many of this product's photos a customer could send and be
    // matched on.
    return NextResponse.json({ ok: true, id: data?.id, image_url, analyzed: !!visual, analyzeError, read: visuals.filter(Boolean).length, photos: images.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
