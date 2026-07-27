export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

function html(body) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:24px;max-width:500px;margin:auto">${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const stateToken = searchParams.get("state") || "";
    const clientId = verifyState(stateToken);
    if (!clientId) {
      return new NextResponse("This connect link has expired or is invalid. Please start again from your dashboard.", { status: 400 });
    }

    if (!code) return html(`<h3>Error</h3><p>Missing authorization code.</p>`);
    if (!APP_ID || !APP_SECRET) return html(`<h3>Error</h3><p>Server misconfigured.</p>`);

    const redirect = `${origin}/api/wa/callback`;

    // 1. Exchange code for token
    const tokRes = await fetch(
      `https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
    ).then(r => r.json());
    if (tokRes.error) return html(`<h3>Auth failed</h3><p>${tokRes.error.message}</p>`);

    const longRes = await fetch(
      `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokRes.access_token}`
    ).then(r => r.json());
    const userToken = longRes.access_token || tokRes.access_token;

    // 2. Try multiple endpoints to find phone numbers
    const phoneNumbers = [];

    // Approach A: via /me/businesses -> WABAs -> phones
    try {
      const bizRes = await fetch(
        `https://graph.facebook.com/v24.0/me/businesses?fields=id,name,whatsapp_business_accounts{id,name}&access_token=${userToken}`
      ).then(r => r.json());
      for (const biz of (bizRes.data || [])) {
        for (const waba of (biz.whatsapp_business_accounts?.data || [])) {
          const phonesRes = await fetch(
            `https://graph.facebook.com/v24.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${userToken}`
          ).then(r => r.json());
          for (const p of (phonesRes.data || [])) {
            phoneNumbers.push({ phoneId: p.id, displayNumber: p.display_phone_number, verifiedName: p.verified_name || biz.name, status: p.status, token: userToken });
          }
        }
      }
    } catch(e) { console.error("approach A:", e.message); }

    // Approach B: direct /me/whatsapp_business_accounts
    if (!phoneNumbers.length) {
      try {
        const directRes = await fetch(
          `https://graph.facebook.com/v24.0/me/whatsapp_business_accounts?access_token=${userToken}`
        ).then(r => r.json());
        for (const waba of (directRes.data || [])) {
          const phonesRes = await fetch(
            `https://graph.facebook.com/v24.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${userToken}`
          ).then(r => r.json());
          for (const p of (phonesRes.data || [])) {
            phoneNumbers.push({ phoneId: p.id, displayNumber: p.display_phone_number, verifiedName: p.verified_name || waba.name, status: p.status, token: userToken });
          }
        }
      } catch(e) { console.error("approach B:", e.message); }
    }

    // Approach C: phone numbers directly via app
    if (!phoneNumbers.length) {
      try {
        const appPhones = await fetch(
          `https://graph.facebook.com/v24.0/${APP_ID}/phone_numbers?access_token=${userToken}`
        ).then(r => r.json());
        for (const p of (appPhones.data || [])) {
          phoneNumbers.push({ phoneId: p.id, displayNumber: p.display_phone_number || p.id, verifiedName: p.verified_name || "WhatsApp Number", status: p.status, token: userToken });
        }
      } catch(e) { console.error("approach C:", e.message); }
    }

    // If still nothing found — show manual fallback with the token pre-filled
    if (!phoneNumbers.length) {
      return html(`
        <h3 style="color:#f0c040;margin-bottom:6px">Connect WhatsApp</h3>
        <p style="color:#8b9cbd;font-size:13px;margin-bottom:20px">
          Auto-detection requires <strong>whatsapp_business_management</strong> permission 
          (pending App Review). Enter your Phone Number ID manually below — 
          the access token has been filled in automatically.
        </p>
        <form method="POST" action="/api/wa/select">
          <input type="hidden" name="state" value="${stateToken}">
          <input type="hidden" name="manual_token" value="${userToken}">
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:12px;color:#8b9cbd;margin-bottom:5px">Phone Number ID</label>
            <input name="phone_id" required placeholder="e.g. 123456789012345"
              style="width:100%;box-sizing:border-box;background:#0d1529;border:1px solid #1a2744;border-radius:8px;padding:11px 12px;color:#eee;font-size:14px">
            <p style="font-size:11px;color:#64748b;margin-top:4px">
              Find this in: Meta App Dashboard → WhatsApp → API Setup → Phone number ID
            </p>
          </div>
          <button type="submit" style="width:100%;padding:12px;background:#f0c040;color:#0a0a0a;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px">Connect</button>
        </form>
        <p style="font-size:11px;color:#64748b;margin-top:14px;text-align:center">
          After App Review is approved, this will be fully automatic.
        </p>
      `);
    }

    // Found phone numbers — show selection
    const opts = phoneNumbers.map((p, i) =>
      `<label style="display:block;margin:8px 0;padding:14px;border:1px solid #1a2744;border-radius:10px;cursor:pointer;background:#0d1529">
        <input type="radio" name="phone" value="${i}" required style="margin-right:10px">
        <strong>${p.verifiedName}</strong><br>
        <span style="color:#8b9cbd;font-size:13px">${p.displayNumber} &middot; ${p.status || "active"}</span>
      </label>`
    ).join("");

    const encoded = encodeURIComponent(JSON.stringify(phoneNumbers));

    return html(`
      <h3 style="color:#f0c040;margin-bottom:4px">Connect WhatsApp</h3>
      <p style="color:#8b9cbd;font-size:13px;margin-bottom:20px">Select which number to connect</p>
      <form method="POST" action="/api/wa/select">
        <input type="hidden" name="state" value="${stateToken}">
        <input type="hidden" name="phones" value="${encoded}">
        ${opts}
        <button type="submit" style="margin-top:14px;width:100%;padding:12px;background:#f0c040;color:#0a0a0a;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px">Connect</button>
      </form>
    `);
  } catch (e) {
    console.error("[wa-callback]", e?.message || e);
    return html(`<h3>Something went wrong</h3><p style="color:#8b9cbd">We could not finish connecting WhatsApp. Please close this window and try again from your dashboard.</p>`);
  }
}
