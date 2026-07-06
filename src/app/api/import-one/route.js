export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding } from "@/lib/gemini.js";

function visionPrompt(bType, unit) {
  return `You are an expert product cataloger for a ${bType || "business"}. First scan for a visible ${unit || "item"} code or SKU. If found, start with: CODE: <code>. Then ignore background, hands, packaging and logos and describe ONLY the ${unit || "item"}: type, color, material, shape, distinguishing features. One dense technical paragraph.`;
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const bType = client.business_type || "ecommerce";
    const unit = client.item_label || "product";
    const p = await request.json();
    if (!p?.product_name) return NextResponse.json({ error: "missing product" }, { status: 400 });

    let visual = "";
    if (p.image_url) {
      try { visual = await analyzeImage(p.image_url, VISION_PROMPT); } catch {}
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
      description: p.description || "",
    };

    const { data: existing } = await supabase.from("products").select("id,metadata,client_id").limit(1000);
    const dupIds = (existing || []).filter(r => r.client_id === client.id && r.metadata?.product_code === p.product_code).map(r => r.id);
    for (const id of dupIds) await supabase.from("products").delete().eq("id", id);
    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, analyzed: !!visual });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
