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
      return connectFailedPage({ platform: "facebook", status: 403, reason: "This connect link has expired. Please start again from your dashboard." });
    }
    const [pageId, encName, pageToken] = String(form.get("page") || "").split("|");
    if (!clientId || !pageId || !pageToken) return connectFailedPage({ platform: "facebook", status: 400, reason: "No Page was selected. Please go back and choose a Page." });

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
    if (error) return connectFailedPage({ platform: "facebook", reason: "We could not save the connection: " + error.message });

    // Plain-language status — the owner reads what the bot will do, never a
    // permission name. Comment automation waits on Meta App Review.
    const rows = [
      { ok: true, title: "Messenger replies are live", sub: "Autologic answers every message this Page receives, 24/7." },
      feedOk
        ? { ok: true, title: "Comment automation is on", sub: "Comments on your posts get a reply and a private message." }
        : { ok: false, title: "Comment automation is waiting for Meta", sub: "Messages work now; comment replies switch on once Meta approves the app." },
    ];
    if (sub.error) rows.push({ ok: false, title: "Updates could not be registered", sub: "Disconnect and connect the Page again. If it repeats, tell us: " + sub.error.message });
    return connectedPage({ platform: "facebook", name: decodeURIComponent(encName || "Page"), rows });
  } catch (e) {
    console.error("[fb-select]", e?.message || e);
    return connectFailedPage({ platform: "facebook" });
  }
}
