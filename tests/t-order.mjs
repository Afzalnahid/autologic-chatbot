import { draftGaps, ASK_ORDER, exampleFor, EXAMPLES, LABELS } from "./a.mjs";

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; } else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

// The owner's order, out loud: what it is, where it lives, what it costs,
// what it is like, what a customer picks between, then the photos.
is("empty draft asks the name first", draftGaps({}, 0).queue[0], "product_name");
is("then the category", draftGaps({ product_name: "Box T-shirt" }, 0).queue[0], "category");
is("then the price", draftGaps({ product_name: "x", category: "T-shirts" }, 0).queue[0], "regular_price");
is("then the details", draftGaps({ product_name: "x", category: "c", regular_price: "500" }, 0).queue[0], "description");
is("then the variants", draftGaps({ product_name: "x", category: "c", regular_price: "500", description: "d" }, 0).queue[0], "options");
is("then the photos", draftGaps({ product_name: "x", category: "c", regular_price: "500", description: "d", options: [{ name: "Size", values: ["S"] }] }, 0).queue[0], "photo");
is("stock comes after the photos", draftGaps({ product_name: "x", category: "c", regular_price: "500", description: "d", options: [{ name: "S", values: ["S"] }] }, 2).queue[0], "stock_qty");

// A photo blocks the save and is still the sixth question. Importance and
// order are different questions; that was the whole bug.
const g = draftGaps({ product_name: "x", category: "c" }, 0);
is("photo blocks the save", g.blocking.includes("photo"), true);
is("and is still not asked for yet", g.queue.indexOf("photo") > g.queue.indexOf("regular_price"), true);
is("not ready without it", g.ready, false);

// The old shape has to keep working — three routes and the panel read it.
is("blocking is still MUST_HAVE order", draftGaps({}, 0).blocking, ["product_name", "regular_price", "photo"]);
is("wanted is still category + stock", draftGaps({}, 0).wanted, ["category", "stock_qty"]);
is("full draft asks nothing", draftGaps({ product_name: "a", category: "b", regular_price: "1", description: "d", options: [{ name: "S", values: ["M"] }], stock_qty: 3, brand: "b", sale_price: "1", product_code: "c", tags: ["t"] }, 1).queue, []);
is("full draft is ready", draftGaps({ product_name: "a", regular_price: "1" }, 1).ready, true);

// Every question the owner can be asked carries a real answer, in both
// languages. A missing one is a question somebody has to guess at.
for (const k of ASK_ORDER) {
  is(`example exists for ${k} (en)`, !!exampleFor(k, "en"), true);
  is(`example exists for ${k} (bn)`, !!exampleFor(k, "bn"), true);
}
is("unknown language falls back to English", exampleFor("regular_price", "fr"), EXAMPLES.regular_price.en);
is("unknown field is empty, not undefined", exampleFor("nonsense", "en"), "");
is("every field still has a label", ASK_ORDER.every((k) => !!LABELS[k]), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
