export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { embedProduct } from "@/lib/products.js";
import { checkProductQuota } from "@/lib/plan-limits.js";
import { buildVariants } from "@/lib/variants.js";
import { normalizeActions } from "@/lib/inventory-actions.js";
import { normalizeSettingActions, applySettingActions } from "@/lib/assistant-actions.js";
import { findDuplicate, duplicateMessage } from "@/lib/duplicates.js";
import { missingToSell, missingMessage } from "@/lib/readiness.js";

// The assistant, half two: carry out what the owner confirmed.
//
// It takes the proposals, not a conversation — the model is nowhere near this
// route. Whatever reached the owner's screen is what arrives here, and it is
// normalised AGAIN through the same whitelist before anything is written,
// because a browser is not a place to enforce a rule.
//
// Every read and every write filters client_id at the database. A product id
// that belongs to another shop finds nothing and is reported as not found,
// which is exactly what it is from here.
export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const rl = rateLimit(`inv-apply:${client.id}`, 120, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are making changes very quickly. Please wait a moment.");

    const body = await request.json().catch(() => ({}));
    const actions = normalizeActions(body.actions);
    const settingActions = normalizeSettingActions(body.settingActions);
    if (!actions.length && !settingActions.length) return NextResponse.json({ error: "nothing to do" }, { status: 400 });

    const adding = actions.filter((a) => a.do === "create").length;
    if (adding) {
      const q = await checkProductQuota(client, adding);
      if (!q.ok) return NextResponse.json({ error: q.message }, { status: 403 });
    }

    const results = [];
    for (const a of actions) {
      try {
        if (a.do === "delete") results.push(await remove(client, a));
        else if (a.do === "create") results.push(await create(client, a));
        else results.push(await update(client, a));
      } catch (e) {
        results.push({ ok: false, id: a.id || null, error: e.message });
      }
    }

    // Everything the Bot Training tab holds is one row, so the whole settings
    // half is one read, one pure transformation and one write — and the read
    // happens HERE rather than being sent up from the browser, so a stale copy
    // held open in another tab cannot overwrite what has changed since.
    if (settingActions.length) results.push(...await applySettings(client, settingActions));

    const done = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, done, failed: results.length - done, results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// The offers, the bargaining rule, what the bot has been taught, who it says it
// is. All of it lives in `app_settings.settings` for this client, and the rule
// for what may change is applySettingActions — pure, shared with the panel that
// showed the owner these cards, and tested without a database.
async function applySettings(client, settingActions) {
  const { data: row, error: readErr } = await supabase.from("app_settings")
    .select("settings").eq("id", String(client.id)).maybeSingle();
  if (readErr) return [{ ok: false, error: readErr.message }];

  const { next, results } = applySettingActions(row?.settings || {}, settingActions);
  // Nothing landed — every proposal named something that has since gone. Do not
  // write; there is nothing to write, and an upsert would still bump the row.
  if (!results.some((r) => r.ok)) return results;

  const { error } = await supabase.from("app_settings")
    .upsert({ id: String(client.id), settings: next }, { onConflict: "id" });
  // The write is what makes any of it true. If it fails, every result that said
  // "ok" was a lie, so they are all turned back.
  if (error) return results.map((r) => ({ ok: false, error: error.message, did: r.did }));
  return results;
}

async function remove(client, a) {
  const { error, count } = await supabase.from("products")
    .delete({ count: "exact" }).eq("id", a.id).eq("client_id", client.id);
  if (error) throw new Error(error.message);
  if (!count) return { ok: false, id: a.id, error: "not found" };
  return { ok: true, id: a.id, did: "deleted" };
}

async function create(client, a) {
  // The assistant can describe a product in words but cannot take a photograph,
  // so anything it creates is missing one by definition. Rather than let it
  // make products the bot cannot show, it is refused with the reason — and the
  // owner is pointed at the chat, which does collect photos.
  const missing = missingToSell(a.set);
  if (missing.length) {
    return { ok: false, id: null, error: `${missingMessage(missing, client.item_label || "product")} Add it with “Add by chat” instead — that asks for the photos.` };
  }

  // An assistant asked twice in one conversation to "add a red scarf" would
  // otherwise add two. There is no "add anyway" here on purpose: the owner can
  // say so in words, and the assistant will be looking at a catalogue that
  // already contains the first one.
  const dup = await findDuplicate(client.id, { name: a.set.product_name, code: a.set.product_code });
  if (dup) return { ok: false, id: null, error: duplicateMessage(dup, client.item_label || "product") };

  const now = new Date().toISOString();
  const metadata = {
    client_id: String(client.id),
    product_code: a.set.product_code || `M-${Date.now()}`,
    product_name: a.set.product_name,
    category: a.set.category || "", brand: a.set.brand || "", tags: a.set.tags || [],
    regular_price: a.set.regular_price || "", sale_price: a.set.sale_price || "",
    stock_status: a.set.stock_status || (a.set.stock_qty === 0 ? "outofstock" : "instock"),
    stock_qty: a.set.stock_qty ?? null,
    // No photo: this product was described in words, not photographed. Vision
    // has nothing to read, so it is not called and `visual` stays empty — the
    // owner adds a picture in the drawer and the edit route describes it then.
    image_url: "", images: [], visual: "",
    description: a.set.description || "",
    options: a.set.options || [],
    variants: a.set.options ? buildVariants(a.set.options, { regular_price: a.set.regular_price || "" }) : [],
    created_at: now, updated_at: now,
  };
  const { content, embedding } = await embedProduct(metadata, client.id);
  const { data, error } = await supabase.from("products")
    .insert({ content, metadata, embedding, client_id: client.id }).select("id").single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data?.id, did: "created", name: metadata.product_name };
}

