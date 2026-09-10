// Makes a photo small enough to send before it leaves the browser.
//
// Why this exists: Vercel refuses any request body over about 4.5 MB, and it
// refuses it at the edge — before a single line of our code runs, so nothing
// server-side can catch it or explain it. A phone camera writes 2–5 MB per
// photo, so one or two pictures from an iPhone was enough to break "Add
// product" completely. Measured against production: a 1 KB body reached the
// function and answered, a 6 MB body came back 413 with a non-JSON body, which
// is why the dashboard could only say "network".
//
// A product photo does not need 4000px. 1600 on the long side is larger than
// any place we show it, and the file drops to roughly a tenth of the size. That
// also makes the upload finish faster and costs the shop owner far less mobile
// data — most of them are on a phone, paying by the megabyte.

const MAX_SIDE = 1600;
const QUALITY = 0.82;
// Below this a photo is already small enough that re-encoding would cost
// quality for almost no saving.
const SKIP_UNDER = 600 * 1024;

// What the whole gallery may weigh. The hard ceiling is Vercel's ~4.5 MB for
// the entire request, and the request also carries the name, description,
// options and every variant — so this leaves a megabyte of room for those.
//
// One photo at 1600px is nowhere near this. Twelve of them are: measured in a
// real browser, a detailed shot lands around 550 KB, so a full gallery came to
// 6.5 MB and would have been refused exactly as before. When that happens the
// whole set steps down a rung until it fits.
export const GALLERY_BUDGET = 3_500_000;
// The last rung is small on purpose: twelve 640px photos weigh about a megabyte,
// so a gallery that still does not fit after this rung was never shrunk at all
// (decoding failed) — which galleryFits() lets the screen say plainly.
const LADDER = [1280, 1024, 800, 640];

/**
 * Returns a smaller JPEG File, or the original file when shrinking it would
 * not help. Never throws — a photo that cannot be decoded is passed through
 * untouched so the upload behaves exactly as it did before.
 */
export async function shrinkImage(file, { maxSide = MAX_SIDE, quality = QUALITY, skipUnder = SKIP_UNDER } = {}) {
  try {
    if (!file || !file.type?.startsWith("image/")) return file;
    // A GIF may be animated; drawing it to a canvas would keep one frame and
    // silently throw the animation away.
    if (file.type === "image/gif") return file;
    if (file.size <= skipUnder) return file;

    const bitmap = await decode(file);
    if (!bitmap) return file;

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // JPEG has no transparency: without this, a PNG cut-out would come out on
    // a black background instead of a white one.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    let blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    // Some Android WebViews hand back null from toBlob; toDataURL still works
    // there, so try it before giving up on the shrink.
    if (!blob) blob = dataUrlToBlob(canvas.toDataURL("image/jpeg", quality));
    // A re-encode of an already-efficient photo can come out bigger than it
    // went in. Keep the original then.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name?.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

function dataUrlToBlob(dataUrl) {
  try {
    const [head, b64] = String(dataUrl || "").split(",");
    if (!b64) return null;
    const mime = /data:([^;]+)/.exec(head)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch { return null; }
}

// createImageBitmap is the fast path and the only one that applies the EXIF
// orientation for us — without it every photo taken in portrait on a phone
// would be saved lying on its side. Safari added the option late, so a plain
// <img> is kept as a fallback; browsers apply EXIF to <img> themselves.
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
    try { return await createImageBitmap(file); } catch {}
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Shrinks a batch and, if the gallery would still be too heavy to send, steps
 * the WHOLE batch down to a smaller size until it fits. Re-shrinking from the
 * originals each time rather than from the already-compressed copy, so a photo
 * is never encoded twice and never picks up the smearing that causes.
 *
 * `keepBytes` is what the gallery already holds, so adding photos one at a
 * time cannot creep past the budget the way a per-batch check would.
 */
export async function shrinkBatch(files, keepBytes = 0, budget = GALLERY_BUDGET) {
  let out = await Promise.all(files.map((f) => shrinkImage(f)));
  const total = () => out.reduce((a, f) => a + f.size, keepBytes);
  for (const side of LADDER) {
    if (total() <= budget) break;
    // skipUnder drops away here: at this point every kilobyte counts, so even
    // an already-small photo is worth re-encoding smaller.
    out = await Promise.all(files.map((f) => shrinkImage(f, { maxSide: side, quality: 0.78, skipUnder: 0 })));
  }
  return out;
}

/** Total bytes of a gallery (File objects or {file} rows) plus what is already held. */
export const galleryBytes = (files, keepBytes = 0) =>
  (files || []).reduce((a, f) => a + ((f && f.file ? f.file.size : f?.size) || 0), keepBytes);

/**
 * Whether a gallery may be sent as ONE request. When this is false after
 * shrinkBatch has run, shrinking did not take effect (the browser could not
 * decode or re-encode the photos) — the screen must block the save and say so,
 * never fire a request that the platform is certain to refuse.
 */
export const galleryFits = (files, keepBytes = 0, budget = GALLERY_BUDGET) =>
  galleryBytes(files, keepBytes) <= budget;

/** Human-readable size, for telling someone why an upload was refused. */
export const fileSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
