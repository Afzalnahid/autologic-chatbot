export const dynamic = "force-dynamic";
import { requireClient } from "@/lib/auth.js";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";

const STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"];

// Orders the bot recorded for this business, newest first. The shape is what
// the Orders tab shows: item lines with image/qty/unit price, the money split
// (subtotal / delivery / discount / total), payment, notes, channel.
export const GET = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  const { data: rows } = await supabase.from("orders").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(500);
  return NextResponse.json((rows || []).map(normalize));
}, "orders");

// Status changes, the owner's private note, and small corrections a customer
// asks for after ordering (phone, address, delivery charge, payment method).
export const PUT = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    patch.status = body.status;
  }
  if (body.owner_note !== undefined) patch.owner_note = String(body.owner_note || "").slice(0, 2000) || null;
  for (const k of ["phone_number", "address", "customer_name", "payment_method", "delivery_area", "notes"]) {
    if (body[k] !== undefined) patch[k] = String(body[k] || "").slice(0, 500);
  }
  if (body.delivery_charge !== undefined || body.discount !== undefined) {
    const { data: cur } = await supabase.from("orders").select("subtotal,delivery_charge,discount,total_price,items").eq("id", id).eq("client_id", client.id).maybeSingle();
    if (!cur) return NextResponse.json({ error: "not found" }, { status: 404 });
    const n = (v) => { const x = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };
    const sub = cur.subtotal != null ? n(cur.subtotal) : (Array.isArray(cur.items) ? cur.items.reduce((s, l) => s + n(l.qty) * n(l.unit_price), 0) : n(cur.total_price) - n(cur.delivery_charge) + n(cur.discount));
    const del = body.delivery_charge !== undefined ? n(body.delivery_charge) : n(cur.delivery_charge);
    const dis = body.discount !== undefined ? n(body.discount) : n(cur.discount);
    patch.subtotal = sub; patch.delivery_charge = del; patch.discount = dis;
    patch.total_price = String(Math.max(0, sub + del - dis));
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("orders").update(patch).eq("id", id).eq("client_id", client.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "updated", order: data ? normalize(data) : null });
}, "orders");

export const DELETE = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("orders").delete().eq("id", id).eq("client_id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "deleted" });
}, "orders");

// Old rows only have the flat text fields; give them the same shape as new ones.
function normalize(o) {
  const n = (v) => { const x = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : 0; };
  let items = Array.isArray(o.items) ? o.items : [];
  if (!items.length && (o.product_names || o.product_ids)) {
    const names = String(o.product_names || "").split(",").map(s => s.trim()).filter(Boolean);
    const codes = String(o.product_ids || "").split(",").map(s => s.trim());
    const imgs = String(o.image_urls || "").split(",").map(s => s.trim());
    items = names.map((name, i) => ({ code: codes[i] || "", name, variant: "", qty: names.length === 1 ? (n(o.quantity) || 1) : 1, unit_price: 0, image_url: imgs[i] || "" }));
  }
  const subtotal = o.subtotal != null ? n(o.subtotal) : items.reduce((s, l) => s + n(l.qty) * n(l.unit_price), 0);
  const delivery = o.delivery_charge != null ? n(o.delivery_charge) : null;
  const discount = n(o.discount);
  const total = n(o.total_price) || Math.max(0, subtotal + (delivery || 0) - discount);
  return { ...o, items, subtotal, delivery_charge: delivery, discount, total: total, qty_total: items.reduce((s, l) => s + (n(l.qty) || 0), 0) || n(o.quantity) || 0 };
}
