// The pure half of src/lib/duplicates.js, copied so node can run it without
// supabase. Keep in step with the original.
import crypto from "node:crypto";
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);

export function nameKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export const codeKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export const bytesKey = (buf) => (buf?.length ? `b:${sha(buf)}` : "");
export const urlKey = (url) => (String(url || "").trim() ? `u:${sha(String(url).trim())}` : "");

// The matching step of findDuplicate, against rows supplied directly.
export function match(rows, { name, code, photoKey, excludeId } = {}) {
  const nk = nameKey(name), ck = codeKey(code);
  if (!nk && !ck && !photoKey) return null;
  const list = rows.filter((r) => !excludeId || String(r.id) !== String(excludeId));
  const hit = (r, reason) => ({ id: r.id, product_name: r.name || "", reason });
  let r;
  if (ck && (r = list.find((x) => codeKey(x.code) === ck))) return hit(r, "code");
  if (nk && (r = list.find((x) => nameKey(x.name) === nk))) return hit(r, "name");
  if (photoKey && (r = list.find((x) => x.pkey === photoKey))) return hit(r, "photo");
  return null;
}

export function duplicateMessage(dup, thing = "product") {
  const name = dup?.product_name ? `“${dup.product_name}”` : `another ${thing}`;
  if (dup?.reason === "code") return `You already have a ${thing} with that code — ${name}. Two with the same code confuse the bot when a customer asks for one.`;
  if (dup?.reason === "photo") return `You have already added this exact photo — it is ${name}. The bot would not know which one to show when a customer sends that picture.`;
  return `You already have a ${thing} called ${name}. Two with the same name confuse the bot when a customer asks for it.`;
}
