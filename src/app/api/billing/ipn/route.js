export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { validateTransaction, amountMatches } from "@/lib/sslcommerz.js";
import { activatePaymentRow } from "@/lib/billing-activate.js";

// SSLCommerz's server-to-server notification. This is the RELIABLE path: the
// browser callback can be lost if the customer closes the tab, but the IPN still
// arrives. Same server-side validation, same idempotent activation. Always 200 so
// the gateway does not hammer us with retries once we have accepted it.
export async function POST(request) {
  try {
    const fd = await request.formData();
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) params.set(k, String(v));
    const tranId = params.get("tran_id");
    const valId = params.get("val_id");

    if (tranId && valId) {
      const { data: pr } = await supabase.from("payment_requests").select("*").eq("txn_id", tranId).single();
      if (pr && pr.status !== "approved") {
        const v = await validateTransaction(valId);
        if (v.ok && v.tranId === tranId && amountMatches(pr.amount, v.amount)) {
          await activatePaymentRow(pr, { reviewedBy: "sslcommerz-ipn" });
        } else {
          console.error("[billing-ipn] validation failed", { tranId, ok: v.ok, got: v.amount, expected: pr.amount });
        }
      }
    }
  } catch (e) {
    console.error("[billing-ipn]", e?.message || e);
  }
  return new NextResponse("OK");
}
