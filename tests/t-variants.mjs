// The resolve step is where a variant photo can silently end up in the gallery,
// or a placeholder can be stored as if it were a URL. Both are tested here.
import { resolveGallery, claimedByVariants, resolveVariantImages }
  from "./products-pure.mjs";

const U = (n) => `https://cdn/${n}.jpg`;
let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

// Two gallery photos, then three variant photos, all in one upload list.
const uploaded = [U("g0"), U("g1"), U("v0"), U("v1"), U("v2")];
const variants = [
  { id: "a", name: "Red",   image_url: "upload:2" },
  { id: "b", name: "Blue",  image_url: "upload:3" },
  { id: "c", name: "Green", image_url: "upload:4" },
  { id: "d", name: "Black", image_url: "" },
];
const claimed = claimedByVariants(variants);

check("variant uploads are claimed", [...claimed].sort(), [2, 3, 4]);

check("gallery holds ONLY the gallery photos",
  resolveGallery(["upload:0", "upload:1"], uploaded, claimed),
  [U("g0"), U("g1")]);

check("each variant gets its own url",
  resolveVariantImages(variants, uploaded).map((v) => v.image_url),
  [U("v0"), U("v1"), U("v2"), ""]);

// Without the claim set, the old behaviour: every upload lands in the gallery.
check("old behaviour would have dumped all five in the gallery",
  resolveGallery(["upload:0", "upload:1"], uploaded).length, 5);

// An existing http url on a variant must survive untouched.
check("an already-saved variant url is left alone",
  resolveVariantImages([{ id: "x", image_url: U("kept") }], uploaded)[0].image_url,
  U("kept"));

// A placeholder pointing at a file that never arrived must not be stored.
check("a dangling placeholder becomes empty, not 'upload:9'",
  resolveVariantImages([{ id: "y", image_url: "upload:9" }], uploaded)[0].image_url,
  "");

check("no files at all: placeholders clear rather than persist",
  resolveVariantImages([{ id: "z", image_url: "upload:0" }], [])[0].image_url,
  "");

// Pasted gallery urls mixed with uploads still work.
check("pasted url + upload, variant photo still excluded",
  resolveGallery(["https://pasted/x.jpg", "upload:0"], uploaded, claimed),
  ["https://pasted/x.jpg", U("g0"), U("g1")]);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);

