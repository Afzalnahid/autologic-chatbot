// Three or four products ride along with every reply, and the whole metadata
// row is ~970 tokens of which most is the AI's own description of the photo —
// written to build the search vector, not to answer a customer. This trims it
// to what a reply is actually made of. The test holds two lines at once: the
// saving is real, and nothing the bot answers with was dropped.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { productForPrompt, productsBlock } =
  await import(pathToFileURL(join(here, "..", "src", "lib", "prompt-parts.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// A row shaped like Broker's BD's real catalogue.
const meta = {
  product_code: "SAR-104", product_name: "Katan Silk Saree", category: "Saree", brand: "Tangail",
  regular_price: 4500, sale_price: 3900, stock_status: "instock", stock_qty: 7,
  variants: [{ name: "Red", price: 3900, stock: 3 }, { name: "Blue", price: 4100, stock: 4 }],
  options: { colour: ["Red", "Blue"] },
  image_url: "https://x.test/a.jpg", images: ["https://x.test/a.jpg", "https://x.test/b.jpg"],
  tags: ["wedding", "silk"],
  description: "A ".repeat(400),
  visual: "V ".repeat(500),
  visuals: ["V ".repeat(500), "W ".repeat(500)],
  client_id: "a5305b5e-630d-4aaa-99c6-2a6c0510c0d5", photo_key: "clients/x/y.jpg",
  created_at: "2026-08-20T13:33:19Z", updated_at: "2026-09-01T10:00:00Z",
};

const out = productForPrompt(meta, 0.8123);

ok("the code, name and category survive", out.product_code === "SAR-104" && out.product_name === "Katan Silk Saree" && out.category === "Saree");
ok("both prices survive — the bot quotes them", out.regular_price === 4500 && out.sale_price === 3900);
ok("stock survives — it must never sell what is finished", out.stock_status === "instock" && out.stock_qty === 7);
ok("variants survive whole, with their own prices", JSON.stringify(out.variants) === JSON.stringify(meta.variants));
ok("options survive", JSON.stringify(out.options) === JSON.stringify(meta.options));
ok("the images survive — a reply sends the picture", out.image_url === meta.image_url && out.images.length === 2);
ok("tags survive", JSON.stringify(out.tags) === JSON.stringify(meta.tags));
ok("the match score is rounded to two places", out.match_score === 0.81);

ok("bookkeeping is dropped", !("client_id" in out) && !("photo_key" in out) && !("created_at" in out) && !("updated_at" in out));
ok("the long photo descriptions are dropped", !("visuals" in out));
ok("one short line of the photo is kept", out.visual.length <= 161 && out.visual.endsWith("…"));
ok("the description is capped, not dropped", out.description.length <= 301 && out.description.startsWith("A"));

const before = JSON.stringify({ ...meta, match_score: 0.81 }).length;
const after = JSON.stringify(out).length;
ok(`the row shrinks by more than half (${before} → ${after})`, after < before / 2);

// Short text is left exactly as it is — no ellipsis on a normal description.
const short = productForPrompt({ product_name: "Mug", description: "Ceramic, 300ml.", visual: "A white mug." });
ok("short text is untouched", short.description === "Ceramic, 300ml." && short.visual === "A white mug.");
ok("empty fields are left out entirely", !("category" in short) && !("match_score" in short));

// Junk must not throw: a product row can be anything the database holds.
for (const junk of [null, undefined, 42, "text", []]) ok(`junk ${JSON.stringify(junk)} → an object, never a throw`, typeof productForPrompt(junk) === "object");
ok("a missing score is simply absent", !("match_score" in productForPrompt({ product_name: "X" })));
ok("NaN score is refused", !("match_score" in productForPrompt({ product_name: "X" }, NaN)));

const block = productsBlock([{ metadata: meta, similarity: 0.9 }, { metadata: { product_name: "Mug" } }]);
ok("the block is one product per line", block.split("\n").length === 2);
ok("each line is valid JSON", block.split("\n").every((l) => { try { JSON.parse(l); return true; } catch { return false; } }));
ok("an empty search is an empty block", productsBlock([]) === "" && productsBlock() === "");

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
