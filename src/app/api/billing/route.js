export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { PLANS, PAID_PLANS, priceOf, planActive } from "@/lib/plans.js";
import { notifyPaymentRequest } from "@/lib/email.js";

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
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("message_buffer")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "customer")
    .gte("created_at", start.toISOString());
  return count || 0;
}

async function usageToday(clientId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("message_buffer")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "customer")
    .gte("created_at", start.toISOString());
  return count || 0;
}

export async function GET(request) {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const plan = PLANS[client.plan] || null;
  const [month, today, reqQ] = await Promise.all([
    usageThisMonth(client.id),
    usageToday(client.id),
    supabase.from("payment_requests").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const requests = reqQ.data || [];
  const pending = requests.find((r) => r.status === "pending") || null;

  const limit = plan?.messagesPerMonth ?? null;
  const dailyLimit = plan?.messagesPerDay ?? null;

  return NextResponse.json({
    plan: client.plan,
    plan_name: plan?.name || "No plan",
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
}

export async function POST(request) {
  const { client, email, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { plan, cycle = "monthly", method, sender_number, txn_id } = body;

  if (!PAID_PLANS.includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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

  const amount = priceOf(plan, cycle);
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
    plan: PLANS[plan]?.name || plan,
    cycle,
    amount,
    method,
    txnId: String(txn_id).trim(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, request: data }, NO_CACHE);
}
