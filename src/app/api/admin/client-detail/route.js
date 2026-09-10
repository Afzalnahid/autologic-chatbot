export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { startOfDayDhaka, startOfMonthDhaka } from "@/lib/time.js";
import { countBillableMessages } from "@/lib/message-usage.js";
import { featureList } from "@/lib/features.js";

const SUPER_ADMIN = "nahidafzal97@gmail.com";

// Everything the Manage card needs to describe a subscription rather than just
// offer buttons that change one.
//
// The money comes from APPROVED payment requests only — a submitted-but-
// unverified one is not revenue, and counting it would overstate what this
// client has actually paid.
//
// The usage figures are measured against the package's own limits, so the
// question the panel exists to answer — "should this client move up?" — can be
// read off the screen instead of guessed at.
async function subscriptionOf(client, payments, used) {
  if (!client) return null;
  const { limitsFor, quotaWindowStart } = await import("@/lib/plan-limits.js");
  const limits = await limitsFor(client);
  const isTrial = client.plan === "trial";

  // Broadcasts and website imports, over the plan's window (trial → the trial,
  // else the month) — the two meters the drawer was missing. Each fails soft so
  // a hiccup on one never blanks the card.
  const winSince = quotaWindowStart(client);
  const soft = async (p) => { try { return await p; } catch { return null; } };
  const [bcUsed, scrapeRows] = await Promise.all([
    soft(supabase.from("broadcasts").select("id", { count: "exact", head: true })
      .eq("client_id", client.id).gte("created_at", winSince).then((r) => (r.error ? null : (r.count || 0)))),
    soft(supabase.from("usage_daily").select("calls").eq("client_id", client.id).eq("kind", "scrape")
      .gte("day", String(winSince).slice(0, 10)).limit(2000).then((r) => (r.error ? null : r.data))),
  ]);
  const scrapesUsed = Array.isArray(scrapeRows) ? scrapeRows.reduce((n, r) => n + (r.calls || 0), 0) : null;

  const paid = (payments || []).filter((p) => p.status === "approved");
  const last = paid[0] || null;   // payQ is newest first
  const totalPaid = paid.reduce((n, p) => n + (Number(p.amount) || 0), 0);

  const expiresAt = isTrial ? client.trial_end : client.plan_expires_at;
  const daysLeft = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  // Messages against the allowance, counted over the period the plan is
  // actually metered on — a trial by the day, a package by the month. An
  // exact count rather than a row read, so it cannot be capped.
  const since = isTrial ? startOfDayDhaka() : startOfMonthDhaka();
  // Bot replies against the allowance — the same measure the limit enforces.
  const usedMsgs = await countBillableMessages(client.id, since.toISOString());

  return {
    plan: client.plan,
    plan_name: limits.planName,
    monthly: limits.monthly, yearly: limits.yearly,
    is_trial: isTrial,
    suspended: !!client.suspended,
    started_at: isTrial ? client.trial_start : (paid.length ? paid[paid.length - 1].created_at : null),
    expires_at: expiresAt || null,
    days_left: daysLeft,
    // Which capability features this package grants (on/off), filtered to the
    // client's business type. Pure — the same labelled list the client's own
    // dashboard shows, so the two never disagree.
    features: featureList(limits.features, client.business_type),
    // null limit means unlimited, and the panel must show that rather than 0.
    usage: {
      period: isTrial ? "day" : "month",
      messages: { used: usedMsgs || 0, limit: isTrial ? limits.messagesPerDay : limits.messagesPerMonth },
      channels: { used: used.channels, limit: limits.channels },
      products: { used: used.products, limit: limits.maxProducts },
      documents: { used: used.files, limit: limits.maxKbFiles },
      broadcasts: { used: bcUsed, limit: limits.maxBroadcastsPerMonth },
      scrapes: { used: scrapesUsed, limit: limits.maxScrapesPerMonth },
    },
    payments: {
      count: paid.length,
      total: totalPaid,
      last: last ? { amount: Number(last.amount) || 0, method: last.method, txn_id: last.txn_id, cycle: last.billing_cycle, at: last.created_at } : null,
      pending: (payments || []).filter((p) => p.status === "pending").length,
    },
  };
}

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

