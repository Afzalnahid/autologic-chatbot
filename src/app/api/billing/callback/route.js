export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { validateTransaction, amountMatches, baseUrl } from "@/lib/sslcommerz.js";
import { activatePaymentRow } from "@/lib/billing-activate.js";

// Where SSLCommerz sends the customer's BROWSER back to after payment. It POSTs
// form data (tran_id, val_id, amount, status) to success_url/fail_url/cancel_url.
// The redirect is never trusted on its own: on success we re-validate the
// transaction server-side, check the tran_id and amount, then extend the plan
// (idempotently — the IPN may also arrive). We always end on a redirect so the
// customer lands back on the billing screen.
async function handle(request) {
  const url = new URL(request.url);
  const r = url.searchParams.get("r") || "success";
  const dash = `${baseUrl(request)}/dashboard?p=billing#billing`;

  let params = url.searchParams;
  if (request.method === "POST") {
    try {
      const fd = await request.formData();
      params = new URLSearchParams();
      for (const [k, v] of fd.entries()) params.set(k, String(v));
    } catch {}
  }

  const tranId = params.get("tran_id");
  const valId = params.get("val_id");

  if (r !== "success") return NextResponse.redirect(`${dash}&pay=${r}`, 303);
  if (!tranId) return NextResponse.redirect(`${dash}&pay=fail`, 303);

  const { data: pr } = await supabase.from("payment_requests").select("*").eq("txn_id", tranId).single();
  if (!pr) return NextResponse.redirect(`${dash}&pay=unknown`, 303);
  if (pr.status === "approved") return NextResponse.redirect(`${dash}&pay=success`, 303);

  const v = await validateTransaction(valId);
  if (!v.ok || v.tranId !== tranId || !amountMatches(pr.amount, v.amount)) {
    console.error("[billing-callback] validation failed", { tranId, ok: v.ok, got: v.amount, expected: pr.amount, reason: v.reason });
    return NextResponse.redirect(`${dash}&pay=fail`, 303);
  }

  const a = await activatePaymentRow(pr, { reviewedBy: "sslcommerz" });
  return NextResponse.redirect(`${dash}&pay=${a.ok ? "success" : "fail"}`, 303);
}

export const POST = handle;
export const GET = handle;
