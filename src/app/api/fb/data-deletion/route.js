export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase.js";
import { COMPANY, ADDRESS_LINE } from "@/lib/company.js";
import { readSignedRequest, verifySignedRequest } from "@/lib/meta-signed-request.js";

// Data-deletion callback for BOTH Meta apps — the Facebook app and the
// Instagram-login app point here. Meta posts a form field `signed_request`
// signed with that app's secret; only a request that verifies is acted on, and
// a malformed one gets a 400 (it used to throw and return a 500).
//
// What is deleted for the verified user_id:
// - Instagram: that account's channel token is cleared and the channel marked
//   disconnected (looked up first, then updated by id AND client_id so the
//   write stays tenant-scoped). channels.page_id holds the professional-account
//   id; an unmatched id is logged so the mapping can be confirmed.
// - Both apps: messages, contact and chat memory stored under that id as a
//   sender (a person who chatted with a connected business).
// A Facebook user_id is app-scoped to the person who logged in; we do not
// store it against a channel, so a business owner's Pages are removed by
// disconnecting in the dashboard or by email (see the GET page).
export async function POST(request) {
  const signed = await readSignedRequest(request);
  const v = verifySignedRequest(signed, { facebook: process.env.FB_APP_SECRET, instagram: process.env.IG_APP_SECRET });
  if (!v) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });

  const code = "del_" + crypto.randomBytes(8).toString("hex");
  try {
    let channels = 0;
    if (v.app === "instagram") {
      const { data: rows } = await supabase.from("channels").select("id, client_id")
        .eq("platform", "instagram").eq("page_id", v.userId);
      for (const r of rows || []) {
        await supabase.from("channels").update({ status: "disconnected", access_token: null })
          .eq("id", r.id).eq("client_id", r.client_id);
      }
      channels = (rows || []).length;
    }
    await supabase.from("message_buffer").delete().eq("sender_id", v.userId);
    await supabase.from("contacts").delete().eq("sender_id", v.userId);
    await supabase.from("chat_memory").delete().eq("session_id", v.userId);
    console.log("[data-deletion] app=", v.app, "user_id=", v.userId, "code=", code, "channels disconnected=", channels);
  } catch (e) {
    console.error("[data-deletion]", code, e?.message || e);
  }
  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/api/fb/data-deletion?code=${code}`, confirmation_code: code });
}

// Meta posts a signed_request here, but a reviewer will often just open the URL
// in a browser. Returning 405 to that looks like a broken endpoint, so serve a
// short human-readable page explaining how deletion works.
export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  const status = /^del_[0-9a-f]{16}$/.test(code)
    ? `<h2>Request ${code}</h2><p>Your deletion request was received and processed automatically. Keep this code if you contact us about it.</p>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Data Deletion — TellMore AI</title>
<style>
  body{background:#0A0D14;color:#E7EAF2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       line-height:1.75;margin:0;padding:48px 24px}
  .w{max-width:640px;margin:0 auto}
  h1{font-size:26px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
  .sub{color:#98A3BA;font-size:14px;margin-bottom:28px}
  h2{font-size:16px;font-weight:600;color:#FF6B75;margin:28px 0 6px}
  p{font-size:14.5px;color:#98A3BA;margin:0 0 12px}
  a{color:#FF6B75}
</style></head><body><div class="w">
  <h1>Data Deletion</h1>
  <div class="sub">${COMPANY.name} · ${ADDRESS_LINE} · ${COMPANY.madeBy}</div>
  ${status}

  <h2>Automatic deletion</h2>
  <p>If you remove TellMore AI from your Facebook or Instagram settings, Meta notifies
  this endpoint automatically and we delete the access tokens and channel data
  associated with your account within 24 hours.</p>

  <h2>Deleting your account and all data</h2>
  <p>Sign in to your dashboard and disconnect any connected channel — this stops all
  data processing for that channel immediately. To delete your account and everything
  stored with it, email <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>
  from the address you registered with. Requests are completed within 30 days.</p>

  <h2>What we store</h2>
  <p>Full details are in our <a href="/privacy">Privacy Policy</a>.</p>
</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
