// Turn a paid payment_requests row into an extended plan. SSLCommerz fires BOTH
// the browser callback AND a server-to-server IPN for the same payment, so this
// MUST be idempotent: it claims the row (pending → approved) in a single
// conditional update, and only the call that actually flips a still-pending row
// goes on to extend the plan. A second call finds it already approved and stops.
//
// The date maths mirrors the admin manual approval (admin/route.js): extend from
// the later of today and the current expiry, by 30 days (monthly) or 365 (yearly).
import { supabase } from "@/lib/supabase.js";
import { notifyPaymentApproved } from "@/lib/email.js";

export async function activatePaymentRow(pr, { reviewedBy = "sslcommerz" } = {}) {
  if (!pr || !pr.id) return { ok: false, reason: "no_payment" };
  if (pr.status === "approved") return { ok: true, already: true };

  const { data: cl } = await supabase
    .from("clients").select("id,owner_email,plan_expires_at").eq("id", pr.client_id).single();
  if (!cl) return { ok: false, reason: "no_client" };

  // Claim first. The .eq("status","pending") makes this a compare-and-set: two
  // concurrent callers race here, and only one gets a row back.
  const { data: claimed } = await supabase
    .from("payment_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq("id", pr.id).eq("status", "pending").select();
  if (!claimed || !claimed.length) return { ok: true, already: true };

  const current = cl.plan_expires_at ? new Date(cl.plan_expires_at) : null;
  const base = current && current > new Date() ? new Date(current) : new Date();
  base.setDate(base.getDate() + (pr.billing_cycle === "yearly" ? 365 : 30));

  const { error: upErr } = await supabase
    .from("clients")
    .update({ plan: pr.plan, plan_expires_at: base.toISOString(), suspended: false })
    .eq("id", pr.client_id);
  if (upErr) {
    // The payment is marked approved but the plan did not extend — rare, and
    // visible to the admin (an approved payment on a still-short plan) to fix by
    // hand. Loud so it is not missed.
    console.error("[billing-activate] claimed but plan extend FAILED for payment", pr.id, upErr.message);
    return { ok: false, reason: "extend_failed", plan_expires_at: null };
  }

  notifyPaymentApproved(cl.owner_email, pr.plan, base.toISOString()).catch(() => {});
  return { ok: true, plan_expires_at: base.toISOString() };
}
