export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";
import { connectedPage } from "@/lib/connect-page.js";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;
const GRAPH = "https://graph.facebook.com/v24.0";

// Completes WhatsApp Embedded Signup.
//
// The browser hands us two things: an OAuth code from FB.login, and the
// waba_id + phone_number_id that Meta's popup created. We exchange the code for
// a business token, register the number so it can send, and subscribe our
// webhook to the WABA. The client never sees or supplies any of these values.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = verifyState(body.state);
    if (!clientId) {
      return NextResponse.json(
        { error: "This connect session has expired. Please start again from your dashboard." },
        { status: 403 }
      );
    }
    if (!APP_ID || !APP_SECRET) {
      console.error("[wa/finish] FB_APP_ID or FB_APP_SECRET missing");
      return NextResponse.json({ error: "Server is not configured for WhatsApp." }, { status: 500 });
    }

    const { code, waba_id: wabaId, phone_number_id: phoneId } = body;
    if (!code) return NextResponse.json({ error: "Meta did not return an authorisation code." }, { status: 400 });
    if (!phoneId) {
      return NextResponse.json(
        { error: "Meta did not return a phone number. Please complete the phone verification step." },
        { status: 400 }
      );
    }

    // 1. Exchange the code for a business integration token. Embedded Signup
    // codes are redeemed without a redirect_uri.
    const tok = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`
    ).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

    if (tok.error || !tok.access_token) {
      console.error("[wa/finish] token exchange failed:", JSON.stringify(tok.error || tok));
      return NextResponse.json({ error: "Could not complete authorisation with Meta." }, { status: 400 });
    }
    const token = tok.access_token;

    // 2. Subscribe our webhook to the WABA so incoming messages reach us.
    if (wabaId) {
      const sub = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
      if (sub.error) console.error("[wa/finish] WABA subscribe failed:", sub.error.message);
      else console.log("[wa/finish] subscribed webhook to WABA", wabaId);
    }

    // 3. Register the number on Cloud API. Without this the number is verified
    // but cannot send. A number already registered returns an error we ignore.
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const reg = await fetch(`${GRAPH}/${phoneId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
    if (reg.error) console.error("[wa/finish] register:", reg.error.message);
    else console.log("[wa/finish] registered phone", phoneId);

    // 4. Read the number back so the dashboard can show something human.
    let displayNumber = phoneId;
    let verifiedName = "WhatsApp Business";
    try {
      const info = await fetch(
        `${GRAPH}/${phoneId}?fields=display_phone_number,verified_name&access_token=${token}`
      ).then(r => r.json());
      if (info.display_phone_number) displayNumber = info.display_phone_number;
      if (info.verified_name) verifiedName = info.verified_name;
    } catch (e) {
      console.error("[wa/finish] could not read number details:", e.message);
    }

    const { error: dbErr } = await supabase.from("channels").upsert(
      {
        client_id: clientId,
        platform: "whatsapp",
        page_id: phoneId,
        access_token: token,
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform" }
    );
    if (dbErr) {
      console.error("[wa/finish] save failed:", dbErr.message);
      return NextResponse.json({ error: "Could not save the connection. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, number: displayNumber, name: verifiedName });
  } catch (e) {
    console.error("[wa/finish]", e?.message || e);
    return NextResponse.json({ error: "Something went wrong finishing the connection." }, { status: 500 });
  }
}

// After the embedded flow's POST succeeds, the browser lands here so the owner
// sees the same branded "connected" page every channel gets. Display-only:
// nothing is saved from these query values.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = String(searchParams.get("name") || "WhatsApp Business").slice(0, 80);
  const number = String(searchParams.get("number") || "").slice(0, 40);
  return connectedPage({ platform: "whatsapp", name, detail: number, rows: [
    { ok: true, title: "WhatsApp replies are live", sub: "Autologic answers every message this number receives, 24/7." },
    { ok: true, title: "Broadcasts and follow-ups ready", sub: "Reach people who messaged you in the last 24 hours from the Broadcast tab." },
  ] });
}
