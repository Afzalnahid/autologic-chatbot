export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase.js";

const APP_SECRET = process.env.FB_APP_SECRET;

function parseSignedRequest(signedRequest) {
  if (!APP_SECRET) return null;
  const [encodedSig, payload] = signedRequest.split(".");
  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  const expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest();
  if (!crypto.timingSafeEqual(sig, expected)) return null;
  return data;
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const data = parseSignedRequest(String(form.get("signed_request") || ""));
    if (!data) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    const userId = data.user_id;
    const code = "del_" + crypto.randomBytes(8).toString("hex");
    await supabase.from("message_buffer").delete().eq("sender_id", userId);
    await supabase.from("contacts").delete().eq("sender_id", userId);
    await supabase.from("chat_memory").delete().eq("session_id", userId);
    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/privacy`, confirmation_code: code });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Meta posts a signed_request here, but a reviewer will often just open the URL
// in a browser. Returning 405 to that looks like a broken endpoint, so serve a
// short human-readable page explaining how deletion works.
export async function GET() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Data Deletion — Autologic</title>
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
  <div class="sub">Autologic · Kandirpar, Cumilla, Bangladesh</div>

  <h2>Automatic deletion</h2>
  <p>If you remove Autologic from your Facebook or Instagram settings, Meta notifies
  this endpoint automatically and we delete the access tokens and channel data
  associated with your account within 24 hours.</p>

  <h2>Deleting your account and all data</h2>
  <p>Sign in to your dashboard and disconnect any connected channel — this stops all
  data processing for that channel immediately. To delete your account and everything
  stored with it, email <a href="mailto:nahidafzal97@gmail.com">nahidafzal97@gmail.com</a>
  from the address you registered with. Requests are completed within 30 days.</p>

  <h2>What we store</h2>
  <p>Full details are in our <a href="/privacy">Privacy Policy</a>.</p>
</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
