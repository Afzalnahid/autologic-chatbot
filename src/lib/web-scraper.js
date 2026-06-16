import * as cheerio from "cheerio";
import { extractProductsFromUrl } from "./gemini.js";

export async function scrapeProducts(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header").remove();
  const cleanHtml = $.html();

  const products = await extractProductsFromUrl(cleanHtml, url);

  return products.map(p => ({
    id: p.id || String(Math.floor(100000 + Math.random() * 900000)),
    name: p.name || "",
    categories: Array.isArray(p.categories) ? p.categories : [{ name: "Uncategorized" }],
    regular_price: Number(p.regular_price) || 0,
    sale_price: Number(p.sale_price) || 0,
    stock_status: p.stock_status || "instock",
    description: p.description || "",
    images: Array.isArray(p.images) ? p.images : [{ src: "N/A" }],
  }));
}
