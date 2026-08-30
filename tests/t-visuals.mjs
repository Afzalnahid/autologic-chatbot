import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { loadPure } from "./shim.mjs";

const { buildContent, visualsOf } = await loadPure(__R("src/lib/products.js"), "tmp-products.mjs");

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

// ── visualsOf ──────────────────────────────────────────────────────────────
is("no photos at all", visualsOf({}), []);
is("the old shape, one description", visualsOf({ visual: "front of a green shirt" }), ["front of a green shirt"]);
is("primary first, then the rest",
  visualsOf({ visual: "front", visuals: ["front", "back", "close-up"] }),
  ["front", "back", "close-up"]);
is("the primary is not repeated when visuals leads with it",
  visualsOf({ visual: "front", visuals: ["front", "front", "back"] }),
  ["front", "back"]);
is("a gap where a photo could not be read is dropped, not left blank",
  visualsOf({ visual: "front", visuals: ["front", "", "back"] }),
  ["front", "back"]);
is("visuals without a primary still counts",
  visualsOf({ visuals: ["back", "side"] }), ["back", "side"]);
is("a primary missing from visuals is still first",
  visualsOf({ visual: "front", visuals: ["", "back"] }), ["front", "back"]);
is("not an array is not trusted", visualsOf({ visual: "front", visuals: "back" }), ["front"]);

// ── buildContent ───────────────────────────────────────────────────────────
// The thing this whole change exists for: a customer photographs the BACK of a
// shirt, and the words that come back have to be somewhere in the text that
// was embedded.
const shirt = {
  product_code: "BOXT-01", product_name: "Box T-shirt — green seed print",
  category: "T-shirts", brand: "", tags: ["cotton"],
  options: [{ name: "Size", values: ["S", "M", "L"] }],
  visual: "front view, olive green cotton t-shirt, small chest logo",
  visuals: [
    "front view, olive green cotton t-shirt, small chest logo",
    "back view, large circular seed print across the shoulders",
    "close-up of the ribbed collar",
  ],
  description: "Heavy cotton, oversized fit",
};
const text = buildContent(shirt);
is("the back is in the embedded text", text.includes("back view, large circular seed print"), true);
is("the close-up is too", text.includes("ribbed collar"), true);
is("and so is the front", text.includes("small chest logo"), true);
is("the name is still there", text.includes("Box T-shirt — green seed print"), true);
is("the category is still there", text.includes("Category: T-shirts"), true);
is("the options are still there", text.includes("Options: Size: S/M/L"), true);
is("the owner's own description is still there", text.includes("Heavy cotton, oversized fit"), true);
is("the front is written once, not twice", text.split("small chest logo").length - 1, 1);
is("an empty brand line is left out", text.includes("Brand:"), false);

// A product saved before any of this existed must build exactly the text it
// always did — otherwise every old row would re-embed into something new the
// first time it was touched.
const old = { product_code: "A1", product_name: "Kettle", category: "Kitchen", visual: "steel kettle", description: "Two litres" };
is("an old row is unchanged",
  buildContent(old),
  "Product Code: A1\nName: Kettle\nCategory: Kitchen\nsteel kettle\nTwo litres");
is("a row with a description and no photo still works",
  buildContent({ product_code: "A2", product_name: "Mug", description: "White mug" }),
  "Product Code: A2\nName: Mug\nWhite mug");
is("a row with a photo and no description still works",
  buildContent({ product_code: "A3", product_name: "Mug", visual: "white ceramic mug" }),
  "Product Code: A3\nName: Mug\nwhite ceramic mug");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
