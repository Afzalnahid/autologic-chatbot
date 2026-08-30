import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { loadPure } from "./shim.mjs";

const { mapShopify, shopDomain } = await loadPure(__R("src/app/api/import-products/route.js"), "tmp-shopify.mjs");

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

// ── the shop address, however it was typed ─────────────────────────────────
is("bare name", shopDomain("nokshi"), "nokshi.myshopify.com");
is("full domain", shopDomain("nokshi.myshopify.com"), "nokshi.myshopify.com");
is("with https", shopDomain("https://nokshi.myshopify.com"), "nokshi.myshopify.com");
is("with a trailing slash", shopDomain("https://nokshi.myshopify.com/"), "nokshi.myshopify.com");
is("with /admin on the end", shopDomain("https://nokshi.myshopify.com/admin"), "nokshi.myshopify.com");
is("shouted", shopDomain("NOKSHI.MyShopify.com"), "nokshi.myshopify.com");
is("hyphenated", shopDomain("nokshi-dhaka"), "nokshi-dhaka.myshopify.com");
// The customer-facing domain is not where the API answers, and guessing would
// send the owner's token to somebody else's server.
is("their own domain is refused, not guessed at", shopDomain("https://nokshi.com.bd"), "");
is("empty is empty", shopDomain(""), "");
is("nonsense is empty", shopDomain("   "), "");

// ── one Shopify product, in our shape ──────────────────────────────────────
const shirt = {
  id: 991, title: "Box T-shirt", product_type: "T-shirts", vendor: "Nokshi",
  body_html: "<p>Heavy <b>cotton</b>, oversized</p>",
  images: [{ src: "https://cdn/front.jpg" }, { src: "https://cdn/back.jpg" }],
  options: [{ name: "Size", values: ["S", "M", "L"] }, { name: "Colour", values: ["Black"] }],
  variants: [
    { sku: "BOXT-M", price: "900.00", compare_at_price: "1200.00", inventory_quantity: 4, inventory_management: "shopify" },
    { sku: "BOXT-L", price: "950.00", compare_at_price: "1200.00", inventory_quantity: 0, inventory_management: "shopify" },
  ],
};
const m = mapShopify(shirt);
is("name", m.product_name, "Box T-shirt");
is("code comes from the cheapest variant's sku", m.product_code, "BOXT-M");
is("category is the product type", m.category, "T-shirts");
is("brand is the vendor", m.brand, "Nokshi");
// compare_at is the "was" figure. Read the wrong way round it would advertise a
// discount that does not exist.
is("the struck-through figure is the regular price", m.regular_price, "1200.00");
is("and what they actually pay is the sale price", m.sale_price, "900.00");
is("in stock while any variant has some", m.stock_status, "instock");
is("every photo travels", m.images, ["https://cdn/front.jpg", "https://cdn/back.jpg"]);
is("the first one is the primary", m.image_url, "https://cdn/front.jpg");
is("the html is stripped", m.description, "Heavy cotton, oversized");
is("options come across", m.options, [{ name: "Size", values: ["S", "M", "L"] }, { name: "Colour", values: ["Black"] }]);

// No sale: compare_at absent, or not above the price.
is("no compare_at means one plain price",
  mapShopify({ id: 1, title: "Mug", variants: [{ price: "300" }] }).regular_price, "300");
is("and no sale price", mapShopify({ id: 1, title: "Mug", variants: [{ price: "300" }] }).sale_price, "");
is("a compare_at BELOW the price is not a sale",
  mapShopify({ id: 1, title: "Mug", variants: [{ price: "300", compare_at_price: "200" }] }).sale_price, "");
is("a compare_at EQUAL to the price is not a sale either",
  mapShopify({ id: 1, title: "Mug", variants: [{ price: "300", compare_at_price: "300" }] }).sale_price, "");

// Shopify's placeholder for "this product has no choices" must not become a
// size picker in front of every customer.
is("Default Title is not an option",
  mapShopify({ id: 1, title: "Mug", options: [{ name: "Title", values: ["Default Title"] }], variants: [{ price: "1" }] }).options, []);
is("but a real option called Title survives",
  mapShopify({ id: 1, title: "Book", options: [{ name: "Title", values: ["Part 1", "Part 2"] }], variants: [{ price: "1" }] }).options,
  [{ name: "Title", values: ["Part 1", "Part 2"] }]);

// Stock.
is("out when every tracked variant is empty",
  mapShopify({ id: 1, title: "Mug", variants: [{ price: "1", inventory_quantity: 0, inventory_management: "shopify" }] }).stock_status, "outofstock");
is("in stock when Shopify is not counting it",
  mapShopify({ id: 1, title: "Mug", variants: [{ price: "1", inventory_quantity: 0 }] }).stock_status, "instock");

// The awkward ones.
is("no variants at all does not throw", mapShopify({ id: 5, title: "Ghost" }).product_code, "SH-5");
is("no price is no price", mapShopify({ id: 5, title: "Ghost" }).regular_price, "");
is("a zero price is not a price", mapShopify({ id: 5, title: "Free", variants: [{ price: "0.00" }] }).regular_price, "");
is("no images is an empty gallery", mapShopify({ id: 5, title: "Ghost" }).images, []);
is("at most twelve photos", mapShopify({ id: 5, title: "Many", images: Array(20).fill({ src: "https://x/a.jpg" }) }).images.length, 12);
is("at most five options", mapShopify({ id: 5, title: "Many", options: Array(9).fill({ name: "A", values: ["1"] }) }).options.length, 5);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
