export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";

export const GET = withErrors(async (request) => {
  const { client, email, error: authErr } = await requireClient(request);
  if (authErr) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!client) return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  const usage = await getUsage(client);
  return NextResponse.json({
    email,
    client_id: client.id,
    business_name: client.business_name,
    phone: client.phone || "",
    address: client.address || "",
    website: client.website || "",
    business_type: client.business_type || "ecommerce",
    item_label: client.item_label || "",
    logo_url: client.logo_url || "",
    plan: client.plan,
    trial_end: client.trial_end,
    created_at: client.created_at,
    usage,
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache", "Expires": "0" } });
}, "profile");

export const PUT = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!client) return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  const b = await request.json();
  const patch = {};
  for (const k of ["business_name", "phone", "address", "website", "business_type", "item_label"]) {
    if (typeof b[k] === "string") patch[k] = b[k];
  }
  const { error } = await supabase.from("clients").update(patch).eq("id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}, "profile");

async function getUsage(client) {
  const { count: products } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("client_id", client.id);
  const { count: orders } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("client_id", client.id);
  const { count: channels } = await supabase.from("channels").select("id", { count: "exact", head: true }).eq("client_id", client.id);
  return { products: products || 0, orders: orders || 0, channels: channels || 0 };
}
