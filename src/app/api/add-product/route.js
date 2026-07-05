export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding } from "@/lib/gemini.js";

const VISION_PROMPT = `You are a Master Jeweler cataloger. First scan for a visible product code (like EV 101). If found, start with: CODE: <code>. Then ignore background, hands, gloves, boxes, logos and describe ONLY the jewelry: category, metal color and finish, motif, gemstone cuts and setting, band details. One dense technical paragraph.`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    if (image_url) { try { visual = await analyzeImage(image_url, VISION_PROMPT); } catch {} }

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
    return NextResponse.json({ ok: true, image_url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
