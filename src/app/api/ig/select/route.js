export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const form = await request.formData();
    const clientId = verifyState(form.get("state"));
    if (!clientId) {
      return new NextResponse("This connect session has expired or is invalid. Please start again from your dashboard.", { status: 403 });
    }
    const [igId, encName, pageToken] = String(form.get("acct") || "").split("|");
    if (!clientId || !igId || !pageToken) return new NextResponse("Invalid selection", { status: 400 });

    // Subscribe to messages AND comments for full automation coverage.
    const sub = await fetch(
      `https://graph.instagram.com/v21.0/${igId}/subscribed_apps?subscribed_fields=messages,comments,live_comments,message_reactions&access_token=${pageToken}`,
      { method: "POST" }
    ).then(r => r.json()).catch(() => ({}));

    console.log("[ig/select] subscription result:", JSON.stringify(sub));

    // Verify which fields actually got subscribed.
    const current = await fetch(
      `https://graph.instagram.com/v21.0/${igId}/subscribed_apps?access_token=${pageToken}`
    ).then(r => r.json()).catch(() => ({}));
    const subscribedFields = current?.data?.[0]?.subscribed_fields || [];
    console.log("[ig/select] active fields:", subscribedFields.join(","));

    const { error } = await supabase.from("channels").upsert(
      { client_id: clientId, platform: "instagram", page_id: igId, access_token: pageToken,
        status: "connected", connected_at: new Date().toISOString(),
        comment_reply_enabled: true, comment_dm_enabled: true },
      { onConflict: "client_id,platform,page_id" }
    );
    if (error) return new NextResponse("Save failed: " + error.message, { status: 500 });

    const subWarn = sub.error ? `<p style="color:#e6a23c">⚠️ Webhook warning: ${sub.error.message}</p>` : "";
    const commentsOk = subscribedFields.includes("comments");
    const statusMsg = commentsOk
      ? `<p style="color:#22c55e">✅ Messages + Comment automation active</p>`
      : `<p style="color:#e6a23c">⚠️ Comment automation requires instagram_manage_comments permission (pending App Review). Messages will work.</p>`;

    const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center">
  <h3>✅ @${decodeURIComponent(encName || "Instagram")} connected</h3>
  ${subWarn}${statusMsg}
  <p>You can close this window.</p>
  <script>setTimeout(function(){ if(window.opener){window.opener.postMessage("ig_connected","*");window.close();} else {window.location.href="/#channels";} },1200);</script>
  </body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    console.error("[ig-select]", e?.message || e);
    return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center"><h3>Something went wrong</h3><p style="color:#8b9cbd">We could not finish connecting. Please close this window and try again from your dashboard.</p></body></html>`, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