async function update(client, a) {
  const { data: row } = await supabase.from("products")
    .select("id,metadata").eq("id", a.id).eq("client_id", client.id).maybeSingle();
  if (!row) return { ok: false, id: a.id, error: "not found" };

  const prev = row.metadata || {};
  // Renaming one product onto another's name creates the same confusion as
  // adding it twice, so it is refused the same way. Itself excluded, or every
  // edit that does not change the name would collide with the row being edited.
  if (a.set.product_name || a.set.product_code) {
    const dup = await findDuplicate(client.id, { name: a.set.product_name, code: a.set.product_code, excludeId: a.id });
    if (dup) return { ok: false, id: a.id, error: duplicateMessage(dup, client.item_label || "product") };
  }

  const next = { ...prev, ...a.set, updated_at: new Date().toISOString() };
  // New options rebuild the combinations, keeping every row that still exists —
  // a stock count the owner typed against "M / Red" must survive adding XL.
  if (a.set.options) next.variants = buildVariants(a.set.options, next, prev.variants || []);
  // A product marked out of stock while its count still says 40 tells the bot
  // two different things, and it will happily quote the wrong one. Whichever of
  // the pair the owner actually chose settles the other.
  if (a.set.stock_status === "outofstock" && a.set.stock_qty === undefined) next.stock_qty = 0;
  if (a.set.stock_qty !== undefined && a.set.stock_status === undefined) next.stock_status = a.set.stock_qty > 0 ? "instock" : "outofstock";

  // Re-embed only when something search actually reads has moved. A stock count
  // is not part of the vector, and re-embedding on every restock would spend
  // the client's AI allowance for nothing.
  const searchKeys = ["product_code", "product_name", "category", "brand", "tags", "description", "options", "visual"];
  const patch = { metadata: next };
  if (searchKeys.some((k) => JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null))) {
    Object.assign(patch, await embedProduct(next, client.id));
  }
  const { error } = await supabase.from("products").update(patch).eq("id", a.id).eq("client_id", client.id);
  if (error) throw new Error(error.message);
  return { ok: true, id: a.id, did: "updated", name: next.product_name };
}
