export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { generateEmbedding, extractProductsFromUrl } from "@/lib/gemini.js";
import { embedMeter } from "@/lib/usage.js";
import { checkProductQuota, checkScrapeQuota } from "@/lib/plan-limits.js";
import { getClientAI } from "@/lib/ai.js";

function visionPrompt(bType, unit) {
  return `You are an elite product cataloger for a ${bType || "business"}. Produce a precise, search-optimized description of the ${unit || "item"} for perfect semantic matching. First scan for a printed code or SKU; if present begin with: CODE: <exact code>. Ignore background, hands, packaging, watermarks and logos. Describe ONLY the ${unit || "item"}: exact type and subtype, colors, material and finish, shape, patterns, components, size cues and unique features. One dense technical paragraph, no preamble.`;
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Each import runs AI calls — cap the burst rate per account.
    const rl = rateLimit(`import-url:${client.id}`, 20, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You have imported many products recently. Please wait a few minutes.");
    const bType = client.business_type || "ecommerce";
    const unit = client.item_label || "product";
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

    // Two package gates: room for another product, and website imports left
    // this month. Scraping a page is the single most expensive AI call we make,
    // so it is checked before we fetch anything.
    const pq = await checkProductQuota(client);
    if (!pq.ok) return NextResponse.json({ error: pq.message }, { status: 403 });
    const sq = await checkScrapeQuota(client);
    if (!sq.ok) return NextResponse.json({ error: sq.message }, { status: 403 });

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 502 });
    const html = await res.text();

    let list;
    try { list = await extractProductsFromUrl(html, url, embedMeter(client.id)); } catch { return NextResponse.json({ error: "could not extract product" }, { status: 502 }); }
    const p = Array.isArray(list) ? list[0] : list;
    if (!p?.name) return NextResponse.json({ error: "no product found" }, { status: 404 });

    const image_url = p.images?.[0]?.src || "";
    let visual = "";
    if (image_url) { try { const ai = await getClientAI(client.id); visual = await ai.visionUrl(image_url, visionPrompt(bType, unit)); } catch {} }

    const codeMatch = visual.match(/CODE:\s*([A-Za-z0-9\s-]+)/i);
    const product_code = (codeMatch ? codeMatch[1].trim() : "") || `URL-${Date.now()}`;
    const content = `Product Code: ${product_code}\nName: ${p.name}\n${visual || p.description || ""}`;
    const embedding = await generateEmbedding(content, embedMeter(client.id));

    const metadata = {
      client_id: String(client.id),
      product_code,
      product_name: p.name,
      category: p.categories?.[0]?.name || "",
      regular_price: String(p.regular_price || ""),
      sale_price: String(p.sale_price || ""),
      stock_status: p.stock_status || "instock",
      image_url,
      // Gallery + vision text, so the Inventory editor can show every photo
      // and re-embed on edit without another vision call.
      images: (p.images || []).map(i => i?.src).filter(Boolean).slice(0, 12),
      visual,
      description: String(p.description || "").replace(/<[^>]*>/g, " ").trim(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, name: p.name });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
