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
    const [pageId, encName, pageToken] = String(form.get("page") || "").split("|");
    if (!clientId || !pageId || !pageToken) return new NextResponse("Invalid selection", { status: 400 });

    // Subscribe to messages + comments (feed). Log the result so we can
    // diagnose missing permissions during App Review.
    const sub = await fetch(
      `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${pageToken}`,
      { method: "POST" }
    ).then(r => r.json());

    console.log("[fb/select] subscription result:", JSON.stringify(sub));

    // Also fetch which fields are actually subscribed, so we can warn
    // the user if feed is missing (pending App Review).
    const current = await fetch(
      `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps?access_token=${pageToken}`
    ).then(r => r.json()).catch(() => ({}));

    const subscribedFields = current?.data?.[0]?.subscribed_fields || [];
    const feedOk = subscribedFields.includes("feed");
    console.log("[fb/select] active fields:", subscribedFields.join(","), "feed:", feedOk);

    const { error } = await supabase.from("channels").upsert(
      { client_id: clientId, platform: "facebook", page_id: pageId, access_token: pageToken,
        status: "connected", connected_at: new Date().toISOString(),
        comment_reply_enabled: true, comment_dm_enabled: true },
      { onConflict: "client_id,platform,page_id" }
    );
    if (error) return new NextResponse("Save failed: " + error.message, { status: 500 });

    const subWarn = sub.error ? `<p style="color:#e6a23c">⚠️ Webhook warning: ${sub.error.message}</p>` : "";
    const feedWarn = !feedOk
      ? `<p style="color:#e6a23c">⚠️ Comment automation requires <b>pages_read_engagement</b> and <b>pages_manage_engagement</b> permissions. These are pending App Review — messages will work but comment replies won't until approved.</p>`
      : `<p style="color:#22c55e">✅ Comment automation active</p>`;

    const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center">
  <h3>✅ ${decodeURIComponent(encName || "Page")} connected</h3>
  ${subWarn}${feedWarn}
  <p>You can close this window.</p>
  <script>setTimeout(function(){ if(window.opener){window.opener.postMessage("fb_connected","*");window.close();} else {window.location.href="/#channels";} },1200);</script>
  </body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    console.error("[fb-select]", e?.message || e);
    return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center"><h3>Something went wrong</h3><p style="color:#8b9cbd">We could not finish connecting. Please close this window and try again from your dashboard.</p></body></html>`, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
