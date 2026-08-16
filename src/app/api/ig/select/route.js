export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";
import { connectedPage, connectFailedPage } from "@/lib/connect-page.js";

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
    if (error) return connectFailedPage({ platform: "instagram", reason: "We could not save the connection: " + error.message });

    const commentsOk = subscribedFields.includes("comments");
    const rows = [
      { ok: true, title: "Direct-message replies are live", sub: "Autologic answers every DM this account receives, 24/7." },
      commentsOk
        ? { ok: true, title: "Comment automation is on", sub: "Comments on your posts get a reply and a private message." }
        : { ok: false, title: "Comment automation is waiting for Meta", sub: "DMs work now; comment replies switch on once Meta approves the app." },
    ];
    if (sub.error) rows.push({ ok: false, title: "Updates could not be registered", sub: "Disconnect and connect the account again. If it repeats, tell us: " + sub.error.message });
    return connectedPage({ platform: "instagram", name: "@" + decodeURIComponent(encName || "Instagram"), rows });
  } catch (e) {
    console.error("[ig-select]", e?.message || e);
    return connectFailedPage({ platform: "instagram" });
  }
}
