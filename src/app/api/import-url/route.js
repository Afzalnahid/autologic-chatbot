export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding, extractProductsFromUrl } from "@/lib/gemini.js";

function visionPrompt(bType, unit) {
  return `You are an expert product cataloger for a ${bType || "business"}. First scan for a visible ${unit || "item"} code or SKU. If found, start with: CODE: <code>. Then ignore background, hands, packaging and logos and describe ONLY the ${unit || "item"}: type, color, material, shape, distinguishing features. One dense technical paragraph.`;
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const bType = client.business_type || "ecommerce";
    const unit = client.item_label || "product";
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 502 });
    const html = await res.text();

    let list;
    try { list = await extractProductsFromUrl(html, url); } catch { return NextResponse.json({ error: "could not extract product" }, { status: 502 }); }
    const p = Array.isArray(list) ? list[0] : list;
    if (!p?.name) return NextResponse.json({ error: "no product found" }, { status: 404 });

    const image_url = p.images?.[0]?.src || "";
    let visual = "";
    if (image_url) { try { visual = await analyzeImage(image_url, visionPrompt(bType, unit)); } catch {} }

    const codeMatch = visual.match(/CODE:\s*([A-Za-z0-9\s-]+)/i);
    const product_code = (codeMatch ? codeMatch[1].trim() : "") || `URL-${Date.now()}`;
    const content = `Product Code: ${product_code}\nName: ${p.name}\n${visual || p.description || ""}`;
    const embedding = await generateEmbedding(content);

    const metadata = {
      client_id: String(client.id),
      product_code,
      product_name: p.name,
      category: p.categories?.[0]?.name || "",
      regular_price: String(p.regular_price || ""),
      sale_price: String(p.sale_price || ""),
      stock_status: p.stock_status || "instock",
      image_url,
      description: String(p.description || "").replace(/<[^>]*>/g, " ").trim(),
    };

    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, name: p.name });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
