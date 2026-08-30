// findTwins decides what the owner is shown and offered to delete, so the
// grouping is tested harder than the happy path: a wrong pile means a product
// deleted that should not have been.
import { findTwins, twinReason, richness, nameKey, codeKey } from "./dk.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};
const ids = (g) => g.items.map((p) => p.id).sort();

// ── Nothing to find ──────────────────────────────────────────────────────────
check("an empty catalogue", findTwins([]), []);
check("one product", findTwins([{ id: "a", product_name: "X" }]), []);
check("two different products", findTwins([
  { id: "a", product_name: "Box T-shirt" },
  { id: "b", product_name: "Red scarf" },
]), []);
check("two products with no name and no code are not twins", findTwins([
  { id: "a", product_name: "", product_code: "" },
  { id: "b", product_name: "", product_code: "" },
]), []);
check("numbered siblings are not twins", findTwins([
  { id: "a", product_name: "Box T-shirt 1" },
  { id: "b", product_name: "Box T-shirt 2" },
  { id: "c", product_name: "Box T-shirt 3" },
]), []);

// ── The plain pair ───────────────────────────────────────────────────────────
const pair = findTwins([
  { id: "a", product_name: "Box T-shirt", regular_price: "450", image_url: "u1", created_at: "2026-01-01" },
  { id: "b", product_name: "box  t shirt", created_at: "2026-02-01" },
]);
check("one pile", pair.length, 1);
check("both in it", ids(pair[0]), ["a", "b"]);
check("joined by name", pair[0].reasons, ["name"]);
check("the fuller one is suggested, not the newer", pair[0].keep, "a");
check("and it is listed first", pair[0].items[0].id, "a");
check("the reason reads plainly", twinReason(pair[0].reasons), "the same name");

// ── A chain is ONE pile, not two pairs ───────────────────────────────────────
// A and B share a code; B and C share a photo. Reported as two pairs, the owner
// would be asked to delete B twice.
const chain = findTwins([
  { id: "a", product_name: "One", product_code: "SKU-1" },
  { id: "b", product_name: "Two", product_code: "sku1", photo_key: "b:zzz" },
  { id: "c", product_name: "Three", photo_key: "b:zzz" },
]);
check("a chain makes a single pile", chain.length, 1);
check("with all three in it", ids(chain[0]), ["a", "b", "c"]);
check("and names both signals", chain[0].reasons.sort(), ["code", "photo"]);
check("read out in words", twinReason(["code", "photo"]), "the same code and the same photo");

// ── Several piles ────────────────────────────────────────────────────────────
const many = findTwins([
  { id: "a", product_name: "Shirt" }, { id: "b", product_name: "shirt" },
  { id: "c", product_name: "Scarf" }, { id: "d", product_name: "scarf" }, { id: "e", product_name: "SCARF" },
  { id: "f", product_name: "Hat" },
]);
check("two piles", many.length, 2);
check("the bigger one first", many[0].items.length, 3);
check("the lone product is in neither", many.flatMap((g) => g.items.map((p) => p.id)).includes("f"), false);

// ── A photo key must not join products that simply have none ─────────────────
check("empty photo keys do not join anything", findTwins([
  { id: "a", product_name: "One", photo_key: "" },
  { id: "b", product_name: "Two", photo_key: "" },
]), []);
check("a byte key and a url key are different photos", findTwins([
  { id: "a", product_name: "One", photo_key: "b:same" },
  { id: "b", product_name: "Two", photo_key: "u:same" },
]), []);

// ── Which one to keep ────────────────────────────────────────────────────────
check("more filled in wins",
  richness({ image_url: "u", regular_price: "1", category: "c" }) > richness({ regular_price: "1" }), true);
check("a stock count of zero still counts as filled in",
  richness({ stock_qty: 0 }) > richness({}), true);
const tie = findTwins([
  { id: "old", product_name: "Same", regular_price: "10", created_at: "2026-01-01" },
  { id: "new", product_name: "Same", regular_price: "10", created_at: "2026-05-01" },
]);
check("an exact tie keeps the newer one", tie[0].keep, "new");

// ── The rules the piles are built on ─────────────────────────────────────────
check("nameKey still ignores case and punctuation", nameKey("Box T-shirt!") === nameKey("box t shirt"), true);
check("codeKey still ignores the dash", codeKey("BT-01"), "bt01");

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
