export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { readProductForm, uploadProductImage, describeImage, embedProduct, resolveGallery } from "@/lib/products.js";
import { checkProductQuota } from "@/lib/plan-limits.js";

// Create one product from the Inventory tab. Multipart form: the fields in
// readProductForm(), plus `images` (several files) — the first image is the
// primary one the bot shows. Vision describes the primary image so a customer
// photo can be matched to it later.
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

    const { fields, files } = readProductForm(await request.formData());
    if (!fields.product_name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const uploaded = [];
    for (const f of files.slice(0, 8)) uploaded.push(await uploadProductImage(client.id, f));
    const images = resolveGallery(fields.image_urls || [], uploaded);
    const image_url = images[0] || "";

    const { visual, analyzeError } = await describeImage(image_url, client);
    const code = fields.product_code || (visual.match(/CODE:\s*([A-Za-z0-9\s-]+)/i)?.[1]?.trim()) || `M-${Date.now()}`;

    const now = new Date().toISOString();
    const metadata = {
      client_id: String(client.id),
      product_code: code, product_name: fields.product_name,
      category: fields.category || "", brand: fields.brand || "", tags: fields.tags || [],
      regular_price: fields.regular_price || "", sale_price: fields.sale_price || "",
      stock_status: fields.stock_status || "instock", stock_qty: fields.stock_qty ?? null,
      image_url, images, visual, description: fields.description || "",
      options: fields.options || [], variants: fields.variants || [],
      created_at: now, updated_at: now,
    };
    const { content, embedding } = await embedProduct(metadata);
    const { data, error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id, image_url, analyzed: !!visual, analyzeError });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
