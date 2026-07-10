export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

const APP_ID = process.env.FB_APP_ID || "914246304594380";
const APP_SECRET = process.env.FB_APP_SECRET;

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientId = searchParams.get("state") || "";
  if (!code) return new NextResponse("Missing code", { status: 400 });
  if (!APP_SECRET) return new NextResponse("Server misconfigured", { status: 500 });

  const redirect = `${origin}/api/ig/callback`;
  const tok = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`).then(r => r.json());
  if (tok.error) return new NextResponse("Auth failed: " + tok.error.message, { status: 400 });

  const longRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tok.access_token}`).then(r => r.json());
  const userToken = longRes.access_token || tok.access_token;

  const pages = await fetch(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`).then(r => r.json());
  if (pages.error) return new NextResponse("Pages fetch failed: " + pages.error.message, { status: 400 });

  const withIg = (pages.data || []).filter(p => p.instagram_business_account?.id);
  if (!withIg.length) return new NextResponse("No Instagram business account linked to your Pages. Link it in Facebook Page settings first.", { status: 400 });

  const options = withIg.map(p => {
    const ig = p.instagram_business_account;
    const val = `${ig.id}|${encodeURIComponent(ig.username || p.name)}|${p.access_token}`;
    return `<label style="display:block;margin:8px 0;padding:12px;border:1px solid #333;border-radius:8px;cursor:pointer"><input type="radio" name="acct" value="${val}" required> @${ig.username || p.name}</label>`;
  }).join("");

  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:24px;max-width:420px;margin:auto">
<h3>Select an Instagram account</h3>
<form method="POST" action="/api/ig/select">
<input type="hidden" name="client_id" value="${clientId}">
${options}
<button type="submit" style="margin-top:12px;padding:10px 18px;background:#E1306C;color:#fff;border:none;border-radius:8px;cursor:pointer">Connect</button>
</form></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
