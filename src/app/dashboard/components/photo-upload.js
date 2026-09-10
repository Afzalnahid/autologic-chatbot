"use client";
// Sends a product's photos to the server ONE AT A TIME and collects their URLs,
// so no single request can ever exceed the platform's ~4.5 MB ceiling — the
// reason a 12-photo save used to die with a misleading "check your internet".
//
// Each photo remembers its URL (`p.url`) once uploaded, so a retry after a
// dropped connection only sends the ones still missing. The first photo is
// deliberately NOT uploaded here: add-product keeps receiving it as bytes so
// its photo-based duplicate check (which hashes those bytes) keeps working.
import { apiJson } from "./session.js";
import { offlineError } from "@/lib/api-error.js";

// Anything over this could not be shrunk in the browser and can never be sent.
export const PHOTO_MAX_BYTES = 3_500_000;

export const tooLargePhotos = (photos) => (photos || []).filter((p) => (p?.file?.size || 0) > PHOTO_MAX_BYTES);

const isOffline = (r) => !!r && r.error === offlineError().error;

/**
 * Uploads photos[from..] that have no `url` yet. Calls onProgress(done, total).
 * Resolves { ok:true, photos } with urls filled in, or
 * { ok:false, photos, error, index } — photos keeps every url already won.
 */
export async function uploadPhotos(photos, { from = 1, onProgress } = {}) {
  const out = photos.map((p) => ({ ...p }));
  const todo = out.map((p, i) => i).filter((i) => i >= from && !out[i].url);
  let done = 0;
  onProgress?.(0, todo.length);
  for (const i of todo) {
    const fd = new FormData();
    fd.append("image", out[i].file);
    const r = await apiJson("/api/product-photo", { method: "POST", body: fd });
    if (!r || r.error || !r.url) {
      const error = isOffline(r)
        ? `The connection dropped while uploading photo ${i + 1} of ${out.length}. The ones already uploaded are kept — check your internet and press Save again.`
        : (r?.error || `Photo ${i + 1} could not be uploaded. Please try again.`);
      return { ok: false, photos: out, error, index: i };
    }
    out[i].url = r.url;
    done++;
    onProgress?.(done, todo.length);
  }
  return { ok: true, photos: out };
}
