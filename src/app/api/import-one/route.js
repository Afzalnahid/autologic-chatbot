export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { checkProductQuota } from "@/lib/plan-limits.js";
import { getClientAI } from "@/lib/ai.js";
// One wording for every photo, here and at message time. See products.js.
import { visionPrompt, buildContent, describeImages, normalizeOptions } from "@/lib/products.js";
import { buildVariants } from "@/lib/variants.js";
import { findDuplicate, findByCode, duplicateMessage, urlKey } from "@/lib/duplicates.js";
import { missingToSell, missingMessage } from "@/lib/readiness.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Each import runs AI calls — cap the burst rate per account.
    const rl = rateLimit(`import-one:${client.id}`, 60, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You have imported many products recently. Please wait a few minutes.");
    const bType = client.business_type || "ecommerce";
    const unit = client.item_label || "product";
    const q = await checkProductQuota(client);
    if (!q.ok) return NextResponse.json({ error: q.message }, { status: 403 });

    const p = await request.json();
    if (!p?.product_name) return NextResponse.json({ error: "missing product" }, { status: 400 });

    // Every picture the source had of this product, in its own order. Callers
    // that only know about one still work: a bare image_url becomes a gallery
    // of one. Only real http links — vision fetches these.
    const gallery = (Array.isArray(p.images) && p.images.length ? p.images : [p.image_url])
      .map((u) => String(u || "").trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .filter((u, i, a) => a.indexOf(u) === i)
      .slice(0, 12);
    const primary = gallery[0] || "";

    // Same rule as every other door: a product the bot cannot show should not
    // be created. An import is the one place where holding to it blindly would
    // hurt — a WooCommerce shop with sixty photoless products would lose them
    // all — so the importer can be told to bring them anyway, and the sheet
    // makes that a visible choice rather than a silent default.
    const missing = missingToSell({ product_name: p.product_name, regular_price: p.regular_price, sale_price: p.sale_price, image_url: primary });
    if (missing.length && !p.allow_incomplete) {
      return NextResponse.json({ ok: true, skipped: true, incomplete: missing, reason: missingMessage(missing, unit) });
    }

    // Decided before the AI is touched, so a row that will not be kept costs
    // the client nothing.
    //
    // A code that is already here means the same shop is being imported again:
    // that is an UPDATE, so the old rows go and this one takes their place. A
    // matching name or a matching picture with no code match is a different
    // story — it is the same thing arriving twice, and the importer skips it
    // and says so rather than stopping a run of two hundred products.
    const replacing = await findByCode(client.id, p.product_code);
    if (!replacing.length) {
      const dup = await findDuplicate(client.id, { name: p.product_name, photoKey: urlKey(primary) });
      if (dup) return NextResponse.json({ ok: true, skipped: true, duplicate: dup, reason: duplicateMessage(dup, client.item_label || "product") });
    }

    let visual = "";
    let analyzeError = null;
    if (primary) {
      try {
        const ai = await getClientAI(client.id, "product");
        visual = await ai.visionUrl(primary, visionPrompt(bType, unit));
      } catch (e) {
        // Swallowed silently before, so a whole catalogue could import with
        // not one photo readable and the summary would still say "Imported 40".
        // The row is still saved — a product without a photo description is
        // worth more than no product — but the reason travels back now.
        analyzeError = e.message;
      }
    }
    // The rest of the gallery, read together. An imported product's other
    // pictures are the same thing from another angle, which is exactly what a
    // customer photographs — and until now the catalogue knew none of them.
    //
    // They are read in PARALLEL under a deadline, so a product with six
    // pictures costs about as long as one with two; it is the token bill that
    // grows with the gallery, not the wait. Nothing here can fail the import:
    // whatever came back is used and the rest are simply not known.
    const visuals = gallery.length > 1
      ? [visual, ...(await describeImages(gallery.slice(1), client)).visuals]
      : [visual];
    // The choices a customer picks between, when the source knows them —
    // Shopify hands over its own options, and they mean the same thing as ours.
    // Dropping them made an imported shirt a single row where the shop sells
    // four sizes, and the bot could not offer a size it had never been told
    // about. The combinations are built from the same function the drawer uses,
    // so an imported product and a typed one are the same shape.
    const options = normalizeOptions(p.options);
    const metadata = {
      client_id: String(client.id),
      product_id: p.product_id,
      product_code: p.product_code,
      product_name: p.product_name,
      category: p.category || "",
      brand: p.brand || "",
      regular_price: p.regular_price || "",
      sale_price: p.sale_price || "",
      stock_status: p.stock_status || "instock",
      options,
      variants: options.length ? buildVariants(options, { regular_price: p.regular_price || "", sale_price: p.sale_price || "" }) : [],
      // A product can have several pictures and every source can supply them:
      // a CSV cell with more than one link, a WooCommerce gallery. Only one was
      // ever stored, so the rest were lost at the door. The first is the one
      // the bot shows and the one vision reads, exactly as before.
      images: gallery,
      image_url: gallery[0] || "",
      visual, visuals,
      description: p.description || "",
      // Lets the next import recognise the same picture. See duplicates.js.
      photo_key: urlKey(primary),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    // The same text the drawer embeds, built from the same function. This route
    // had its own thinner version that left the category out, so an imported
    // product was quietly harder for a customer to find than a typed one —
    // "something for winter" matched the typed row and not the imported one.
    const content = buildContent(metadata);
    const embedding = await (await getClientAI(client.id, "product")).embed(content);

    // The rows this one replaces, found before any AI ran.
    for (const id of replacing) await supabase.from("products").delete().eq("id", id).eq("client_id", client.id);
    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, analyzed: !!visual, analyzeError });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
