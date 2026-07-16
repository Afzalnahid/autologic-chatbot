export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function POST(request) {
  const form = await request.formData();
  const clientId = form.get("client_id");
  const [igId, encName, pageToken] = String(form.get("acct") || "").split("|");
  if (!clientId || !igId || !pageToken) return new NextResponse("Invalid selection", { status: 400 });

  const sub = await fetch(`https://graph.facebook.com/v24.0/${igId}/subscribed_apps?subscribed_fields=messages&access_token=${pageToken}`, { method: "POST" }).then(r => r.json()).catch(() => ({}));

  const { error } = await supabase.from("channels").upsert(
    { client_id: clientId, platform: "instagram", page_id: igId, access_token: pageToken, status: "connected", connected_at: new Date().toISOString() },
    { onConflict: "client_id,platform,page_id" }
  );
  if (error) return new NextResponse("Save failed: " + error.message, { status: 500 });

  const warn = sub.error ? `<p style="color:#e6a23c">Webhook warning: ${sub.error.message}</p>` : "";
  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center">
<h3>✅ @${decodeURIComponent(encName || "Instagram")} connected</h3>${warn}
<p>You can close this window.</p>
<script>setTimeout(function(){ if(window.opener){window.opener.postMessage("ig_connected","*");window.close();} else {window.location.href="/#channels";} },1200);</script>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
