export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function POST(request) {
  const form = await request.formData();
  const clientId = form.get("client_id");
  const phonesRaw = form.get("phones");
  const selectedIdx = parseInt(form.get("phone") || "0", 10);

  if (!clientId || !phonesRaw) return new NextResponse("Invalid request", { status: 400 });

  let phones;
  try { phones = JSON.parse(decodeURIComponent(phonesRaw)); } catch {
    return new NextResponse("Invalid phone data", { status: 400 });
  }

  const selected = phones[selectedIdx];
  if (!selected) return new NextResponse("Invalid selection", { status: 400 });

  const { phoneId, displayNumber, verifiedName, token } = selected;

  // Subscribe webhook for this phone number
  const sub = await fetch(
    `https://graph.facebook.com/v24.0/${phoneId}/subscribed_apps`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json()).catch(() => ({}));

  console.log("[wa/select] webhook subscribe:", JSON.stringify(sub));

  // Save to channels
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

  if (error) return new NextResponse("Save failed: " + error.message, { status: 500 });

  const warn = sub.error ? `<p style="color:#e6a23c">⚠️ Webhook warning: ${sub.error.message}</p>` : "";
  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center">
<h3>✅ ${verifiedName} (${displayNumber}) connected</h3>
${warn}
<p style="color:#22c55e">WhatsApp bot is now active on this number.</p>
<p>You can close this window.</p>
<script>setTimeout(function(){ if(window.opener){window.opener.postMessage("wa_connected","*");window.close();} else {window.location.href="/dashboard#channels";} },1200);</script>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
