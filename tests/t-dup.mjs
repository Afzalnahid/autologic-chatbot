// Both failures matter here and they are not symmetrical. A missed duplicate
// leaves the bot with two rows it cannot tell apart. A FALSE duplicate stops an
// owner adding real stock — and they cannot debug it, so the false positives are
// tested at least as hard as the true ones.
import { nameKey, codeKey, bytesKey, urlKey, match, duplicateMessage } from "./dup-pure.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const CATALOGUE = [
  { id: "1", name: "Box T-shirt", code: "BT-01", pkey: "b:aaa" },
  { id: "2", name: "Cotton panjabi — navy", code: "PJ-NVY-01", pkey: "b:bbb" },
  { id: "3", name: "Winter jacket", code: "", pkey: "u:ccc" },
  { id: "4", name: "Box T-shirt 2", code: "BT-02", pkey: "b:ddd" },
];
const found = (o) => (o ? `${o.id}:${o.reason}` : null);

// ── The same product arriving again ──────────────────────────────────────────
check("the same name exactly", found(match(CATALOGUE, { name: "Box T-shirt" })), "1:name");
check("different case", found(match(CATALOGUE, { name: "BOX T-SHIRT" })), "1:name");
check("extra spaces", found(match(CATALOGUE, { name: "  Box   T-shirt " })), "1:name");
check("punctuation typed differently", found(match(CATALOGUE, { name: "Box T shirt" })), "1:name");
check("a trailing full stop", found(match(CATALOGUE, { name: "Box T-shirt." })), "1:name");
check("the same code, different name", found(match(CATALOGUE, { name: "Something else", code: "BT-01" })), "1:code");
check("a code written without the dash", found(match(CATALOGUE, { name: "Other", code: "bt01" })), "1:code");
check("the same photo, different name", found(match(CATALOGUE, { name: "Fresh name", photoKey: "b:aaa" })), "1:photo");
check("an em dash in the name still matches", found(match(CATALOGUE, { name: "Cotton panjabi - navy" })), "2:name");
check("bangla name matches itself", found(match([{ id: "9", name: "পাঞ্জাবি", code: "" }], { name: " পাঞ্জাবি " })), "9:name");

// ── Things that are NOT duplicates ───────────────────────────────────────────
check("a numbered sibling is a different product", found(match(CATALOGUE, { name: "Box T-shirt 3" })), null);
check("Box T-shirt 2 does not collide with Box T-shirt", found(match([CATALOGUE[0]], { name: "Box T-shirt 2" })), null);
check("a genuinely new product", found(match(CATALOGUE, { name: "Red scarf", code: "RS-01", photoKey: "b:zzz" })), null);
check("an empty name matches nothing", found(match(CATALOGUE, { name: "   " })), null);
check("nothing to compare returns null", found(match(CATALOGUE, {})), null);
check("an empty code is not a code match", found(match(CATALOGUE, { name: "New thing", code: "" })), null);
check("a product with no code does not match another with no code",
  found(match([{ id: "7", name: "A", code: "" }], { name: "B", code: "" })), null);
check("a byte key never matches a url key", found(match(CATALOGUE, { name: "New", photoKey: "u:ccc" })), "3:photo");
check("...and the url key finds only the url row",
  found(match([{ id: "8", name: "X", code: "", pkey: "b:ccc" }], { name: "New", photoKey: "u:ccc" })), null);

// ── Editing a product must not find itself ───────────────────────────────────
check("renaming a product to its own name is fine",
  found(match(CATALOGUE, { name: "Box T-shirt", excludeId: "1" })), null);
check("but renaming it onto ANOTHER product's name is not",
  found(match(CATALOGUE, { name: "Winter jacket", excludeId: "1" })), "3:name");

// ── Priority ─────────────────────────────────────────────────────────────────
check("code beats name when both match different rows",
  found(match(CATALOGUE, { name: "Winter jacket", code: "BT-01" })), "1:code");
check("name beats photo when both match different rows",
  found(match(CATALOGUE, { name: "Winter jacket", photoKey: "b:aaa" })), "3:name");

// ── Keys ─────────────────────────────────────────────────────────────────────
const buf = Buffer.from("the same bytes");
check("the same bytes give the same key", bytesKey(buf) === bytesKey(Buffer.from("the same bytes")), true);
check("different bytes give a different key", bytesKey(buf) === bytesKey(Buffer.from("other bytes")), false);
check("a byte key is prefixed", bytesKey(buf).startsWith("b:"), true);
check("a url key is prefixed", urlKey("http://x/y.jpg").startsWith("u:"), true);
check("the same url gives the same key", urlKey(" http://x/y.jpg ") === urlKey("http://x/y.jpg"), true);
check("an empty buffer gives no key", bytesKey(Buffer.alloc(0)), "");
check("an empty url gives no key", urlKey("  "), "");
check("nameKey of nothing is empty", [nameKey(null), nameKey(undefined), nameKey("")], ["", "", ""]);
check("codeKey of nothing is empty", codeKey(null), "");

// ── What the owner reads ─────────────────────────────────────────────────────
check("the name message names the product",
  duplicateMessage({ product_name: "Box T-shirt", reason: "name" }),
  "You already have a product called “Box T-shirt”. Two with the same name confuse the bot when a customer asks for it.");
check("the photo message says what the bot would do",
  /would not know which one to show/.test(duplicateMessage({ product_name: "X", reason: "photo" })), true);
check("an agency reads its own word",
  /service called/.test(duplicateMessage({ product_name: "X", reason: "name" }, "service")), true);
check("a nameless clash still reads sensibly",
  /another product/.test(duplicateMessage({ product_name: "", reason: "name" })), true);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
