// Delete the product-image files that no product points at any more.
//
// WHY THIS EXISTS
// Until the fix that ships with it, deleting a product (or removing a photo from
// one) deleted the database row but left the image FILE behind in the
// `product-images` bucket for ever. Those orphans fill the storage quota and stay
// reachable by their public URL. New products clean up after themselves now; this
// script clears the ones that were already left behind.
//
// WHAT IT WILL AND WILL NOT TOUCH
//   • Only the `product-images` bucket. Logos and knowledge-files are never read.
//   • Only files DIRECTLY under a client folder (`<clientId>/<file>`), which is
//     exactly where product photos live. Chat images sit in `<clientId>/chat/…`,
//     a subfolder, and are skipped — they belong to a conversation, not a product.
//   • A file is an orphan only if NO product's metadata (primary, gallery, or a
//     variant photo) still points at it. Anything a product references is kept.
//
// SAFE BY DEFAULT
// It is a DRY RUN unless you pass --delete. The dry run lists every file it would
// remove and the space it would free, and changes nothing. Read that list, then
// run again with --delete.
//
// HOW TO RUN  (from the project root, with the service role key)
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/clean-orphan-product-images.mjs
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/clean-orphan-product-images.mjs --delete
// The same two values are already in the Vercel project settings.

import { createClient } from "@supabase/supabase-js";

const BUCKET = "product-images";
const DELETE = process.argv.includes("--delete");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in the environment.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// The object path inside the bucket for one image URL, or null if the URL does
// not live in this bucket (an external import, or a different bucket).
function pathOf(u) {
  const marker = `/object/public/${BUCKET}/`;
  const s = String(u || "");
  const at = s.indexOf(marker);
  if (at === -1) return null;
  let p = s.slice(at + marker.length).split("?")[0];
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  return p || null;
}

// Every object path any product currently points at.
async function referencedPaths() {
  const kept = new Set();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from("products").select("metadata").range(from, from + PAGE - 1);
    if (error) throw new Error("reading products: " + error.message);
    if (!data || !data.length) break;
    for (const row of data) {
      const m = row.metadata || {};
      const urls = [
        m.image_url,
        ...(Array.isArray(m.images) ? m.images : []),
        ...(Array.isArray(m.variants) ? m.variants : []).map((v) => v && v.image_url),
      ];
      for (const u of urls) { const p = pathOf(u); if (p) kept.add(p); }
    }
    if (data.length < PAGE) break;
  }
  return kept;
}

// Every product photo in the bucket: files directly under each client folder.
// Folders (client folders at the top, and `chat` inside them) come back with a
// null id; only real files have one, and only the ones one level deep are photos.
async function allProductPhotos() {
  const out = [];
  const top = await listAll("");
  for (const entry of top) {
    if (entry.id) continue; // a stray file at the bucket root — not a product photo, leave it
    const clientId = entry.name;
    const files = await listAll(clientId);
    for (const f of files) {
      if (!f.id) continue; // a subfolder such as `chat` — skip the whole thing
      out.push({ name: `${clientId}/${f.name}`, size: Number(f.metadata?.size) || 0 });
    }
  }
  return out;
}

async function listAll(prefix) {
  const all = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`listing ${prefix || "<root>"}: ${error.message}`);
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + " MB";

async function main() {
  console.log(`Bucket: ${BUCKET}   Mode: ${DELETE ? "DELETE" : "DRY RUN (nothing will be removed)"}\n`);

  const kept = await referencedPaths();
  const photos = await allProductPhotos();
  const orphans = photos.filter((p) => !kept.has(p.name));
  const bytes = orphans.reduce((n, p) => n + p.size, 0);

  console.log(`Product photos in bucket : ${photos.length}`);
  console.log(`Still referenced         : ${photos.length - orphans.length}`);
  console.log(`Orphans (unreferenced)   : ${orphans.length}  (${mb(bytes)})\n`);

  if (!orphans.length) { console.log("Nothing to clean."); return; }

  for (const o of orphans.slice(0, 40)) console.log("  " + o.name);
  if (orphans.length > 40) console.log(`  … and ${orphans.length - 40} more`);

  if (!DELETE) {
    console.log(`\nDry run only. Re-run with --delete to remove these ${orphans.length} files.`);
    return;
  }

  let removed = 0;
  const paths = orphans.map((o) => o.name);
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) { console.error("remove batch failed:", error.message); continue; }
    removed += batch.length;
    console.log(`removed ${removed}/${paths.length}`);
  }
  console.log(`\nDone. Removed ${removed} orphan files (${mb(bytes)} freed).`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
