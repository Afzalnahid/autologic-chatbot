// Turn a paid payment_requests row into what it bought. ONE function for both
// ways money is confirmed: SSLCommerz (the browser callback AND the IPN — both
// fire for the same payment) and an admin approving a manual bKash/Nagad/Rocket
// payment. It used to be two copies of the date maths, and the admin copy was
// not atomic, so two admins clicking at once could extend a plan twice.
//
// It MUST be idempotent: it claims the row in a single conditional update, and
// only the call that actually flips it goes on. A second call finds it approved.
//
// What a row buys (lib/pricing.js priced it; the row stores the choice):
//   kind "plan"  — a package purchase or renewal. Sets the package, extends the
//                  expiry from the later of today and the current expiry by 30
//                  or 365 days, and records the cycle, Standard/BYOK and the
//                  add-ons (which renew with it).
//                  · BYOK → the AI Engine opens (a client_ai permission row is
//                    created if there is none) and the owner is told to add a key.
//                  · Standard after a BYOK package → the AI Engine closes and
//                    the saved key is removed (owner, 2026-10-03). A permission
//                    the super admin granted by hand (byok_plan false) is left
//                    alone.
//   kind "addon" — add-ons bought in the middle of a running package. They are
//                  added to what the client already has; the expiry is unchanged.
import { supabase } from "@/lib/supabase.js";
import { notifyPaymentApproved } from "@/lib/email.js";
import { notify } from "@/lib/push.js";
import { logEvent } from "@/lib/platform-events.js";
import { ACTIVATABLE, ONLINE_CHECKOUT_TTL_MIN, clientPatchFor } from "@/lib/billing-rules.js";

// Close this client's online checkouts that were never completed (billing-rules.js),
// so they stop blocking a new payment and stop sitting in the admin queue.
export async function expireAbandonedCheckouts(clientId) {
  const cutoff = new Date(Date.now() - ONLINE_CHECKOUT_TTL_MIN * 60 * 1000).toISOString();
  await supabase.from("payment_requests")
    .update({ status: "expired", admin_note: "online checkout not completed", reviewed_at: new Date().toISOString(), reviewed_by: "system" })
    .eq("client_id", clientId).eq("method", "online").eq("status", "pending").lt("created_at", cutoff);
}

export async function activatePaymentRow(pr, { reviewedBy = "sslcommerz" } = {}) {
  if (!pr || !pr.id) return { ok: false, reason: "no_payment" };
  if (pr.status === "approved") return { ok: true, already: true };

  const { data: cl } = await supabase
    .from("clients").select("id,owner_email,business_name,plan_expires_at,addons,byok_plan").eq("id", pr.client_id).single();
  if (!cl) return { ok: false, reason: "no_client" };

  // Claim first. The status filter makes this a compare-and-set: two concurrent
  // callers race here, and only one gets a row back. "expired" is accepted too —
  // a checkout we stopped waiting for can still be proven paid by the gateway.
  const { data: claimed } = await supabase
    .from("payment_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq("id", pr.id).in("status", ACTIVATABLE).select();
  if (!claimed || !claimed.length) return { ok: true, already: true };

  const patch = clientPatchFor(pr, cl);
  const { error: upErr } = await supabase.from("clients").update(patch).eq("id", pr.client_id);
  if (upErr) {
    // The payment is marked approved but the client did not change — rare, and
    // visible to the admin (an approved payment on an unchanged account) to fix
    // by hand. Loud so it is not missed.
    console.error("[billing-activate] claimed but client update FAILED for payment", pr.id, upErr.message);
    return { ok: false, reason: "extend_failed", plan_expires_at: null };
  }

  // The AI Engine follows the package (only on a package payment).
  if (pr.kind !== "addon") {
    if (pr.byok) {
      // Open it. ignoreDuplicates: a client who already has a key keeps it.
      await supabase.from("client_ai")
        .upsert({ client_id: pr.client_id, status: "no_key" }, { onConflict: "client_id", ignoreDuplicates: true });
      notify(pr.client_id, {
        title: "🔑 Your AI Engine is open",
        body: "Add your own AI key in AI Engine. The bot starts replying as soon as the key is saved.",
        url: "/dashboard#ai", tag: "byok-open",
      }).catch(() => {});
    } else if (cl.byok_plan) {
      await supabase.from("client_ai").delete().eq("client_id", pr.client_id);
    }
  }

  const expiry = patch.plan_expires_at || cl.plan_expires_at;
  if (cl.owner_email) notifyPaymentApproved(cl.owner_email, pr.plan, expiry).catch(() => {});
  // On the console's bell next to the request that asked for it, so a second
  // admin sees it was dealt with rather than approving it twice.
  logEvent({
    kind: "plan_activated",
    title: pr.kind === "addon" ? `Add-ons added to ${pr.plan}` : `${pr.plan}${pr.byok ? " (own key)" : ""} activated`,
    body: pr.kind === "addon"
      ? Object.entries(pr.addons || {}).map(([id, q]) => `${id}×${q}`).join(", ")
      : `${pr.billing_cycle === "yearly" ? "Yearly" : "Monthly"} · until ${String(expiry).slice(0, 10)}`,
    clientId: pr.client_id,
    clientName: cl.business_name,
  }).catch(() => {});

  return { ok: true, plan_expires_at: expiry };
}
