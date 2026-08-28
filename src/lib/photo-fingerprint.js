// Is this the same picture I already have?
//
// Runs in the browser, on the file the owner just chose — before anything is
// uploaded, so the same photo picked twice never becomes two of anything. It is
// an EXACT match on the bytes, not "looks similar": choosing the same folder
// again, or the same file from two places, is how this actually happens, and a
// re-photographed or re-cropped picture is genuinely a different picture.
//
// The bytes are what shrinkImage produced, and that is deterministic for a
// given input, so the same original file always lands on the same fingerprint.

const CACHE = new WeakMap();

export async function fingerprint(file) {
  if (!file) return "";
  const hit = CACHE.get(file);
  if (hit) return hit;
  let key;
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    key = [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // crypto.subtle needs a secure context. On the off chance one is missing,
    // name and size still catch the ordinary case — the same file chosen twice
    // — and a weaker check is better than telling the owner nothing.
    key = `${file.name || "?"}:${file.size || 0}`;
  }
  CACHE.set(file, key);
  return key;
}

// Splits a list of files into the ones worth keeping and the repeats, against
// what is already held. `seen` is mutated, so it can be a ref that survives one
// batch of photos to the next.
export async function dropRepeats(files, seen) {
  const fresh = [], repeats = [];
  for (const f of files) {
    const key = await fingerprint(f);
    if (!key || seen.has(key)) repeats.push(f);
    else { seen.add(key); fresh.push(f); }
  }
  return { fresh, repeats };
}
