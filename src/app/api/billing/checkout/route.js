export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { sslEnabled, initiateSession, newTranId, baseUrl } from "@/lib/sslcommerz.js";
import { expireAbandonedCheckouts } from "@/lib/billing-activate.js";
import { priceBasket } from "@/lib/billing-basket.js";

// Start a hosted SSLCommerz checkout. Returns { url } for the browser to redirect
// to. What is bought — a package (Standard or own-key, monthly or yearly, with
// add-ons) or add-ons mid-period — is priced on the server exactly as the manual
// flow prices it (lib/billing-basket.js). A pending payment_requests row is
// created keyed by our tran_id, and the gateway echoes that tran_id back to
// /api/billing/callback and /ipn.
export const POST = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sslEnabled()) return NextResponse.json({ error: "Online payment is not available right now." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const basket = await priceBasket(client, body);
  if (!basket.ok) return NextResponse.json({ error: basket.error }, { status: basket.status || 400 });
  const { amount, billing_cycle: cycle } = basket.row;
  if (!(amount > 0)) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  // One open request at a time, same rule as the manual flow — after closing any
  // earlier online checkout that was never completed (billing-rules.js).
  await expireAbandonedCheckouts(client.id);
  const { data: existing } = await supabase
    .from("payment_requests").select("id").eq("client_id", client.id).eq("status", "pending").limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: "You already have a payment under review. We'll confirm it shortly." }, { status: 409 });
  }

  const tranId = newTranId(client.id);
  const { data: pr, error: insErr } = await supabase.from("payment_requests").insert({
    client_id: client.id, ...basket.row, method: "online", txn_id: tranId,
  }).select().single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const r = await initiateSession({
    tranId, amount, planName: basket.label, cycle, origin: baseUrl(request),
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
