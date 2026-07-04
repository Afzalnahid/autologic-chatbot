export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { siteUrl, ck, cs } = await request.json();
    if (!siteUrl || !ck || !cs) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const base = siteUrl.replace(/\/$/, "");
    const items = [];
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(`${base}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish&consumer_key=${ck}&consumer_secret=${cs}`);
      if (!r.ok) {
        const t = await r.text();
        return NextResponse.json({ error: `WooCommerce error ${r.status}: ${t.slice(0, 120)}` }, { status: 502 });
      }
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) break;
      items.push(...data);
      if (data.length < 100) break;
    }

    const strip = s => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const products = items.filter(p => p && p.name).map(p => ({
      product_id: p.id,
      product_code: p.sku || `WC-${p.id}`,
      product_name: p.name,
      category: (p.categories?.[0]?.name) || "",
      regular_price: String(p.regular_price || ""),
      sale_price: String(p.sale_price || ""),
      stock_status: p.stock_status || "instock",
      image_url: (p.images?.[0]?.src) || "",
      description: strip(p.description || p.short_description),
    }));

    return NextResponse.json({ ok: true, products });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
