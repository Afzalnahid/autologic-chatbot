export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { loadPlans } from "@/lib/plan-limits.js";
import { priceForClient } from "@/lib/plans.js";
import { clientHasOwnKey } from "@/lib/ai.js";
import { withErrors } from "@/lib/route-errors.js";
import { sslEnabled, initiateSession, newTranId, baseUrl } from "@/lib/sslcommerz.js";

// Start a hosted SSLCommerz checkout for a plan. Returns { url } for the browser
// to redirect to. The plan is priced from the LIVE catalogue (same as the manual
// flow), a pending payment_requests row is created keyed by our tran_id, and the
// gateway echoes that tran_id back to /api/billing/callback and /ipn.
export const POST = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sslEnabled()) return NextResponse.json({ error: "Online payment is not available right now." }, { status: 400 });

  const { plan, cycle = "monthly" } = await request.json().catch(() => ({}));

  const catalogue = await loadPlans();
  const chosen = catalogue[plan];
  const isPaid = chosen && chosen.active !== false && Number(chosen.monthly) > 0;
  if (!isPaid) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  if (!["monthly", "yearly"].includes(cycle)) return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });

  // One open request at a time, same rule as the manual flow.
  const { data: existing } = await supabase
    .from("payment_requests").select("id").eq("client_id", client.id).eq("status", "pending").limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: "You already have a payment under review. We'll confirm it shortly." }, { status: 409 });
  }

  // A client on their own AI key pays the lower BYOK price where a package sets
  // one (same rule as the manual flow), priced server-side from the live key.
  const ownKey = await clientHasOwnKey(client.id);
  const amount = priceForClient(chosen, cycle, ownKey);
  if (!(amount > 0)) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  const tranId = newTranId(client.id);

  const { data: pr, error: insErr } = await supabase.from("payment_requests").insert({
    client_id: client.id, plan, billing_cycle: cycle, amount, method: "online", txn_id: tranId,
  }).select().single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const r = await initiateSession({
    tranId, amount, planName: chosen.name || plan, cycle, origin: baseUrl(request),
    customer: { clientId: client.id, name: client.business_name, email, phone: client.phone, address: client.address },
  });

  if (!r.ok) {
    // Do not leave a dead pending row blocking the queue if the gateway refused.
    await supabase.from("payment_requests")
      .update({ status: "rejected", admin_note: `gateway: ${r.reason}`, reviewed_at: new Date().toISOString(), reviewed_by: "gateway" })
      .eq("id", pr.id);
    return NextResponse.json({ error: "Could not start the online payment. Please try again or use bKash/Nagad." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, url: r.url });
}, "billing-checkout");
