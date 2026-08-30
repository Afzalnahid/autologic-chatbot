// draftGaps is the only thing that decides whether a product built by
// conversation may be saved. The model's opinion does not count, so this is
// where the rule actually lives.
import { draftGaps, normalizeSet, LABELS, MUST_HAVE, SHOULD_HAVE } from "./inv-actions.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

check("an empty draft blocks on all three", draftGaps({}, 0).blocking, ["product_name", "regular_price", "photo"]);
check("and is not ready", draftGaps({}, 0).ready, false);

check("a name alone still blocks on price and photo",
  draftGaps({ product_name: "Box T-shirt" }, 0).blocking, ["regular_price", "photo"]);

check("name and price without a photo still blocks",
  draftGaps({ product_name: "X", regular_price: "450" }, 0).blocking, ["photo"]);

const ready = draftGaps({ product_name: "X", regular_price: "450" }, 1);
check("name, price and one photo is ready", ready.ready, true);
check("category and stock are still wanted", ready.wanted, ["category", "stock_qty"]);

// The owner's answer to the question: category and stock are asked for every
// time, but a shop that does not count stock must still be able to finish.
check("wanted fields never block", draftGaps({ product_name: "X", regular_price: "450" }, 1).blocking, []);

check("stock of zero counts as answered — it is an answer",
  draftGaps({ product_name: "X", regular_price: "450", category: "Men", stock_qty: 0 }, 1).wanted, []);

check("an empty string is not an answer",
  draftGaps({ product_name: "  ", regular_price: "450" }, 1).blocking, ["product_name"]);

check("empty options do not count as filled",
  draftGaps({ product_name: "X", regular_price: "450", options: [] }, 1).rest.includes("options"), true);

check("filled options drop out of the queue",
  draftGaps({ product_name: "X", regular_price: "450", options: [{ name: "Size", values: ["S"] }] }, 1).rest.includes("options"), false);

check("everything answered leaves nothing wanted or blocking", (() => {
  const g = draftGaps({ product_name: "X", regular_price: "450", category: "Men", stock_qty: 4 }, 2);
  return [g.blocking.length, g.wanted.length, g.ready];
})(), [0, 0, true]);

// The draft comes back from the browser each turn and is re-cleaned; it must
// not be possible to widen the whitelist by editing what the page posts.
check("a draft posted with extra fields is stripped",
  normalizeSet({ product_name: "X", client_id: "someone-else", image_url: "http://x", visual: "sneaky" }),
  { product_name: "X" });

check("a price still refuses nonsense in a draft", normalizeSet({ regular_price: "ask us" }), {});
check("a price is cleaned in a draft", normalizeSet({ regular_price: "৳1,200" }), { regular_price: "1200" });

check("every gap name has a label the owner can read",
  [...MUST_HAVE, ...SHOULD_HAVE].filter((k) => !LABELS[k]), []);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
