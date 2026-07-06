export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding } from "@/lib/gemini.js";

function visionPrompt(bType, unit) {
  return `You are an elite product cataloger for a ${bType || "business"}. Task: produce a precise, search-optimized description of the ${unit || "item"} so a semantic search can match it perfectly.

Step 1: Scan for any printed code, SKU or model number. If present, begin the output with: CODE: <exact code>
Step 2: Ignore all background, hands, gloves, packaging, boxes, watermarks and logos. Describe ONLY the ${unit || "item"} itself.
Capture with precision: exact type and subtype, primary and secondary colors, material and finish, shape and silhouette, patterns or motifs, notable components or parts, size cues, and any unique distinguishing features.
Output one dense technical paragraph. No preamble, no marketing language.`;
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const bType = client.business_type || "ecommerce";
    const unit = client.item_label || "product";
    const form = await request.formData();
    const product_code = form.get("product_code") || "";
    const product_name = form.get("product_name") || "";
    const category = form.get("category") || "";
    const regular_price = form.get("regular_price") || "";
    const sale_price = form.get("sale_price") || "";
    const description = form.get("description") || "";
    const file = form.get("image");
    if (!product_name) return NextResponse.json({ error: "name required" }, { status: 400 });

    let image_url = form.get("image_url") || "";
    if (file && typeof file !== "string") {
      const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
      const path = `${client.id}/${Date.now()}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, buf, {
        contentType: file.type || "image/jpeg", upsert: false,
      });
      if (upErr) return NextResponse.json({ error: "upload failed: " + upErr.message }, { status: 500 });
      image_url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }

    let visual = "";
    let analyzeError = null;
    if (image_url) {
      try { visual = await analyzeImage(image_url, visionPrompt(bType, unit)); }
      catch (e) { analyzeError = e.message; }
    }

    const code = product_code || (visual.match(/CODE:\s*([A-Za-z0-9\s-]+)/i)?.[1]?.trim()) || `M-${Date.now()}`;
    const content = `Product Code: ${code}\nName: ${product_name}\n${visual || description || ""}`;
    const embedding = await generateEmbedding(content);

    const metadata = {
      client_id: String(client.id), product_code: code, product_name,
      category, regular_price: String(regular_price), sale_price: String(sale_price),
      stock_status: "instock", image_url, description,
    };
    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, image_url, analyzed: !!visual, analyzeError });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
