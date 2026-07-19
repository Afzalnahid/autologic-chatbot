export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";
import { notifyNewAdminSignup, notifyAdminApproved } from "@/lib/email.js";

const SUPER_ADMIN = "nahidafzal97@gmail.com";

async function callerEmail(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cchvsgouqqxibhubioch.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_L0-ea26IunVN_BET5SPXOw_VY_KwGZg"
  );
  const { data } = await anon.auth.getUser(token);
  return (data?.user?.email || "").toLowerCase() || null;
}

async function callerRole(email) {
  if (!email) return null;
  if (email === SUPER_ADMIN) return "super";
  const { data } = await supabase.from("admin_users").select("role").eq("email", email).maybeSingle();
  if (!data) {
    await supabase.from("admin_users").insert({ email, role: "pending" });
    // Notify super admin of the new access request (fire-and-forget).
    notifyNewAdminSignup(email).catch(() => {});
    return "pending";
  }
  return data.role;
}

const CAN_EDIT = ["super", "full", "editor"];
const CAN_DELETE = ["super", "full"];

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);

  // Pending / blocked / no role: return identity + status only, no data.
  if (role === "pending" || role === "blocked" || !role) {
    return NextResponse.json({ role: role || "pending", email });
  }

  const [clientsQ, msgsQ, ordersQ, bookingsQ, channelsQ, filesQ, productsQ] = await Promise.all([
    supabase.from("clients").select("id,owner_email,business_name,business_type,plan,trial_end,suspended,created_at,gcal_connected"),
    supabase.from("message_buffer").select("client_id,created_at"),
    supabase.from("orders").select("client_id"),
    supabase.from("bookings").select("client_id"),
    supabase.from("channels").select("client_id,platform,status"),
    supabase.from("file_registry").select("client_id"),
    supabase.from("products").select("client_id"),
  ]);

  const clients = clientsQ.data || [], msgs = msgsQ.data || [], orders = ordersQ.data || [];
  const bookings = bookingsQ.data || [], channels = channelsQ.data || [], files = filesQ.data || [], products = productsQ.data || [];
  const now = Date.now(), d7 = now - 7 * 86400000;
  const cnt = (arr, id) => arr.filter((x) => x.client_id === id).length;

  const rows = clients.map((c) => ({
    ...c,
    messages: cnt(msgs, c.id),
    messages_7d: msgs.filter((m) => m.client_id === c.id && new Date(m.created_at).getTime() > d7).length,
    orders: cnt(orders, c.id), bookings: cnt(bookings, c.id),
    products: cnt(products, c.id), kb_files: cnt(files, c.id),
    channels: channels.filter((ch) => ch.client_id === c.id).map((ch) => ({ platform: ch.platform, status: ch.status })),
  }));

  const overview = {
    total_clients: clients.length,
    trial: clients.filter((c) => c.plan === "trial").length,
    pro: clients.filter((c) => c.plan === "pro").length,
    suspended: clients.filter((c) => c.suspended).length,
    total_messages: msgs.length,
    messages_7d: msgs.filter((m) => new Date(m.created_at).getTime() > d7).length,
    total_orders: orders.length, total_bookings: bookings.length,
    connected_channels: channels.filter((ch) => ch.status === "connected").length,
  };

  let admins = null;
  if (role === "super") {
    const { data } = await supabase.from("admin_users").select("*").order("created_at", { ascending: true });
    admins = data || [];
  }

  return NextResponse.json({ role, email, overview, clients: rows, admins });
}

export async function PUT(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  const body = await request.json().catch(() => ({}));

  if (body.type === "set_role") {
    if (role !== "super") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const key = request.headers.get("x-admin-key") || "";
    if (key !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "invalid key" }, { status: 403 });
    const { target_email, new_role } = body;
    if (!target_email || !["full", "editor", "viewer", "pending", "blocked"].includes(new_role))
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    if (target_email.toLowerCase() === SUPER_ADMIN)
      return NextResponse.json({ error: "cannot change super admin" }, { status: 400 });
    const { error } = await supabase.from("admin_users")
      .update({ role: new_role, updated_at: new Date().toISOString() })
      .eq("email", target_email.toLowerCase());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Congratulate the admin when granted an active role (not on revoke to pending/blocked).
    if (["full", "editor", "viewer"].includes(new_role)) {
      notifyAdminApproved(target_email.toLowerCase(), new_role).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // Remove an admin entirely — super admin only, requires secret key.
  if (body.type === "remove_admin") {
    if (role !== "super") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const key = request.headers.get("x-admin-key") || "";
    if (key !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "invalid key" }, { status: 403 });
    const { target_email } = body;
    if (!target_email) return NextResponse.json({ error: "missing target" }, { status: 400 });
    const tEmail = target_email.toLowerCase();
    if (tEmail === SUPER_ADMIN)
      return NextResponse.json({ error: "cannot remove super admin" }, { status: 400 });

    // 1) Remove the admin role row.
    const { error } = await supabase.from("admin_users").delete().eq("email", tEmail);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 2) Also delete the Supabase Auth account so the person can sign up fresh.
    //    Only delete if this email is NOT also a platform client (owner_email),
    //    to avoid destroying a real dashboard user who happens to be an admin.
    try {
      const { data: asClient } = await supabase.from("clients").select("id").eq("owner_email", tEmail).maybeSingle();
      if (!asClient) {
        let page = 1;
        let uid = null;
        while (page <= 10 && !uid) {
          const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
          const users = list?.users || [];
          const match = users.find((u) => (u.email || "").toLowerCase() === tEmail);
          if (match) uid = match.id;
          if (users.length < 200) break;
          page++;
        }
        if (uid) await supabase.auth.admin.deleteUser(uid);
      }
    } catch (e) {
      // Auth cleanup is best-effort; the role removal above already succeeded.
      console.error("auth delete:", e.message);
    }

    return NextResponse.json({ ok: true });
  }

  if (!CAN_EDIT.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, action, value } = body;
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
}

export async function DELETE(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, confirm } = await request.json().catch(() => ({}));
  if (!id || confirm !== "DELETE") return NextResponse.json({ error: "missing id or confirm" }, { status: 400 });
  for (const t of ["message_buffer", "chat_memory", "orders", "contacts", "channels", "products"]) {
    await supabase.from(t).delete().eq("client_id", id);
  }
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
