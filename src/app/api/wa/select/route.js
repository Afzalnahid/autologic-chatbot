export const dynamic = "force-dynamic";
import { verifyState } from "@/lib/oauth-state.js";
import { connectedPage, connectFailedPage } from "@/lib/connect-page.js";
import { decryptSecret } from "@/lib/crypt.js";
import { completeWhatsApp, findWabaFor } from "@/lib/wa-connect.js";

const fail = (reason, status = 400) => connectFailedPage({ platform: "whatsapp", reason, status });

// Connects a WhatsApp number chosen from the "find my number" list, or typed in
// by hand (Phone Number ID + a token) under Advanced options.
//
// Before 2026-09-20 this route did its own, broken version of the last step: it
// subscribed the webhook on the PHONE NUMBER id (the subscription belongs to the
// WhatsApp Business Account), never registered the number on Cloud API, and the
// picker carried every access token to the browser in plain JSON. A number
// connected here could look live and neither receive nor send. Now both paths
// finish through completeWhatsApp(), the same step the signup uses, and the list
// travels sealed (AES-GCM, bound to this client) so the browser can neither read
// the tokens nor swap in another number.
export async function POST(request) {
  try {
    const form = await request.formData();
    const clientId = verifyState(form.get("state"));
    if (!clientId) {
      return fail("This connect link has expired. Please start again from your dashboard.", 403);
    }

    let phoneId, token, wabaId = null;

    const manualToken = String(form.get("manual_token") || "").trim();
    const manualPhoneId = String(form.get("phone_id") || "").trim();
    if (manualToken && manualPhoneId) {
      // Case 1: typed in under Advanced options.
      if (!/^\d{5,25}$/.test(manualPhoneId)) return fail("That Phone Number ID does not look right — it is a long number from WhatsApp Manager, not the phone number itself.");
      phoneId = manualPhoneId;
      token = manualToken;
    } else {
      // Case 2: chosen from the list the login flow found.
      let sealed;
      try { sealed = JSON.parse(decryptSecret(form.get("phones"))); } catch {
        return fail("The list of numbers could not be read. Please go back and try again.");
      }
      if (!sealed || sealed.clientId !== clientId || !Array.isArray(sealed.phones)) {
        return fail("This list of numbers belongs to another session. Please start again from your dashboard.", 403);
      }
      const selected = sealed.phones[parseInt(form.get("phone") || "0", 10)];
      if (!selected) return fail("No phone number was selected. Please go back and choose one.");
      ({ phoneId, token } = selected);
      wabaId = selected.wabaId || null;
    }

    if (!wabaId) wabaId = await findWabaFor(phoneId, token);

    const res = await completeWhatsApp({ clientId, token, wabaId, phoneId });
    if (res.error) return fail(res.error, res.status || 500);
    return connectedPage({ platform: "whatsapp", name: res.name, detail: res.number, rows: [
      { ok: true, title: "WhatsApp replies are live", sub: "TellMore AI answers every message this number receives, 24/7." },
      { ok: true, title: "Broadcasts and follow-ups ready", sub: "Reach people who messaged you in the last 24 hours from the Broadcast tab." },
    ] });
  } catch (e) {
    console.error("[wa-select]", e?.message || e);
    return fail(undefined, 500);
  }
}
