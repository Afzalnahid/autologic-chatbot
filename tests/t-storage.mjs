// Deleting a product must delete its image files too — but the cleanup shares a
// bucket with chat images and with other tenants, and a gallery can hold URLs
// imported from someone else's server. ownProductImagePath is the guard that
// decides what may be removed, so it is the thing most worth a test: a false
// positive here deletes a file that was never ours to delete.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const P = join(here, "..", "src", "lib", "products.js");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });

const { productImageUrls, ownProductImagePath } = await loadPure(P, "tmp-storage.mjs");

const CID = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const base = `https://ref.supabase.co/storage/v1/object/public/product-images/`;
const productUrl = (cid, file) => `${base}${cid}/${file}`;

// ── ownProductImagePath: what may be deleted ───────────────────────────────
ok("our product photo → its path",
  ownProductImagePath(productUrl(CID, "1699999999-ab12.jpg"), CID) === `${CID}/1699999999-ab12.jpg`);

ok("a chat image is refused (…/<client>/chat/…)",
  ownProductImagePath(productUrl(CID, "chat/1699999999.jpg"), CID) === null);

ok("another client's folder is refused",
  ownProductImagePath(productUrl(OTHER, "1699999999-ab12.jpg"), CID) === null);

ok("an external import URL is refused (no bucket segment)",
  ownProductImagePath("https://cdn.shopify.com/s/files/1/x/y/powerbank.jpg", CID) === null);

ok("a URL from a different bucket is refused",
  ownProductImagePath("https://ref.supabase.co/storage/v1/object/public/logos/" + CID + "/logo.png", CID) === null);

ok("a query string is stripped before the path",
  ownProductImagePath(productUrl(CID, "1699999999-ab12.jpg") + "?v=2", CID) === `${CID}/1699999999-ab12.jpg`);

ok("blank / null / undefined are refused",
  ownProductImagePath("", CID) === null && ownProductImagePath(null, CID) === null && ownProductImagePath(undefined, CID) === null);

ok("a missing clientId refuses everything",
  ownProductImagePath(productUrl(CID, "x.jpg"), "") === null);

// The client folder must be a real path segment, not a prefix match: client
// "1" must not be able to claim a file under client "12".
ok("clientId is matched as a folder, not a string prefix",
  ownProductImagePath(productUrl("12", "x.jpg"), "1") === null);

// ── productImageUrls: everything a row points at ───────────────────────────
eq("gathers primary, gallery and variant photos, deduped, blanks dropped",
  productImageUrls({
    image_url: productUrl(CID, "a.jpg"),
    images: [productUrl(CID, "a.jpg"), productUrl(CID, "b.jpg"), ""],
    variants: [{ image_url: productUrl(CID, "c.jpg") }, { image_url: "" }, { image_url: productUrl(CID, "b.jpg") }],
  }),
  [productUrl(CID, "a.jpg"), productUrl(CID, "b.jpg"), productUrl(CID, "c.jpg")]);

eq("an empty product has no urls", productImageUrls({}), []);
eq("no argument is safe", productImageUrls(), []);

// ── the two together: a real mixed gallery ─────────────────────────────────
// A product whose gallery mixes an owned photo, an imported Shopify URL and a
// (wrongly present) chat URL: only the owned one is ever deletable.
const mixed = {
  image_url: productUrl(CID, "own.jpg"),
  images: [productUrl(CID, "own.jpg"), "https://cdn.shopify.com/x.jpg", productUrl(CID, "chat/c.jpg")],
};
const deletable = productImageUrls(mixed).map((u) => ownProductImagePath(u, CID)).filter(Boolean);
eq("only the owned photo of a mixed gallery is deletable", deletable, [`${CID}/own.jpg`]);

console.log(fail === 0
  ? `${pass} passed, 0 failed`
  : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
