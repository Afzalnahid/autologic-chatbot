export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";
import { notifyNewAdminSignup, notifyAdminApproved, notifyPaymentApproved, notifyPaymentRejected } from "@/lib/email.js";
import { PLANS } from "@/lib/plans.js";

// Paid means "not the free trial and not nothing". Both places below used to
// test a list of three ids written here, so a client on any package created
// since — including the six that replaced those three — counted as unpaid:
// no days left on their plan, and missing from the MRR and paid-client totals.
const isPaidPlan = (p) => !!p && p !== "trial" && p !== "none";
import { loadPlans } from "@/lib/plan-limits.js";
import { startOfDayDhaka } from "@/lib/time.js";

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

// The super admin's second factor. Distinguishes the two failure modes so the
// owner can act on the error instead of retyping the key forever: a missing
// env var means EVERY attempt fails as "invalid key" no matter what is typed.
function checkSuperKey(request) {
  if (!process.env.ADMIN_PASSWORD) {
    return "The server has no ADMIN_PASSWORD configured. Add it in Vercel → Settings → Environment Variables, redeploy, then try again.";
  }
  const key = request.headers.get("x-admin-key") || "";
  if (key !== process.env.ADMIN_PASSWORD) return "The secret admin key you entered is wrong.";
  return null;
}

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);

  // Pending / blocked / no role: return identity + status only, no data.
  if (role === "pending" || role === "blocked" || !role) {
    return NextResponse.json({ role: role || "pending", email });
  }

  const [clientsQ, msgsQ, ordersQ, bookingsQ, channelsQ, filesQ, productsQ, contactsQ, payQ] = await Promise.all([
    supabase.from("clients").select("id,owner_email,business_name,business_type,plan,trial_end,plan_expires_at,suspended,created_at,gcal_connected,logo_url,phone,address,website"),
    supabase.from("message_buffer").select("client_id,created_at,role,platform"),
    supabase.from("orders").select("client_id,created_at,total_price,status,customer_name,order_code"),
    supabase.from("bookings").select("client_id,created_at,status,customer_name,meeting_date"),
    supabase.from("channels").select("client_id,platform,status,connected_at"),
    supabase.from("file_registry").select("client_id"),
    supabase.from("products").select("client_id"),
    supabase.from("contacts").select("client_id"),
    supabase.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const clients = clientsQ.data || [], msgs = msgsQ.data || [], orders = ordersQ.data || [];
  const bookings = bookingsQ.data || [], channels = channelsQ.data || [], files = filesQ.data || [];
  const products = productsQ.data || [], contacts = contactsQ.data || [], payRows = payQ.data || [];
  const now = Date.now(), DAY = 86400000;
  const d1 = now - DAY, d7 = now - 7 * DAY, d14 = now - 14 * DAY, d30 = now - 30 * DAY;
  const dayStart = startOfDayDhaka().getTime();
  const ts = (x) => new Date(x.created_at).getTime();
  const after = (arr, t) => arr.filter((x) => ts(x) > t);
  const between = (arr, a, b) => arr.filter((x) => { const t = ts(x); return t > a && t <= b; });

  // Per-client counters, one pass each instead of a filter per client.
  const tally = (arr, pick) => { const m = new Map(); for (const x of arr) { const k = x.client_id; if (!m.has(k)) m.set(k, 0); if (!pick || pick(x)) m.set(k, m.get(k) + 1); } return m; };
  // The "messages" a client is credited with = what the BOT replied. A reply the
  // owner typed by hand (role "agent") is NOT the bot working and must not be
  // counted (owner's rule 2026-09-08); customer messages are traffic, not the
  // bot's output. Both still SHOW in the conversation view — this only changes
  // the number. (One bot reply is several rows here: a photo + text + question,
  // so this is "bubbles the bot sent", not reply turns — fine for an activity
  // figure; the plan LIMIT counts turns separately.)
  const botMsgs = msgs.filter((x) => (x.role || "customer") === "bot");
  const mAll = tally(botMsgs), m7 = tally(botMsgs, (x) => ts(x) > d7), m30 = tally(botMsgs, (x) => ts(x) > d30), mToday = tally(botMsgs, (x) => ts(x) >= dayStart);
  const mPrev7 = tally(botMsgs, (x) => { const t = ts(x); return t > d14 && t <= d7; });
  const oAll = tally(orders), o7 = tally(orders, (x) => ts(x) > d7), bAll = tally(bookings), b7 = tally(bookings, (x) => ts(x) > d7);
  const pAll = tally(products), fAll = tally(files), cAll = tally(contacts);
  const lastActive = new Map();
  for (const x of msgs) { const t = ts(x); if (!lastActive.has(x.client_id) || lastActive.get(x.client_id) < t) lastActive.set(x.client_id, t); }
  const chByClient = new Map();
  for (const ch of channels) { if (!chByClient.has(ch.client_id)) chByClient.set(ch.client_id, []); chByClient.get(ch.client_id).push({ platform: ch.platform, status: ch.status, connected_at: ch.connected_at }); }
  const g = (m, id) => m.get(id) || 0;
  const daysLeft = (iso) => iso ? Math.ceil((new Date(iso).getTime() - now) / DAY) : null;

  const rows = clients.map((c) => ({
    ...c,
    messages: g(mAll, c.id), messages_7d: g(m7, c.id), messages_30d: g(m30, c.id), messages_today: g(mToday, c.id), messages_prev7: g(mPrev7, c.id),
    orders: g(oAll, c.id), orders_7d: g(o7, c.id), bookings: g(bAll, c.id), bookings_7d: g(b7, c.id),
    products: g(pAll, c.id), kb_files: g(fAll, c.id), contacts: g(cAll, c.id),
    channels: chByClient.get(c.id) || [],
    last_active: lastActive.has(c.id) ? new Date(lastActive.get(c.id)).toISOString() : null,
    trial_days_left: c.plan === "trial" ? daysLeft(c.trial_end) : null,
    plan_days_left: isPaidPlan(c.plan) ? daysLeft(c.plan_expires_at) : null,
    pending_payment: payRows.some((p) => p.client_id === c.id && p.status === "pending"),
  }));

  // Recurring revenue estimate from active paid plans (monthly price; the
  // catalogue is the single source of truth). Revenue = approved payments.
  const monthlyOf = (plan) => Number(PLANS[plan]?.monthly || 0);
  const paid = rows.filter((c) => isPaidPlan(c.plan) && !c.suspended && (c.plan_days_left === null || c.plan_days_left > 0));
  const approved = payRows.filter((p) => p.status === "approved");
  const sum = (arr) => arr.reduce((n, p) => n + Number(p.amount || 0), 0);
  const revenue_30d = sum(approved.filter((p) => new Date(p.reviewed_at || p.created_at).getTime() > d30));
  const revenue_prev30 = sum(approved.filter((p) => { const t = new Date(p.reviewed_at || p.created_at).getTime(); return t > now - 60 * DAY && t <= d30; }));

  // Daily series for the last 14 days (Dhaka days), oldest first.
  const series = (arr, days = 14) => {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = dayStart - i * DAY, end = start + DAY;
      out.push({ day: new Date(start).toISOString().slice(0, 10), value: between(arr, start - 1, end - 1).length });
    }
    return out;
  };
  const platformMix = {};
  for (const ch of channels) if (ch.status === "connected") platformMix[ch.platform] = (platformMix[ch.platform] || 0) + 1;
  const msgPlatform = {};
  for (const m of after(msgs, d30)) { const k = m.platform || "unknown"; msgPlatform[k] = (msgPlatform[k] || 0) + 1; }
  const planMix = {};
  for (const c of clients) planMix[c.plan || "none"] = (planMix[c.plan || "none"] || 0) + 1;

  const overview = {
    total_clients: clients.length,
    new_clients_7d: after(clients, d7).length, new_clients_prev7: between(clients, d14, d7).length, new_clients_30d: after(clients, d30).length,
    plan_mix: planMix,
    trial: planMix.trial || 0, starter: planMix.starter || 0, pro: planMix.pro || 0, agency: planMix.agency || 0, none: planMix.none || 0,
    paid_clients: paid.length, suspended: rows.filter((c) => c.suspended).length,
    ecommerce: clients.filter((c) => c.business_type !== "agency").length, agencies: clients.filter((c) => c.business_type === "agency").length,
    // Totals mirror the per-client figure above: bot replies only, never a
    // hand-typed (agent) reply. customer_messages_7d stays as the separate,
    // explicitly-labelled traffic figure.
    total_messages: botMsgs.length, messages_today: botMsgs.filter((m) => ts(m) >= dayStart).length,
    messages_7d: after(botMsgs, d7).length, messages_prev7: between(botMsgs, d14, d7).length, messages_30d: after(botMsgs, d30).length,
    customer_messages_7d: after(msgs, d7).filter((m) => (m.role || "customer") === "customer").length,
    total_orders: orders.length, orders_7d: after(orders, d7).length, orders_prev7: between(orders, d14, d7).length,
    total_bookings: bookings.length, bookings_7d: after(bookings, d7).length, bookings_prev7: between(bookings, d14, d7).length,
    total_contacts: contacts.length, total_products: products.length, total_kb_files: files.length,
    connected_channels: channels.filter((ch) => ch.status === "connected").length, platform_mix: platformMix, message_platform_30d: msgPlatform,
    mrr: paid.reduce((n, c) => n + monthlyOf(c.plan), 0), revenue_30d, revenue_prev30,
    pending_payments: payRows.filter((p) => p.status === "pending").length,
    series: { messages: series(msgs), signups: series(clients), orders: series(orders), bookings: series(bookings) },
  };

  // What needs a human today, most urgent first.
  const attention = [];
  const money = (n) => "\u09F3" + Number(n || 0).toLocaleString("en-IN");
  for (const p of payRows.filter((p) => p.status === "pending")) attention.push({ kind: "payment", level: "high", client_id: p.client_id, title: "Payment waiting for review", sub: `${p.plan} · ${money(p.amount)} via ${p.method}`, at: p.created_at });
  for (const c of rows) {
    const who = c.business_name || c.owner_email;
    if (c.plan === "trial" && c.trial_days_left !== null && c.trial_days_left <= 2) attention.push({ kind: "trial", level: c.trial_days_left <= 0 ? "high" : "mid", client_id: c.id, title: c.trial_days_left <= 0 ? "Trial expired" : `Trial ends in ${c.trial_days_left} day${c.trial_days_left === 1 ? "" : "s"}`, sub: who, at: c.trial_end });
    if (c.plan_days_left !== null && c.plan_days_left <= 7) attention.push({ kind: "expiry", level: c.plan_days_left <= 0 ? "high" : "mid", client_id: c.id, title: c.plan_days_left <= 0 ? `${c.plan} plan expired` : `${c.plan} plan ends in ${c.plan_days_left} day${c.plan_days_left === 1 ? "" : "s"}`, sub: who, at: c.plan_expires_at });
    if (c.suspended) attention.push({ kind: "suspended", level: "mid", client_id: c.id, title: "Account suspended", sub: who, at: c.created_at });
    if (!c.channels.some((ch) => ch.status === "connected") && ts(c) < d1) attention.push({ kind: "nochannel", level: "low", client_id: c.id, title: "No channel connected", sub: `${who} · joined ${new Date(c.created_at).toLocaleDateString("en-GB")}`, at: c.created_at });
    else if (c.channels.some((ch) => ch.status === "connected") && c.messages_7d === 0 && c.messages > 0) attention.push({ kind: "quiet", level: "low", client_id: c.id, title: "No messages in 7 days", sub: who, at: c.last_active });
  }
  const rank = { high: 0, mid: 1, low: 2 };
  attention.sort((a, b) => rank[a.level] - rank[b.level] || new Date(b.at || 0) - new Date(a.at || 0));

  // One feed of what happened lately across the platform.
  const nameOf = new Map(clients.map((c) => [c.id, c.business_name || c.owner_email]));
  const activity = [
    ...clients.map((c) => ({ kind: "signup", at: c.created_at, client_id: c.id, title: `${c.business_name || c.owner_email} signed up`, sub: c.business_type === "agency" ? "Agency" : "E-commerce" })),
    ...payRows.map((p) => ({ kind: "payment", at: p.created_at, client_id: p.client_id, title: `${nameOf.get(p.client_id) || "Unknown"} paid ${money(p.amount)}`, sub: `${p.plan} · ${p.method} · ${p.status}` })),
    ...orders.map((o) => ({ kind: "order", at: o.created_at, client_id: o.client_id, title: `Order for ${nameOf.get(o.client_id) || "Unknown"}`, sub: `${o.customer_name || "Customer"}${o.total_price ? ` · ${money(o.total_price)}` : ""}` })),
    ...bookings.map((b) => ({ kind: "booking", at: b.created_at, client_id: b.client_id, title: `Booking for ${nameOf.get(b.client_id) || "Unknown"}`, sub: `${b.customer_name || "Customer"}${b.meeting_date ? ` · ${b.meeting_date}` : ""}` })),
    ...channels.filter((ch) => ch.connected_at).map((ch) => ({ kind: "channel", at: ch.connected_at, client_id: ch.client_id, title: `${nameOf.get(ch.client_id) || "Unknown"} connected ${ch.platform}`, sub: ch.status })),
  ].filter((a) => a.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const payments = payRows.map((p) => {
    const c = clientById.get(p.client_id);
    return { ...p, business_name: c?.business_name || "Unknown", owner_email: c?.owner_email || "" };
  });

  let admins = null;
  if (role === "super") {
    const { data } = await supabase.from("admin_users").select("*").order("created_at", { ascending: true });
    admins = data || [];
  }

  // The package catalogue, so the console can offer what actually exists.
  // Every plan list in the panel used to be written out by hand — trial,
  // starter, pro, agency — which meant a package created in the panel could
  // never be assigned to a client from it, and the seven that replaced those
  // four would not have appeared at all.
  //
  // Retired packages are included: a client already on one must still read as
  // its own name, and the dropdown has to be able to show what they are on.
  const catalogue = Object.values(await loadPlans())
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
    .map((p) => ({ id: p.id, name: p.name, biz: p.biz || "both", active: p.active !== false, monthly: Number(p.monthly) || 0,
      // The capability switches this package grants, so the client list can show
      // which features each account gets without a per-client query.
      features: p.features || {} }));

  return NextResponse.json(
    { role, email, overview, clients: rows, admins, payments, attention, activity, plans: catalogue, server_time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
  );
}

export async function PUT(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  const body = await request.json().catch(() => ({}));

  if (body.type === "set_role") {
    if (role !== "super") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const keyErr = checkSuperKey(request);
    if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });
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

  // BYOK permission. The super admin does not touch keys: "allow" opens the
  // API-key box in the client's own dashboard (they paste the key there);
  // "revoke" closes it and deletes whatever key they had saved. Guarded by
  // the same secret key as role changes.
  if (body.type === "ai_key") {
    if (role !== "super") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const keyErr = checkSuperKey(request);
    if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });
    const { client_id, action } = body;
    if (!client_id) return NextResponse.json({ error: "missing client" }, { status: 400 });

    if (action === "allow") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("client_ai").upsert(
        { client_id, status: "no_key", created_by: email, updated_at: now },
        { onConflict: "client_id", ignoreDuplicates: true }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (action === "revoke") {
      const { error } = await supabase.from("client_ai").delete().eq("client_id", client_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }

  // Remove an admin entirely — super admin only, requires secret key.
  if (body.type === "remove_admin") {
    if (role !== "super") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const keyErr = checkSuperKey(request);
    if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });
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

  // Verify or reject a client payment.
  if (body.type === "payment") {
    if (!CAN_EDIT.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { request_id, decision, note } = body;
    if (!request_id || !["approve", "reject"].includes(decision))
      return NextResponse.json({ error: "bad request" }, { status: 400 });

    const { data: pr } = await supabase.from("payment_requests").select("*").eq("id", request_id).single();
    if (!pr) return NextResponse.json({ error: "request not found" }, { status: 404 });
    if (pr.status !== "pending") return NextResponse.json({ error: "already reviewed" }, { status: 409 });

    const { data: cl } = await supabase.from("clients").select("*").eq("id", pr.client_id).single();

    if (decision === "approve") {
      // Extend from the current expiry when the plan is still running, otherwise from today.
      const current = cl?.plan_expires_at ? new Date(cl.plan_expires_at) : null;
      const base = current && current > new Date() ? current : new Date();
      base.setDate(base.getDate() + (pr.billing_cycle === "yearly" ? 365 : 30));

      const { error: upErr } = await supabase.from("clients")
        .update({ plan: pr.plan, plan_expires_at: base.toISOString(), suspended: false })
        .eq("id", pr.client_id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      await supabase.from("payment_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: email })
        .eq("id", request_id);

      if (cl?.owner_email) {
        notifyPaymentApproved(cl.owner_email, pr.plan, base.toISOString()).catch(() => {});
      }
      return NextResponse.json({ ok: true, plan_expires_at: base.toISOString() });
    }

    await supabase.from("payment_requests")
      .update({ status: "rejected", admin_note: note || null, reviewed_at: new Date().toISOString(), reviewed_by: email })
      .eq("id", request_id);
    if (cl?.owner_email) notifyPaymentRejected(cl.owner_email, note || "").catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (!CAN_EDIT.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, action, value } = body;
  if (!id || !action) return NextResponse.json({ error: "missing id/action" }, { status: 400 });
  let patch = null;
  if (action === "plan") {
    // Any catalogue plan (from the live plans table, so admin-created packages
    // are assignable). Moving onto a paid plan by hand starts a 30-day term from
    // today unless one is still running; back to trial clears it.
    const catalogue = await loadPlans();
    const plan = (value === "trial" || (catalogue[value] && catalogue[value].active !== false)) ? value : "trial";
    patch = { plan };
    if (plan === "trial") patch.plan_expires_at = null;
    else {
      const { data: c } = await supabase.from("clients").select("plan_expires_at").eq("id", id).single();
      const cur = c?.plan_expires_at ? new Date(c.plan_expires_at) : null;
      if (!(cur && cur > new Date())) { const b = new Date(); b.setDate(b.getDate() + 30); patch.plan_expires_at = b.toISOString(); }
      patch.suspended = false;
    }
  } else if (action === "extend_plan") {
    const { data: c } = await supabase.from("clients").select("plan_expires_at").eq("id", id).single();
    const base = c?.plan_expires_at && new Date(c.plan_expires_at) > new Date() ? new Date(c.plan_expires_at) : new Date();
    base.setDate(base.getDate() + (parseInt(value, 10) || 30));
    patch = { plan_expires_at: base.toISOString() };
  } else if (action === "extend_trial") {
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

// Remove the Supabase Auth user for an email, so a deleted account is truly
// gone. Without this the login (email + password) survived, and signing back in
// found no client row — which the dashboard treats as an incomplete signup and
// silently RE-CREATES the account, dropping the person into onboarding. So a
// "deleted" account kept coming back. Best-effort: the client rows are already
// gone by the time this runs, so a failure here is logged, not fatal.
// Removes the login itself. Returns { removed, reason } rather than swallowing
// a failure: the client's rows are gone by the time this runs, so the panel
// must not say "deleted" while the person can still sign in — and signing in
// with no client row silently creates a NEW one with a fresh trial
// (loadMe in dashboard-client.js). A quiet failure here is invisible until
// somebody counts the logins against the clients, which is how the nine
// pre-2026-09-10 leftovers were found.
async function deleteAuthUserByEmail(email) {
  const e = (email || "").toLowerCase();
  if (!e) return { removed: false, reason: "this client had no owner email" };
  try {
    let page = 1, uid = null;
    while (page <= 10 && !uid) {
      const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return { removed: false, reason: error.message };
      const users = list?.users || [];
      const match = users.find((u) => (u.email || "").toLowerCase() === e);
      if (match) uid = match.id;
      if (users.length < 200) break;
      page++;
    }
    // Nothing to remove is a clean outcome, not a failure: the login may have
    // been deleted in Supabase already.
    if (!uid) return { removed: true, absent: true };
    const { error: delErr } = await supabase.auth.admin.deleteUser(uid);
    if (delErr) return { removed: false, reason: delErr.message };
    return { removed: true };
  } catch (err) {
    return { removed: false, reason: err.message };
  }
}

// The two storage buckets keep a folder per client. A database cascade cannot
// reach them, so they are emptied here — and any failure is reported rather
// than swallowed, because a deleted customer's photographs and documents
// sitting in storage is the kind of thing nobody discovers by looking.
async function deleteClientFiles(clientId) {
  const problems = [];
  for (const bucket of ["knowledge-files", "product-images"]) {
    try {
      let offset = 0;
      for (;;) {
        const { data: objs, error } = await supabase.storage.from(bucket).list(String(clientId), { limit: 100, offset });
        if (error) { problems.push(`${bucket}: ${error.message}`); break; }
        const names = objs || [];
        if (!names.length) break;
        const { error: rmErr } = await supabase.storage.from(bucket).remove(names.map((o) => `${clientId}/${o.name}`));
        if (rmErr) { problems.push(`${bucket}: ${rmErr.message}`); break; }
        if (names.length < 100) break;
        offset += 100;   // removed ones are gone, but a folder can hold more
      }
    } catch (e) {
      problems.push(`${bucket}: ${e.message}`);
    }
  }
  return problems;
}

export async function DELETE(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, confirm } = await request.json().catch(() => ({}));
  if (!id || confirm !== "DELETE") return NextResponse.json({ error: "missing id or confirm" }, { status: 400 });
  // Read the owner's email before the row is gone, so the login can be removed too.
  const { data: cl } = await supabase.from("clients").select("owner_email").eq("id", id).maybeSingle();

  // Deleting the row deletes the rest. All 21 tables that carry a client_id
  // now have ON DELETE CASCADE (docs/sql/2026-09-24-delete-a-client-means-
  // delete-everything.sql). Six of them used to be listed here by hand, which
  // named less than a third and could never keep up with a table added later —
  // comments, processed_comments and usage_daily were all being left behind.
  // The rule belongs to the database, where no route can forget it.
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fileProblems = await deleteClientFiles(id);
  // Now the login itself, so the account cannot sign back in and re-create.
  const login = await deleteAuthUserByEmail(cl?.owner_email);

  const left = [];
  if (!login.removed) {
    left.push(`the login could not be removed (${login.reason}) — that person can still sign in, and would get a brand-new trial. Remove them in Supabase → Authentication → Users`);
  }
  if (fileProblems.length) left.push(`some uploaded files are still in storage (${fileProblems.join("; ")})`);
  if (left.length) {
    console.error("[admin delete] incomplete:", left.join(" | "));
    return NextResponse.json({ ok: true, warning: "The business and its data were deleted, but " + left.join(", and ") + "." });
  }
  return NextResponse.json({ ok: true });
}
