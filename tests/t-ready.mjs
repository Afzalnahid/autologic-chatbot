// This rule REFUSES to save things, so a false "incomplete" stops an owner
// adding real stock and they cannot debug it. Both directions are tested, and
// the false positives harder than the true ones.
import { missingToSell, canSell, productState, findableByPhoto, missingMessage, missingOnForm, MISSING } from "./readiness.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const full = { product_name: "Box T-shirt", regular_price: "450", image_url: "https://x/1.jpg", visual: "a boxy tee" };

// ── What must be allowed through ─────────────────────────────────────────────
check("a complete product", missingToSell(full), []);
check("...and it is ready", productState(full).state, "ready");
check("a sale price counts as a price", missingToSell({ ...full, regular_price: "", sale_price: "399" }), []);
check("a gallery counts as a photo", missingToSell({ ...full, image_url: "", images: ["https://x/2.jpg"] }), []);
check("price zero is a price — free samples exist", missingToSell({ ...full, regular_price: "0" }), []);
check("stock is NOT required — an out-of-stock product still shows", missingToSell({ ...full, stock_qty: undefined }), []);
check("a category is not required", missingToSell({ ...full, category: "" }), []);
check("no description is fine", missingToSell({ ...full, description: "" }), []);

// ── What must be stopped ─────────────────────────────────────────────────────
check("no price", missingToSell({ ...full, regular_price: "" }), ["price"]);
check("no photo", missingToSell({ ...full, image_url: "", images: [] }), ["photo"]);
check("no name", missingToSell({ ...full, product_name: "  " }), ["name"]);
check("nothing at all", missingToSell({}), ["name", "price", "photo"]);
check("an empty gallery is not a photo", missingToSell({ ...full, image_url: "", images: [] }), ["photo"]);
check("whitespace is not a price", missingToSell({ ...full, regular_price: "   " }), ["price"]);
check("canSell agrees", [canSell(full), canSell({ ...full, regular_price: "" })], [true, false]);

// ── The quieter state ────────────────────────────────────────────────────────
check("sellable but its photo was never read", productState({ ...full, visual: "" }).state, "unreadable");
check("...which is not the same as incomplete", productState({ ...full, visual: "" }).missing, []);
check("findableByPhoto reads the vision text", [findableByPhoto(full), findableByPhoto({ ...full, visual: "" })], [true, false]);
check("incomplete beats unreadable — fix the bigger thing first",
  productState({ product_name: "X", visual: "" }).state, "incomplete");

// ── Read off a form, before anything is uploaded ─────────────────────────────
check("a form with a file attached has a photo",
  missingOnForm({ product_name: "X", regular_price: "1" }, true), []);
check("a form with no file and no pasted link does not",
  missingOnForm({ product_name: "X", regular_price: "1" }, false), ["photo"]);
check("a form missing both", missingOnForm({ product_name: "X" }, false), ["price", "photo"]);

// ── What the owner reads ─────────────────────────────────────────────────────
const m1 = missingMessage(["price"]);
check("one missing thing reads as a sentence", /needs a price before it can be saved/.test(m1), true);
check("and says why", /first thing a customer asks/.test(m1), true);
const m2 = missingMessage(["price", "photo"]);
check("two are joined with 'and'", /needs a price and a photo/.test(m2), true);
const m3 = missingMessage(["name", "price", "photo"], "service");
check("three are comma-then-and", /needs a name, a price and a photo/.test(m3), true);
check("an agency reads its own word", /This service needs/.test(m3), true);
check("every key has a label and a reason",
  Object.values(MISSING).filter((v) => v.label && v.why).length, Object.keys(MISSING).length);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
