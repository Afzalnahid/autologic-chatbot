export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { exchangeCode, fetchGoogleEmail } from "@/lib/gcal.js";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientId = searchParams.get("state") || "";
  const err = searchParams.get("error");
  if (err) return htmlClose("Google Calendar connect cancelled.");
  if (!code || !clientId) return new NextResponse("Missing code or state", { status: 400 });

  try {
    const redirectUri = `${origin}/api/gcal/callback`;
    const tok = await exchangeCode(code, redirectUri);
    const email = await fetchGoogleEmail(tok.access_token);
    const expiry = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();

    const patch = {
      gcal_access_token: tok.access_token,
      gcal_token_expiry: expiry,
      gcal_email: email,
      gcal_connected: true,
    };
    // Only overwrite refresh token when Google returns a new one
    if (tok.refresh_token) patch.gcal_refresh_token = tok.refresh_token;

    const { error } = await supabase.from("clients").update(patch).eq("id", clientId);
    if (error) return new NextResponse("Save failed: " + error.message, { status: 500 });

    return htmlClose(`Google Calendar connected as ${email || "your account"}. You can close this window.`);
  } catch (e) {
    return new NextResponse("Calendar connect failed: " + e.message, { status: 500 });
  }
}

function htmlClose(msg) {
  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:32px;text-align:center">
<h3>${msg}</h3>
<script>try{window.opener&&window.opener.postMessage('gcal-connected','*');}catch(e){}setTimeout(function(){window.close();},1500);</script>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
