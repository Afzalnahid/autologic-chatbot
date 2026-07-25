export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientId = searchParams.get("state") || "";

  if (!code) return new NextResponse("Missing code", { status: 400 });
  if (!APP_ID || !APP_SECRET) return new NextResponse("Server misconfigured", { status: 500 });

  const redirect = `${origin}/api/wa/callback`;

  // 1. Exchange code for short-lived token
  const tokRes = await fetch(
    `https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
  ).then(r => r.json());
  if (tokRes.error) return new NextResponse("Auth failed: " + tokRes.error.message, { status: 400 });

  // 2. Exchange for long-lived token
  const longRes = await fetch(
    `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokRes.access_token}`
  ).then(r => r.json());
  const userToken = longRes.access_token || tokRes.access_token;

  // 3. Get WhatsApp Business Accounts
  const wabaRes = await fetch(
    `https://graph.facebook.com/v24.0/me/businesses?fields=id,name,whatsapp_business_accounts{id,name}&access_token=${userToken}`
  ).then(r => r.json());

  const businesses = wabaRes.data || [];
  const phoneNumbers = [];

  // 4. For each WABA, fetch phone numbers
  for (const biz of businesses) {
    const wabas = biz.whatsapp_business_accounts?.data || [];
    for (const waba of wabas) {
      const phonesRes = await fetch(
        `https://graph.facebook.com/v24.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${userToken}`
      ).then(r => r.json());
      for (const phone of (phonesRes.data || [])) {
        phoneNumbers.push({
          phoneId: phone.id,
          displayNumber: phone.display_phone_number,
          verifiedName: phone.verified_name || biz.name,
          status: phone.status,
          token: userToken,
        });
      }
    }
  }

  if (!phoneNumbers.length) {
    return new NextResponse(`<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center">
<h3>⚠️ No WhatsApp numbers found</h3>
<p style="color:#8b9cbd">No WhatsApp Business phone numbers were found on this Facebook account.</p>
<p style="color:#8b9cbd">Make sure you have a WhatsApp Business Account connected to your Facebook Business Manager.</p>
<button onclick="window.close()" style="margin-top:20px;padding:10px 20px;background:#f0c040;color:#0a0a0a;border:none;border-radius:8px;cursor:pointer;font-weight:600">Close</button>
</body></html>`, { headers: { "Content-Type": "text/html" } });
  }

  // 5. Build selection page
  const options = phoneNumbers.map((p, i) =>
    `<label style="display:block;margin:8px 0;padding:14px;border:1px solid #1a2744;border-radius:10px;cursor:pointer;background:#0d1529">
      <input type="radio" name="phone" value="${i}" required style="margin-right:10px">
      <strong>${p.verifiedName}</strong><br>
      <span style="color:#8b9cbd;font-size:13px">${p.displayNumber} · ${p.status || "active"}</span>
    </label>`
  ).join("");

  const encoded = encodeURIComponent(JSON.stringify(phoneNumbers));

  const html = `<!DOCTYPE html><html><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:24px;max-width:480px;margin:auto">
<h3 style="margin-bottom:4px">Connect WhatsApp</h3>
<p style="color:#8b9cbd;font-size:13px;margin-bottom:20px">Select which WhatsApp number to connect</p>
<form method="POST" action="/api/wa/select">
  <input type="hidden" name="client_id" value="${clientId}">
  <input type="hidden" name="phones" value="${encoded}">
  ${options}
  <button type="submit" style="margin-top:16px;width:100%;padding:12px;background:#f0c040;color:#0a0a0a;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px">Connect</button>
</form>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
