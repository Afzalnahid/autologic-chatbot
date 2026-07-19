export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";

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

async function isAdmin(email) {
  if (!email) return false;
  if (email === SUPER_ADMIN) return true;
  const { data } = await supabase.from("admin_users").select("role").eq("email", email).maybeSingle();
  return data && !["pending", "blocked"].includes(data.role);
}

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(email))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const [clientQ, channelsQ, msgsQ, ordersQ, bookingsQ, productsQ, filesQ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("channels").select("platform,page_id,status,connected_at").eq("client_id", id),
    supabase.from("message_buffer").select("role,created_at").eq("client_id", id),
    supabase.from("orders").select("order_code,customer_name,total_price,status,created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("bookings").select("customer_name,service_want,meeting_date,meeting_time,status,created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("products").select("metadata").eq("client_id", id).limit(200),
    supabase.from("file_registry").select("file_name,file_type,chunks,created_at").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  const client = clientQ.data;
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Strip sensitive tokens before returning.
  delete client.gcal_access_token;
  delete client.gcal_refresh_token;

  const msgs = msgsQ.data || [];
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const d7 = now - 7 * 86400000, d30 = now - 30 * 86400000;
  const inRange = (m, from) => new Date(m.created_at).getTime() > from;
  const byRole = (arr, r) => arr.filter((m) => (m.role || "customer") === r).length;

  const messages = {
    total: msgs.length,
    today: msgs.filter((m) => new Date(m.created_at) >= dayStart).length,
    week: msgs.filter((m) => inRange(m, d7)).length,
    month: msgs.filter((m) => inRange(m, d30)).length,
    customer: byRole(msgs, "customer"),
    bot: byRole(msgs, "bot"),
    agent: byRole(msgs, "agent"),
  };

  const products = (productsQ.data || []).map((p) => ({
    name: p.metadata?.name || p.metadata?.product_name || "Unnamed",
    price: p.metadata?.price || p.metadata?.selling_price || "",
    code: p.metadata?.code || p.metadata?.product_code || "",
  }));

  return NextResponse.json({
    client,
    channels: channelsQ.data || [],
    messages,
    orders: ordersQ.data || [],
    bookings: bookingsQ.data || [],
    products,
    files: filesQ.data || [],
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } });
}