export const GET = withErrors(async (request) => {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(email))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const [clientQ, channelsQ, msgsQ, msgTotalQ, ordersQ, bookingsQ, productsQ, filesQ, payQ, contactsQ, settingsQ, aiQ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("channels").select("platform,page_id,name,status,connected_at").eq("client_id", id),
    // Only the window the figures below actually cover. This used to ask for
    // EVERY message this client has ever had, on every drawer open — which
    // grows without bound and, past db-max-rows, comes back short with no
    // error, so "total" and the 14-day chart were both quietly wrong for
    // exactly the busiest clients. The lifetime total is a COUNT now (no row
    // cap), and these rows only have to answer for the last 30 days.
    supabase.from("message_buffer").select("role,created_at,platform")
      .eq("client_id", id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(20000),
    supabase.from("message_buffer").select("id", { count: "exact", head: true }).eq("client_id", id),
    supabase.from("orders").select("order_code,customer_name,total_price,status,created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("bookings").select("customer_name,service_want,meeting_date,meeting_time,status,created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("products").select("metadata").eq("client_id", id).limit(200),
    supabase.from("file_registry").select("file_name,file_type,chunks,created_at").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("payment_requests").select("id,plan,billing_cycle,amount,method,txn_id,status,created_at,reviewed_at,reviewed_by,admin_note").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("contacts").select("sender_id", { count: "exact", head: true }).eq("client_id", id),
    supabase.from("app_settings").select("settings").eq("id", String(id)).maybeSingle(),
    supabase.from("client_ai").select("provider,model,key_mask,status,last_verified_at,key_added_at,last_error,last_error_at,created_at").eq("client_id", id).maybeSingle(),
  ]);

  const client = clientQ.data;
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Strip sensitive tokens before returning.
  delete client.gcal_access_token;
  delete client.gcal_refresh_token;

  const msgs = msgsQ.data || [];
  const now = Date.now();
  const dayStart = startOfDayDhaka();
  const d7 = now - 7 * 86400000, d30 = now - 30 * 86400000;
  const inRange = (m, from) => new Date(m.created_at).getTime() > from;
  const byRole = (arr, r) => arr.filter((m) => (m.role || "customer") === r).length;

  const byPlatform = {};
  for (const m of msgs) { const k = m.platform || "unknown"; byPlatform[k] = (byPlatform[k] || 0) + 1; }
  // Last 14 days, oldest first, for the small chart in the drawer.
  const series = [];
  for (let i = 13; i >= 0; i--) { const s0 = dayStart.getTime() - i * 86400000, e0 = s0 + 86400000; series.push({ day: new Date(s0).toISOString().slice(0, 10), value: msgs.filter((m) => { const t = new Date(m.created_at).getTime(); return t >= s0 && t < e0; }).length }); }
  const messages = {
    // The lifetime figure comes from a count, not from the rows above — those
    // only reach back 30 days now. `total_window` says what the rest of this
    // object is measured over, so nothing here can be read as all-time.
    total: msgTotalQ.count ?? msgs.length,
    total_window_days: 30,
    by_platform: byPlatform, series,
    last_at: msgs.length ? msgs.reduce((a, m) => (new Date(m.created_at) > new Date(a) ? m.created_at : a), msgs[0].created_at) : null,
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
    payments: payQ.data || [],
    // What this account's subscription actually IS — the questions the Manage
    // card could not answer: what they are on, what it costs, when it started,
    // when it ends, what they have paid, and how much of the package they are
    // using. Without this the panel offered buttons to change a subscription
    // nobody could see.
    subscription: await subscriptionOf(client, payQ.data || [], {
      channels: (channelsQ.data || []).filter((ch) => ch.platform !== "website").length,
      products: products.length,
      files: (filesQ.data || []).length,
    }),
    contacts: contactsQ.count || 0,
    // Only the bot's public face — never the business prompt itself.
    settings: settingsQ.data?.settings ? { botName: settingsQ.data.settings.botName || null, greeting: settingsQ.data.settings.greeting || null, hasPrompt: !!settingsQ.data.settings.businessPrompt } : null,
    // BYOK config, masked, super admin only. `undefined` (stripped from the
    // JSON) tells the UI the caller may not even see the section.
    ai: email === SUPER_ADMIN ? (aiQ.data || null) : undefined,
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } });
}, "admin-client-detail");
