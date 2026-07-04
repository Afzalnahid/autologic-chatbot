export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const APP_ID = process.env.FB_APP_ID || "914246304594380";
const APP_SECRET = process.env.FB_APP_SECRET || "007a98117791b59b8dd62c6db3d91400";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientId = searchParams.get("state") || "";
  if (!code) return new NextResponse("Missing code", { status: 400 });

  const redirect = `${origin}/api/fb/callback`;
  const tokRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`).then(r => r.json());
  if (tokRes.error) return new NextResponse("Auth failed: " + tokRes.error.message, { status: 400 });

  const longRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokRes.access_token}`).then(r => r.json());
  const userToken = longRes.access_token || tokRes.access_token;

  const pages = await fetch(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`).then(r => r.json());
  if (pages.error) return new NextResponse("Pages fetch failed: " + pages.error.message, { status: 400 });
  const list = pages.data || [];
  if (!list.length) return new NextResponse("No pages found on this account", { status: 400 });

  const options = list.map(p => `<label style="display:block;margin:8px 0;padding:12px;border:1px solid #333;border-radius:8px;cursor:pointer"><input type="radio" name="page" value="${p.id}|${encodeURIComponent(p.name)}|${p.access_token}" required> ${p.name}</label>`).join("");
  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:24px;max-width:420px;margin:auto">
<h3>Select a page to connect</h3>
<form method="POST" action="/api/fb/select">
<input type="hidden" name="client_id" value="${clientId}">
${options}
<button type="submit" style="margin-top:12px;padding:10px 18px;background:#0084ff;color:#fff;border:none;border-radius:8px;cursor:pointer">Connect</button>
</form></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
