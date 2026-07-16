export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const IG_APP_ID = process.env.IG_APP_ID || "1249182887184854";
const IG_APP_SECRET = process.env.IG_APP_SECRET;

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientId = searchParams.get("state") || "";
  const errDesc = searchParams.get("error_description");
  if (errDesc) return new NextResponse("Instagram error: " + errDesc, { status: 400 });
  if (!code) return new NextResponse("Missing code", { status: 400 });
  if (!IG_APP_SECRET) return new NextResponse("Server misconfigured: IG_APP_SECRET missing", { status: 500 });

  const redirect = `${origin}/api/ig/callback`;

  const form = new URLSearchParams();
  form.set("client_id", IG_APP_ID);
  form.set("client_secret", IG_APP_SECRET);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirect);
  form.set("code", code);

  const tok = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }).then(r => r.json());

  if (tok.error_type || tok.error_message) {
    return new NextResponse("Token exchange failed: " + (tok.error_message || tok.error_type), { status: 400 });
  }
  const shortToken = tok.access_token;
  const igUserId = String(tok.user_id || "");
  if (!shortToken) return new NextResponse("No access token returned", { status: 400 });

  const long = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${shortToken}`).then(r => r.json()).catch(() => ({}));
  const token = long.access_token || shortToken;

  const me = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${token}`).then(r => r.json()).catch(() => ({}));
  const username = me.username || "instagram";
  const accountId = me.id || igUserId;

  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:24px;max-width:420px;margin:auto">
<h3>Connect Instagram</h3>
<form method="POST" action="/api/ig/select">
<input type="hidden" name="client_id" value="${clientId}">
<input type="hidden" name="acct" value="${accountId}|${encodeURIComponent(username)}|${token}">
<div style="padding:12px;border:1px solid #333;border-radius:8px;margin:12px 0">@${username}</div>
<button type="submit" style="padding:10px 18px;background:#E1306C;color:#fff;border:none;border-radius:8px;cursor:pointer">Connect</button>
</form></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
