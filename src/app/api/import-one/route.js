export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { generateEmbedding } from "@/lib/gemini.js";
import { embedMeter } from "@/lib/usage.js";
import { checkProductQuota } from "@/lib/plan-limits.js";
import { getClientAI } from "@/lib/ai.js";
import { findDuplicate, findByCode, duplicateMessage, urlKey } from "@/lib/duplicates.js";

function visionPrompt(bType, unit) {
  return `You are an elite product cataloger for a ${bType || "business"}. Produce a precise, search-optimized description of the ${unit || "item"} for perfect semantic matching. First scan for a printed code or SKU; if present begin with: CODE: <exact code>. Ignore background, hands, packaging, watermarks and logos. Describe ONLY the ${unit || "item"}: exact type and subtype, colors, material and finish, shape, patterns, components, size cues and unique features. One dense technical paragraph, no preamble.`;
}

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
      const dup = await findDuplicate(client.id, { name: p.product_name, photoKey: urlKey(p.image_url) });
      if (dup) return NextResponse.json({ ok: true, skipped: true, duplicate: dup, reason: duplicateMessage(dup, client.item_label || "product") });
    }

    let visual = "";
    let analyzeError = null;
    if (p.image_url) {
      try {
        const ai = await getClientAI(client.id, "product");
        visual = await ai.visionUrl(p.image_url, visionPrompt(bType, unit));
      } catch (e) {
        // Swallowed silently before, so a whole catalogue could import with
        // not one photo readable and the summary would still say "Imported 40".
        // The row is still saved — a product without a photo description is
        // worth more than no product — but the reason travels back now.
        analyzeError = e.message;
      }
    }
    const content = `Product Code: ${p.product_code}\nName: ${p.product_name}\n${visual || p.description || ""}`;
    const embedding = await (await getClientAI(client.id, "product")).embed(content);

    const metadata = {
      client_id: String(client.id),
      product_id: p.product_id,
      product_code: p.product_code,
      product_name: p.product_name,
      category: p.category || "",
      regular_price: p.regular_price || "",
      sale_price: p.sale_price || "",
      stock_status: p.stock_status || "instock",
      image_url: p.image_url || "",
      images: p.image_url ? [p.image_url] : [],
      visual,
      description: p.description || "",
      // Lets the next import recognise the same picture. See duplicates.js.
      photo_key: urlKey(p.image_url),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    // The rows this one replaces, found before any AI ran.
    for (const id of replacing) await supabase.from("products").delete().eq("id", id).eq("client_id", client.id);
    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, analyzed: !!visual, analyzeError });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
