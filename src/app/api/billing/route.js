export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { planActive } from "@/lib/plans.js";
import { limitsFor, loadUnits } from "@/lib/plan-limits.js";
import { clientHasOwnKey } from "@/lib/ai.js";
import { entitlementsFor } from "@/lib/entitlements.js";
import { notifyPaymentRequest } from "@/lib/email.js";
import { logEvent } from "@/lib/platform-events.js";
import { withErrors } from "@/lib/route-errors.js";
import { sslEnabled } from "@/lib/sslcommerz.js";
import { startOfDayDhaka, startOfMonthDhaka } from "@/lib/time.js";
import { countBillableMessages } from "@/lib/message-usage.js";
import { blocksNewPayment } from "@/lib/billing-rules.js";
import { priceBasket } from "@/lib/billing-basket.js";
import { unitsForBiz } from "@/lib/pricing.js";
import { expireAbandonedCheckouts } from "@/lib/billing-activate.js";

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

// Usage the owner sees must equal what the plan limit enforces — both count BOT
// REPLIES (owner's rule), so both go through countBillableMessages.
async function usageThisMonth(clientId) {
  return countBillableMessages(clientId, startOfMonthDhaka().toISOString());
}

async function usageToday(clientId) {
  return countBillableMessages(clientId, startOfDayDhaka().toISOString());
}

export const GET = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [limits, month, today, reqQ, ownKey, entitlements, units] = await Promise.all([
    limitsFor(client),
    usageThisMonth(client.id),
    usageToday(client.id),
    supabase.from("payment_requests").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
    clientHasOwnKey(client.id),
    // Features + every metered allowance with used/remaining, from the one
    // shared assembler — so the client's dashboard and the admin drawer agree.
    entitlementsFor(client),
    loadUnits(),
  ]);

  const requests = reqQ.data || [];
  // An online checkout the customer walked away from is not "under review".
  const pending = requests.find((r) => blocksNewPayment(r)) || null;

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
    // Whether this account runs on its own AI key. When true the billing screen
    // shows (and the purchase below charges) the lower BYOK price on any package
    // that sets one; when false, the standard price. The key is added in the AI
    // Engine tab, so this can change between a visit and a purchase.
    own_key: ownKey,
    // The current package as bought (lib/pricing.js): own-key or Standard, the
    // cycle, and the numbers the customer moved — a renewal starts from these,
    // and a mid-period raise is priced against them.
    byok_plan: !!client.byok_plan,
    billing_cycle: client.billing_cycle || "monthly",
    custom_limits: client.custom_limits || {},
    // The step prices this business may use; the screen totals the basket with
    // the same pricing.js the server charges with.
    units: unitsForBiz(units, client.business_type || "ecommerce"),
    // Whether the free trial has been used (it is one per account).
    trial_used: !!client.trial_start,
    trial_end: client.trial_end,
    plan_expires_at: client.plan_expires_at,
    suspended: !!client.suspended,
    usage: {
      today,
      month,
      daily_limit: dailyLimit,
      monthly_limit: limit,
      // Fraction of the allowance used, so the UI can draw a bar.
      // A percentage of an unknown count is not 0%, it is nothing. Without the
      // null guards `null / limit` is 0 and the bar draws itself empty.
      pct: dailyLimit ? (today === null ? null : Math.min(100, Math.round((today / dailyLimit) * 100)))
         : limit ? (month === null ? null : Math.min(100, Math.round((month / limit) * 100))) : null,
    },
    methods: paymentMethods(),
    online: sslEnabled(),
    pending_request: pending,
    requests,
    // The full "what your plan includes and how much is left" panel (features +
    // metered allowances), rendered on the client's Profile tab.
    entitlements,
  }, NO_CACHE);
}, "billing");

export const POST = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { method, sender_number, txn_id } = body;

  // What is being bought — a package (Standard or own-key, monthly or yearly,
  // with add-ons) or add-ons mid-period — priced on the server against the live
  // catalogue (lib/billing-basket.js → lib/pricing.js). The browser never sends
  // an amount.
  const basket = await priceBasket(client, body);
  if (!basket.ok) return NextResponse.json({ error: basket.error }, { status: basket.status || 400 });
  const { amount } = basket.row;
  const cycle = basket.row.billing_cycle;
  if (!method) return NextResponse.json({ error: "Select a payment method" }, { status: 400 });
  if (!txn_id || String(txn_id).trim().length < 4) {
    return NextResponse.json({ error: "Enter the transaction ID from your payment receipt" }, { status: 400 });
  }

  // A transaction ID pays for one purchase. The same ID again — a double tap, or
  // a receipt reused — is refused here, before it reaches the admin queue (and
  // a unique index on payment_requests refuses it at the database too).
  const txnClean = String(txn_id).trim();
  const { data: seen } = await supabase
    .from("payment_requests").select("id").ilike("txn_id", txnClean).in("status", ["pending", "approved"]).neq("method", "online").limit(1);
  if (seen?.length) {
    return NextResponse.json({ error: "This transaction ID has already been used for a payment. Check the ID in your payment app." }, { status: 409 });
  }

  // One open request at a time keeps the admin queue clean. Abandoned online
  // checkouts are closed first so they cannot block this one (billing-rules.js).
  await expireAbandonedCheckouts(client.id);
  const { data: existing } = await supabase
    .from("payment_requests").select("id").eq("client_id", client.id).eq("status", "pending").limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: "You already have a payment under review. We'll confirm it shortly." }, { status: 409 });
  }

  const { data, error: insErr } = await supabase.from("payment_requests").insert({
    client_id: client.id,
    ...basket.row,
    method,
    sender_number: sender_number || null,
    txn_id: txnClean,
  }).select().single();

  if (insErr) {
    if (insErr.code === "23505") return NextResponse.json({ error: "This transaction ID has already been used for a payment. Check the ID in your payment app." }, { status: 409 });
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  notifyPaymentRequest({
    business: client.business_name,
    email,
    plan: basket.label,
    cycle,
    amount,
    method,
    txnId: String(txn_id).trim(),
  }).catch(() => {});
  // …and on the console's bell, where the decision is actually made.
  logEvent({
    kind: "payment_request",
    title: `${amount} for ${basket.label}`,
    body: `${method} · ${String(txn_id).trim()} · ${cycle}`,
    clientId: client.id,
    clientName: client.business_name,
    url: "/admin",
  }).catch(() => {});

  return NextResponse.json({ ok: true, request: data }, NO_CACHE);
}, "billing");
