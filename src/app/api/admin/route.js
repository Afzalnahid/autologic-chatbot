export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";

// Two-layer admin auth:
// 1) Valid Supabase session whose email is in ADMIN_EMAILS (comma separated)
// 2) x-admin-key header must match ADMIN_PASSWORD
async function requireAdmin(request) {
  const key = request.headers.get("x-admin-key") || "";
  if (!key || key !== process.env.ADMIN_PASSWORD) return null;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cchvsgouqqxibhubioch.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_L0-ea26IunVN_BET5SPXOw_VY_KwGZg"
  );
  const { data } = await anon.auth.getUser(token);
  const email = (data?.user?.email || "").toLowerCase();
  if (!email) return null;

  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email)) return null;
  return email;
}

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [clientsQ, msgsQ, ordersQ, bookingsQ, channelsQ, filesQ, productsQ] = await Promise.all([
    supabase.from("clients").select("id,owner_email,business_name,business_type,plan,trial_end,suspended,created_at,gcal_connected"),
    supabase.from("message_buffer").select("client_id,role,created_at"),
    supabase.from("orders").select("client_id"),
    supabase.from("bookings").select("client_id"),
    supabase.from("channels").select("client_id,platform,status"),
    supabase.from("file_registry").select("client_id,chunks"),
    supabase.from("products").select("client_id"),
  ]);

  const clients = clientsQ.data || [];
  const msgs = msgsQ.data || [];
  const orders = ordersQ.data || [];
  const bookings = bookingsQ.data || [];
  const channels = channelsQ.data || [];
  const files = filesQ.data || [];
  const products = productsQ.data || [];

  const now = Date.now();
  const d7 = now - 7 * 86400000;
  const count = (arr, id) => arr.filter((x) => x.client_id === id).length;

  const rows = clients.map((c) => ({
    ...c,
    messages: count(msgs, c.id),
    messages_7d: msgs.filter((m) => m.client_id === c.id && new Date(m.created_at).getTime() > d7).length,
    orders: count(orders, c.id),
    bookings: count(bookings, c.id),
    products: count(products, c.id),
    kb_files: count(files, c.id),
    channels: channels
      .filter((ch) => ch.client_id === c.id)
      .map((ch) => ({ platform: ch.platform, status: ch.status })),
  }));

  const overview = {
    total_clients: clients.length,
    trial: clients.filter((c) => c.plan === "trial").length,
    pro: clients.filter((c) => c.plan === "pro").length,
    suspended: clients.filter((c) => c.suspended).length,
    total_messages: msgs.length,
    messages_7d: msgs.filter((m) => new Date(m.created_at).getTime() > d7).length,
    total_orders: orders.length,
    total_bookings: bookings.length,
    connected_channels: channels.filter((ch) => ch.status === "connected").length,
  };

  return NextResponse.json({ overview, clients: rows });
}

export async function PUT(request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id, action, value } = await request.json();
    if (!id || !action) return NextResponse.json({ error: "missing id/action" }, { status: 400 });

    let patch = null;
    if (action === "plan") patch = { plan: value === "pro" ? "pro" : "trial" };
    else if (action === "extend_trial") {
      const { data: c } = await supabase.from("clients").select("trial_end").eq("id", id).single();
      const base = c?.trial_end && new Date(c.trial_end) > new Date() ? new Date(c.trial_end) : new Date();
      base.setDate(base.getDate() + (parseInt(value, 10) || 7));
      patch = { trial_end: base.toISOString() };
    } else if (action === "suspend") patch = { suspended: !!value };
    else return NextResponse.json({ error: "unknown action" }, { status: 400 });

    const { error } = await supabase.from("clients").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id, confirm } = await request.json();
    if (!id || confirm !== "DELETE") return NextResponse.json({ error: "missing id or confirm" }, { status: 400 });

    // clients has ON DELETE CASCADE on knowledge_base, file_registry, bookings.
    // Clean the rest explicitly.
    for (const t of ["message_buffer", "chat_memory", "orders", "contacts", "channels", "products"]) {
      await supabase.from(t).delete().eq("client_id", id);
    }
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
