// One cell, several pictures. Every export writes the separator differently,
// and a single URL may legitimately contain a comma, so both directions matter:
// the links must all be found, and one link must not be torn in half.
import { imageList, toProducts, autoMap, parseCsv, SAMPLE_CSV } from "./csv.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const A = "https://a.com/1.jpg", B = "https://b.com/2.png";

// ── Separators seen in the wild ──────────────────────────────────────────────
check("a single link", imageList(A), [A]);
check("comma separated (WooCommerce)", imageList(`${A}, ${B}`), [A, B]);
check("pipe separated", imageList(`${A} | ${B}`), [A, B]);
check("newline separated (Shopify)", imageList(`${A}\n${B}`), [A, B]);
check("carriage returns too", imageList(`${A}\r\n${B}`), [A, B]);
check("semicolon separated", imageList(`${A};${B}`), [A, B]);
check("space separated", imageList(`${A} ${B}`), [A, B]);
check("quoted links", imageList(`"${A}" | '${B}'`), [A, B]);

// ── What must NOT be torn apart ──────────────────────────────────────────────
const withCommas = "https://cdn.shop/img?w=800,h=600,fit=crop";
check("a comma INSIDE one url does not split it", imageList(withCommas), [withCommas]);
check("...even alongside a second link",
  imageList(`${withCommas}, ${B}`), [withCommas, B]);

// ── Rubbish in, nothing out ──────────────────────────────────────────────────
check("empty cell", imageList(""), []);
check("null cell", imageList(null), []);
check("a local file path is not a link", imageList("C:\\Users\\me\\shirt.jpg"), []);
check("a bare filename is not a link", imageList("shirt.jpg"), []);
check("a local path beside a real link keeps only the link", imageList(`shirt.jpg | ${A}`), [A]);
check("the same link twice is one picture", imageList(`${A}, ${A}`), [A]);
check("capped at twelve", imageList(Array.from({ length: 20 }, (_, i) => `https://x.com/${i}.jpg`).join(",")).length, 12);

// ── Through a whole spreadsheet ──────────────────────────────────────────────
const rows = parseCsv(SAMPLE_CSV);
const [headers, ...body] = rows;
const map = autoMap(headers);
const { products, skipped } = toProducts(body, map);
check("the sample parses to two products", products.length, 2);
check("no rows skipped", skipped, 0);
check("the first has TWO pictures", products[0].images.length, 2);
check("in the order written", products[0].images, ["https://example.com/panjabi-front.jpg", "https://example.com/panjabi-back.jpg"]);
check("the second has one", products[1].images, ["https://example.com/shawl.jpg"]);
check("names came through", products.map((p) => p.product_name), ["Cotton panjabi — navy", "Handloom shawl"]);
check("the image column was recognised", map.image_url != null, true);

// A sheet whose header says "Images" rather than "image_url".
const alt = parseCsv(['Name,Images', `Shirt,"${A} | ${B}"`].join("\n"));
const altMap = autoMap(alt[0]);
check("an 'Images' header maps to the same field", altMap.image_url != null, true);
check("and both pictures arrive", toProducts(alt.slice(1), altMap).products[0].images, [A, B]);

// A row with no image at all must still import.
const none = parseCsv(["Name,Price", "Scarf,350"].join("\n"));
const noneMap = autoMap(none[0]);
const p0 = toProducts(none.slice(1), noneMap).products[0];
check("a product with no picture still imports", p0.product_name, "Scarf");
check("with an empty gallery, not undefined", p0.images, []);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
