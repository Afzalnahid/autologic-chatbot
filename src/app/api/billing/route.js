export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { planActive } from "@/lib/plans.js";
import { loadPlans, limitsFor } from "@/lib/plan-limits.js";
import { notifyPaymentRequest } from "@/lib/email.js";
import { withErrors } from "@/lib/route-errors.js";
import { startOfDayDhaka, startOfMonthDhaka } from "@/lib/time.js";

const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } };

// Personal / merchant numbers the client sends money to. Configured per deployment.
function paymentMethods() {
  const list = [
    { id: "bkash", label: "bKash", number: process.env.PAYMENT_BKASH || "", type: "Send Money" },
    { id: "nagad", label: "Nagad", number: process.env.PAYMENT_NAGAD || "", type: "Send Money" },
    { id: "rocket", label: "Rocket", number: process.env.PAYMENT_ROCKET || "", type: "Send Money" },
  ].filter((m) => m.number);
  return list;
}

async function usageThisMonth(clientId) {
  const start = startOfMonthDhaka();
  const { count } = await supabase
    .from("message_buffer")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "customer")
    .gte("created_at", start.toISOString());
  return count || 0;
}

async function usageToday(clientId) {
  const start = startOfDayDhaka();
  const { count } = await supabase
    .from("message_buffer")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "customer")
    .gte("created_at", start.toISOString());
  return count || 0;
}

export const GET = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [limits, month, today, reqQ] = await Promise.all([
    limitsFor(client),
    usageThisMonth(client.id),
    usageToday(client.id),
    supabase.from("payment_requests").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const requests = reqQ.data || [];
  const pending = requests.find((r) => r.status === "pending") || null;

  // Limits merge the client's plan with any per-client override — the same
  // source the bot enforces — so the usage bar matches reality.
  const limit = limits.messagesPerMonth ?? null;
  const dailyLimit = limits.messagesPerDay ?? null;

  return NextResponse.json({
    plan: client.plan,
    // Which packages this account may buy. A shop has no calendar to book into
    // and a service has no catalogue to match a photo against, so offering
    // either the other's ladder sells something the dashboard will not show.
    business_type: client.business_type || "ecommerce",
    plan_name: limits.planName || "No plan",
    active: planActive(client),
    trial_end: client.trial_end,
    plan_expires_at: client.plan_expires_at,
    suspended: !!client.suspended,
    usage: {
      today,
      month,
      daily_limit: dailyLimit,
      monthly_limit: limit,
      // Fraction of the allowance used, so the UI can draw a bar.
      pct: dailyLimit ? Math.min(100, Math.round((today / dailyLimit) * 100))
         : limit ? Math.min(100, Math.round((month / limit) * 100)) : null,
    },
    methods: paymentMethods(),
    pending_request: pending,
    requests,
  }, NO_CACHE);
}, "billing");

export const POST = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { plan, cycle = "monthly", method, sender_number, txn_id } = body;

  // Validate and price the plan against the LIVE catalogue (the plans table),
  // so a package the admin created is purchasable — and priced correctly —
  // without a code change.
  const catalogue = await loadPlans();
  const chosen = catalogue[plan];
  const isPaid = chosen && chosen.active !== false && Number(chosen.monthly) > 0;
  if (!isPaid) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  if (!["monthly", "yearly"].includes(cycle)) return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });
  if (!method) return NextResponse.json({ error: "Select a payment method" }, { status: 400 });
  if (!txn_id || String(txn_id).trim().length < 4) {
    return NextResponse.json({ error: "Enter the transaction ID from your payment receipt" }, { status: 400 });
  }

  // One open request at a time keeps the admin queue clean.
  const { data: existing } = await supabase
    .from("payment_requests").select("id").eq("client_id", client.id).eq("status", "pending").limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: "You already have a payment under review. We'll confirm it shortly." }, { status: 409 });
  }

  const amount = cycle === "yearly" ? (Number(chosen.yearly) || 0) : (Number(chosen.monthly) || 0);
  const { data, error: insErr } = await supabase.from("payment_requests").insert({
    client_id: client.id,
    plan,
    billing_cycle: cycle,
    amount,
    method,
    sender_number: sender_number || null,
    txn_id: String(txn_id).trim(),
  }).select().single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  notifyPaymentRequest({
    business: client.business_name,
    email,
    plan: chosen.name || plan,
    cycle,
    amount,
    method,
    txnId: String(txn_id).trim(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, request: data }, NO_CACHE);
}, "billing");
