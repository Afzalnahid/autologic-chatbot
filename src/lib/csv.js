// CSV reading for the product importer.
//
// Written by hand rather than pulled from a package because the whole job is
// about 40 lines and a dependency here would ship to every dashboard visitor.
//
// It handles what a real spreadsheet export actually contains, which a naive
// text.split(",") does not:
//   - quoted fields:            Shirt, blue  ->  "Shirt, blue"
//   - escaped quotes inside:    5" screen    ->  "5"" screen"
//   - newlines inside a field:  a description that wraps
//   - CRLF line endings from Excel on Windows
//   - a UTF-8 BOM, which Excel writes and which would otherwise glue itself to
//     the first header name and stop it matching anything

export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", quoted = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;                       // half of a CRLF
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  // Whatever is left when the text ends is the last field of the last row.
  if (field.length || row.length) { row.push(field); rows.push(row); }

  // A trailing newline leaves one empty row; so does a blank line mid-file.
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

// Header name -> the product field it feeds.
//
// Spreadsheets come from everywhere — a WooCommerce export, a Shopify export,
// something typed by hand in Bangla-accented English — so each field lists the
// spellings actually seen rather than insisting on one. Matching is done on a
// squashed form of the header (lowercased, punctuation dropped), so "Product
// Name", "product_name" and "PRODUCT-NAME" are all the same thing.
export const COLUMNS = [
  { key: "product_name",  label: "Name",        required: true,
    aliases: ["name", "productname", "product", "title", "itemname", "item"] },
  { key: "product_code",  label: "Code / SKU",  required: false,
    aliases: ["code", "productcode", "sku", "id", "productid", "itemcode", "modelno", "model"] },
  { key: "regular_price", label: "Price",       required: false,
    aliases: ["price", "regularprice", "mrp", "rate", "amount", "cost", "sellingprice"] },
  { key: "sale_price",    label: "Sale price",  required: false,
    aliases: ["saleprice", "discountprice", "offerprice", "discountedprice", "specialprice"] },
  { key: "category",      label: "Category",    required: false,
    aliases: ["category", "categories", "type", "group", "collection"] },
  { key: "description",   label: "Description", required: false,
    aliases: ["description", "details", "detail", "about", "shortdescription", "longdescription"] },
  { key: "image_url",     label: "Image link",  required: false,
    aliases: ["image", "imageurl", "imagelink", "photo", "photourl", "picture", "img", "images"] },
  { key: "stock_status",  label: "Stock",       required: false,
    aliases: ["stock", "stockstatus", "availability", "available", "instock", "quantity", "qty"] },
];

const squash = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Best guess at which spreadsheet column feeds which product field. Returns
// { product_name: 0, regular_price: 3, ... } — an index into each row.
//
// The owner can correct any of it in the UI before importing, so this only has
// to be right often enough to save them the work, never right always.
export function autoMap(headers) {
  const squashed = headers.map(squash);
  const map = {};
  const taken = new Set();
  for (const col of COLUMNS) {
    // An exact match on the field's own key wins over any alias.
    let i = squashed.findIndex((h, n) => !taken.has(n) && h === squash(col.key));
    if (i < 0) i = squashed.findIndex((h, n) => !taken.has(n) && col.aliases.includes(h));
    if (i >= 0) { map[col.key] = i; taken.add(i); }
  }
  return map;
}

// "In stock" / "yes" / "12" -> instock;  "no" / "0" / "out of stock" -> outofstock.
// Anything unrecognised is treated as in stock: a product the shop can actually
// sell being hidden is worse than one extra thing to correct.
function stockStatus(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "instock";
  if (/^(0|no|n|false|out|outofstock|out of stock|unavailable|nostock)$/.test(v)) return "outofstock";
  if (/^\d+$/.test(v)) return Number(v) > 0 ? "instock" : "outofstock";
  return "instock";
}

// Prices arrive as "৳1,450", "1450.00 BDT", "1,450/-". The bot needs a number
// it can quote, so everything that is not a digit or a decimal point goes.
function price(raw) {
  const v = String(raw ?? "").replace(/[^\d.]/g, "");
  if (!v) return "";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

// Turn parsed rows + a column map into products ready for /api/import-one.
// Rows with no name are dropped and counted — a spreadsheet nearly always has
// a stray blank or a totals line at the bottom, and silently importing those
// as nameless products would be worse than skipping them.
export function toProducts(rows, map, { startCode = "CSV" } = {}) {
  const at = (row, key) => (map[key] == null ? "" : String(row[map[key]] ?? "").trim());
  const products = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const name = at(row, "product_name");
    if (!name) { skipped++; return; }
    products.push({
      product_code: at(row, "product_code") || `${startCode}-${Date.now()}-${i + 1}`,
      product_name: name,
      category: at(row, "category"),
      regular_price: price(at(row, "regular_price")),
      sale_price: price(at(row, "sale_price")),
      stock_status: stockStatus(at(row, "stock_status")),
      // Only a real http link is passed on: the importer runs vision on it, and
      // a local file path from someone's computer would just fail slowly.
      image_url: /^https?:\/\//i.test(at(row, "image_url")) ? at(row, "image_url") : "",
      description: at(row, "description"),
    });
  });
  return { products, skipped };
}

// The file the "Download a sample" button hands over. Deliberately filled in,
// not blank: an owner who has never made a CSV can open this in Excel, replace
// the two example rows with their own, and be certain the shape is right.
export const SAMPLE_CSV = [
  "product_name,product_code,regular_price,sale_price,category,stock_status,image_url,description",
  '"Cotton panjabi — navy",PJ-001,1450,1250,Panjabi,instock,,"Soft cotton, full sleeve, regular fit"',
  '"Handloom shawl",SH-014,890,,Shawl,instock,,"Handwoven, natural dye"',
].join("\n");
