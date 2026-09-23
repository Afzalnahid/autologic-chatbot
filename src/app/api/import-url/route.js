export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { extractProductsFromPage } from "@/lib/scrape-products.js";
import { checkProductQuota, checkScrapeQuota, featureGate } from "@/lib/plan-limits.js";
import { getClientAI } from "@/lib/ai.js";
// One wording for every photo, here and at message time. See products.js.
import { visionPrompt, buildContent, describeImages } from "@/lib/products.js";
import { findDuplicate, duplicateMessage, urlKey } from "@/lib/duplicates.js";
import { missingToSell, missingMessage } from "@/lib/readiness.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Each import runs AI calls — cap the burst rate per account.
    const rl = rateLimit(`import-url:${client.id}`, 20, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You have imported many products recently. Please wait a few minutes.");
    const bType = client.business_type || "ecommerce";
    const unit = client.item_label || "product";
    const body = await request.json();
    const url = body?.url;
    if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

    // Two package gates: room for another product, and website imports left
    // this month. Scraping a page is the single most expensive AI call we make,
    // so it is checked before we fetch anything.
    // Package gate — see FEATURE_DEFS in src/lib/features.js.
    const gate = await featureGate(client, "website_import");
    if (!gate.ok) return NextResponse.json({ error: gate.message, feature: "website_import" }, { status: 403 });
    const pq = await checkProductQuota(client);
    if (!pq.ok) return NextResponse.json({ error: pq.message }, { status: 403 });
    const sq = await checkScrapeQuota(client);
    if (!sq.ok) return NextResponse.json({ error: sq.message }, { status: 403 });

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 502 });
    const html = await res.text();

    let list;
    // Whichever provider this client runs on — their own key or the
    // platform’s. Metered under "scrape" by getClientAI, like every other call.
    try {
      const scrapeAI = await getClientAI(client.id, "product.scrape");
      list = await extractProductsFromPage(scrapeAI.chat, html, url);
    } catch { return NextResponse.json({ error: "could not extract product" }, { status: 502 }); }
    const p = Array.isArray(list) ? list[0] : list;
    if (!p?.name) return NextResponse.json({ error: "no product found" }, { status: 404 });

    const image_url = p.images?.[0]?.src || "";

    // This route wrote a product straight into the catalogue without ever
    // asking whether it was already there, so pasting the same link twice made
    // two rows — and two rows the bot cannot tell apart is exactly what it
    // answers wrongly from. Checked here, after the scrape (which is what tells
    // us the name) but before vision and the embedding, so a refusal costs
    // nothing more.
    if (!body.allow_duplicate) {
      const dup = await findDuplicate(client.id, { name: p.name, photoKey: urlKey(image_url) });
      if (dup) return NextResponse.json({ error: duplicateMessage(dup, unit), duplicate: dup }, { status: 409 });
    }

    let visual = "";
    let analyzeError = null;
    if (image_url) {
      try { const ai = await getClientAI(client.id, "product"); visual = await ai.visionUrl(image_url, visionPrompt(bType, unit)); }
      // Swallowed in silence before, so a product whose photo could not be read
      // reported a clean success — and stayed invisible to a photo search,
      // possibly for months, with nothing said.
      catch (e) { analyzeError = e.message; }
    }

    const codeMatch = visual.match(/CODE:\s*([A-Za-z0-9\s-]+)/i);
    const product_code = (codeMatch ? codeMatch[1].trim() : "") || `URL-${Date.now()}`;

    // The same rule as every other door. A page that gave us no price or no
    // picture produces a product the bot cannot show, so it is refused with
    // the reason rather than saved as something half-there.
    const missing = missingToSell({ product_name: p.name, regular_price: p.regular_price, sale_price: p.sale_price, image_url });
    if (missing.length && !body.allow_incomplete) {
      return NextResponse.json({ error: `${missingMessage(missing, unit)} The page did not give us ${missing.length > 1 ? "them" : "it"}.`, incomplete: missing }, { status: 400 });
    }

    const images = (p.images || []).map(i => i?.src).filter(Boolean).slice(0, 12);
    // Every other picture on the page, read together. A product page's second
    // and third photographs are the same thing from another angle — the angle
    // a customer is as likely to photograph as the first — and the catalogue
    // knew none of them. Read in parallel under a deadline, and unable to fail
    // the import: see describeImages().
    const visuals = images.length > 1
      ? [visual, ...(await describeImages(images.slice(1), client)).visuals]
      : [visual];

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
      images,
      visual, visuals,
      description: String(p.description || "").replace(/<[^>]*>/g, " ").trim(),
      // Lets the next import recognise the same picture. See duplicates.js.
      photo_key: urlKey(image_url),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    // The same text the drawer embeds, built from the same function. This route
    // had its own thinner version that left out the category, so an imported
    // product was quietly harder to find than a typed one.
    const content = buildContent(metadata);
    const embedding = await (await getClientAI(client.id, "product")).embed(content);

    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, name: p.name, analyzed: !!visual, analyzeError });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
