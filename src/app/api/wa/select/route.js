export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";
import { connectedPage, connectFailedPage } from "@/lib/connect-page.js";
import { ownedByAnotherClient, ALREADY_CONNECTED } from "@/lib/channels.js";

const fail = (reason, status = 400) => connectFailedPage({ platform: "whatsapp", reason, status });

export async function POST(request) {
  try {
    const form = await request.formData();
    const clientId = verifyState(form.get("state"));
    if (!clientId) {
      return fail("This connect link has expired. Please start again from your dashboard.", 403);
    }

    let phoneId, displayNumber, verifiedName, token;

    // Case 1: manual fallback (token + phone id typed in)
    const manualToken = form.get("manual_token");
    const manualPhoneId = form.get("phone_id");
    if (manualToken && manualPhoneId) {
      token = manualToken;
      phoneId = String(manualPhoneId).trim();
      // Try to fetch the display number for a nicer confirmation
      try {
        const info = await fetch(
          `https://graph.facebook.com/v24.0/${phoneId}?fields=display_phone_number,verified_name&access_token=${token}`
        ).then(r => r.json());
        displayNumber = info.display_phone_number || phoneId;
        verifiedName = info.verified_name || "WhatsApp Business";
      } catch {
        displayNumber = phoneId;
        verifiedName = "WhatsApp Business";
      }
    } else {
      // Case 2: selected from the auto-detected list
      const phonesRaw = form.get("phones");
      const selectedIdx = parseInt(form.get("phone") || "0", 10);
      if (!phonesRaw) return fail("No phone number was received. Please go back and choose a number.");
      let phones;
      try { phones = JSON.parse(decodeURIComponent(phonesRaw)); } catch {
        return fail("The phone number data was not readable. Please try again.");
      }
      const selected = phones[selectedIdx];
      if (!selected) return fail("No phone number was selected. Please go back and choose one.");
      ({ phoneId, displayNumber, verifiedName, token } = selected);
    }

    // One WhatsApp number powers exactly one Autologic account.
    if (await ownedByAnotherClient("whatsapp", phoneId, clientId)) {
      return fail(ALREADY_CONNECTED.whatsapp, 409);
    }

    // Subscribe the app to this WhatsApp number's webhooks
    const sub = await fetch(
      `https://graph.facebook.com/v24.0/${phoneId}/subscribed_apps`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json()).catch(() => ({}));
    console.log("[wa/select] webhook subscribe:", JSON.stringify(sub));

    // Save channel
    const { error } = await supabase.from("channels").upsert(
      {
        client_id: clientId,
        platform: "whatsapp",
        page_id: phoneId,
        access_token: token,
        name: [verifiedName, displayNumber].filter(Boolean).join(" · ") || null,
        status: "connected",
        connected_at: new Date().toISOString(),
        bot_enabled: true,
      },
      { onConflict: "client_id,platform,page_id" }
    );
    if (error) return fail("We could not save the connection: " + error.message, 500);

    const rows = [
      { ok: true, title: "WhatsApp replies are live", sub: "Autologic answers every message this number receives, 24/7." },
      { ok: true, title: "Broadcasts and follow-ups ready", sub: "Reach people who messaged you in the last 24 hours from the Broadcast tab." },
    ];
    if (sub.error) rows.push({ ok: false, title: "Updates could not be registered", sub: "Disconnect and connect the number again. If it repeats, tell us: " + sub.error.message });
    return connectedPage({ platform: "whatsapp", name: verifiedName, detail: displayNumber, rows });
  } catch (e) {
    console.error("[wa-select]", e?.message || e);
    return fail(undefined, 500);
  }
}
