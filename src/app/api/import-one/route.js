export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding } from "@/lib/gemini.js";

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
    const p = await request.json();
    if (!p?.product_name) return NextResponse.json({ error: "missing product" }, { status: 400 });

    let visual = "";
    if (p.image_url) {
      try { visual = await analyzeImage(p.image_url, visionPrompt(bType, unit)); } catch {}
    }
    const content = `Product Code: ${p.product_code}\nName: ${p.product_name}\n${visual || p.description || ""}`;
    const embedding = await generateEmbedding(content);

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
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase.from("products").select("id,metadata,client_id").eq("client_id", client.id).limit(1000);
    const dupIds = (existing || []).filter(r => r.metadata?.product_code === p.product_code).map(r => r.id);
    for (const id of dupIds) await supabase.from("products").delete().eq("id", id);
    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, analyzed: !!visual });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
