export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";

// Fetch a shop's product list from the platform it already runs on, and hand it
// back in ONE shape. Nothing is saved here: every product then goes through
// /api/import-one one at a time, exactly as a CSV row does, so an imported
// product is described, embedded and deduplicated by the same code as a typed
// one. There is no second way into the catalogue.
//
// Two platforms, and the shape of the code says how a third would be added: a
// fetcher that pages through their API and a mapper that turns their product
// into ours. Nothing else in the app knows which platform a product came from.

// A tag becomes a space, because "one<br>two" is two words and "onetwo" is not
// a word at all. That leaves a space in front of the punctuation that followed
// the tag — "heavy <b>cotton</b>, oversized" came out as "cotton , oversized" —
// so the space is taken back off again. It is read out to customers.
const strip = (s) => String(s || "")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .replace(/\s+([,.;:!?)\]])/g, "$1")
  .trim();
const money = (v) => { const s = String(v ?? "").trim(); return s && Number(s) > 0 ? s : ""; };

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json();
    // Defaults to WooCommerce so a caller that predates the second platform
    // keeps working unchanged.
    const platform = String(body.platform || "woo").toLowerCase();

    if (platform === "shopify") return NextResponse.json(await shopify(body));
    return NextResponse.json(await woo(body));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── WooCommerce ──────────────────────────────────────────────────────────────
// Keys are made in WooCommerce → Settings → Advanced → REST API, read-only.
async function woo({ siteUrl, ck, cs }) {
  if (!siteUrl || !ck || !cs) return { error: "missing fields" };
  const base = String(siteUrl).replace(/\/$/, "");
  const items = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${base}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish&consumer_key=${ck}&consumer_secret=${cs}`);
    if (!r.ok) {
      const t = await r.text();
      return { error: `WooCommerce error ${r.status}: ${t.slice(0, 120)}` };
    }
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) break;
    items.push(...data);
    if (data.length < 100) break;
  }

  const products = items.filter((p) => p && p.name).map((p) => ({
    product_id: p.id,
    product_code: p.sku || `WC-${p.id}`,
    product_name: p.name,
    category: p.categories?.[0]?.name || "",
    regular_price: String(p.regular_price || ""),
    sale_price: String(p.sale_price || ""),
    stock_status: p.stock_status || "instock",
    // WooCommerce hands over every photo of a product and only the first was
    // being kept, so a shirt listed with a front, a back and a detail shot
    // arrived here with one picture and the other two were dropped on the
    // floor. The gallery travels now; image_url stays as the first of them
    // because that is the one the bot shows.
    images: (p.images || []).map((i) => i?.src).filter(Boolean).slice(0, 12),
    image_url: p.images?.[0]?.src || "",
    description: strip(p.description || p.short_description),
  }));
  return { ok: true, products };
}

// ── Shopify ──────────────────────────────────────────────────────────────────
// A custom app in the Shopify admin gives an Admin API access token
// (shpat_…) with read_products. The shop is addressed by its permanent
// myshopify.com domain, whatever the customer-facing domain happens to be.
//
// Paged with since_id rather than the Link header: cursor pagination arrives as
// a header we would have to parse and follow, and since_id needs neither — the
// last id of one page is where the next one starts, and it cannot loop.
async function shopify({ shop, token }) {
  const host = shopDomain(shop);
  if (!host || !token) return { error: "missing fields" };

  const items = [];
  let sinceId = 0;
  for (let page = 0; page < 5; page++) {
    const url = `https://${host}/admin/api/2024-10/products.json?limit=250&since_id=${sinceId}`;
    const r = await fetch(url, { headers: { "X-Shopify-Access-Token": String(token), "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      // The two that actually happen, said in words the owner can act on.
      if (r.status === 401 || r.status === 403) return { error: "Shopify refused the token. Check that it is an Admin API access token with read_products, and that it was copied whole." };
      if (r.status === 404) return { error: `Shopify has no shop at ${host}. Use the myshopify.com address, not your own domain.` };
      return { error: `Shopify error ${r.status}: ${t.slice(0, 120)}` };
    }
    const data = await r.json();
    const list = Array.isArray(data?.products) ? data.products : [];
    if (!list.length) break;
    items.push(...list);
    sinceId = list[list.length - 1]?.id || 0;
    if (list.length < 250 || !sinceId) break;
  }

  return { ok: true, products: items.filter((p) => p && p.title).map(mapShopify) };
}

// "shop.myshopify.com", however the owner typed it — with https://, with a
// trailing slash, with /admin on the end, or as the bare name.
export function shopDomain(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return "";
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : "";
}

// One Shopify product, in our shape.
//
// Shopify has no single price: every variant carries its own, and
// compare_at_price is the "was" figure shown struck through. So the cheapest
// variant's price is what the bot quotes, and a compare_at above it means the
// pair is a sale price and a regular price — the wrong way round from how
// Shopify stores it, and quoting them the wrong way round would advertise a
// discount that does not exist.
export function mapShopify(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const cheapest = variants.slice().sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0))[0] || {};
  const price = money(cheapest.price);
  const wasPrice = money(cheapest.compare_at_price);
  const onSale = wasPrice && price && Number(wasPrice) > Number(price);

  // In stock when ANY variant has stock, or when Shopify is not tracking it —
  // an untracked variant is one the shop sells without counting, not one it
  // has run out of.
  const inStock = variants.some((v) => !v?.inventory_management || Number(v?.inventory_quantity ?? 0) > 0);

  return {
    product_id: p.id,
    product_code: cheapest.sku || `SH-${p.id}`,
    product_name: p.title,
    category: p.product_type || "",
    brand: p.vendor || "",
    regular_price: onSale ? wasPrice : price,
    sale_price: onSale ? price : "",
    stock_status: inStock ? "instock" : "outofstock",
    images: (p.images || []).map((i) => i?.src).filter(Boolean).slice(0, 12),
    image_url: p.images?.[0]?.src || "",
    description: strip(p.body_html),
    // Shopify's own options are the same idea as ours — the axes a customer
    // picks along — except that a shop with none is given one called "Title"
    // holding the single value "Default Title". That is Shopify's placeholder
    // for "this product has no choices", and importing it would put a
    // meaningless size picker in front of every customer.
    options: (Array.isArray(p.options) ? p.options : [])
      .map((o) => ({ name: String(o?.name || "").trim(), values: (Array.isArray(o?.values) ? o.values : []).map((v) => String(v || "").trim()).filter(Boolean) }))
      .filter((o) => o.name && o.values.length && !(o.name.toLowerCase() === "title" && o.values.length === 1 && o.values[0].toLowerCase() === "default title"))
      .slice(0, 5),
  };
}
