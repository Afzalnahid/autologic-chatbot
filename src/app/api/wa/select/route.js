export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";

function html(body) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center;max-width:500px;margin:auto">${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(request) {
  const form = await request.formData();
  const clientId = verifyState(form.get("state"));
  if (!clientId) {
    return new NextResponse("This connect session has expired or is invalid. Please start again from your dashboard.", { status: 403 });
  }
  if (!clientId) return html(`<h3>Error</h3><p>Missing client.</p>`);

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
    if (!phonesRaw) return html(`<h3>Error</h3><p>Invalid request.</p>`);
    let phones;
    try { phones = JSON.parse(decodeURIComponent(phonesRaw)); } catch {
      return html(`<h3>Error</h3><p>Invalid phone data.</p>`);
    }
    const selected = phones[selectedIdx];
    if (!selected) return html(`<h3>Error</h3><p>Invalid selection.</p>`);
    ({ phoneId, displayNumber, verifiedName, token } = selected);
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
      status: "connected",
      connected_at: new Date().toISOString(),
      bot_enabled: true,
    },
    { onConflict: "client_id,platform,page_id" }
  );
  if (error) return html(`<h3>Save failed</h3><p>${error.message}</p>`);

  const warn = sub.error ? `<p style="color:#e6a23c">Webhook note: ${sub.error.message}</p>` : "";
  return html(`
    <h3>&#9989; ${verifiedName} connected</h3>
    <p style="color:#8b9cbd">${displayNumber}</p>
    ${warn}
    <p style="color:#22c55e">WhatsApp bot is now active on this number.</p>
    <p>You can close this window.</p>
    <script>setTimeout(function(){ if(window.opener){window.opener.postMessage("wa_connected","*");window.close();} else {window.location.href="/dashboard#channels";} },1400);</script>
  `);
}
