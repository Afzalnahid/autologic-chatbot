export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";

// App ID is a public value; fallback is safe. App secret stays env-only in the callback.
const APP_ID = process.env.FB_APP_ID || "914246304594380";
// A "General" Facebook Login for Business configuration whose assets are
// WhatsApp accounts. Embedded Signup creates a brand new WhatsApp account, so
// it is the wrong door for a business that already has one — this path lets
// them pick the account they already own instead.
// Prefer a dedicated "General" configuration, but fall back to the Embedded
// Signup one: both carry the same WhatsApp assets and permissions, so the asset
// picker may well work from either, and falling back saves setting up a second
// configuration just to find out.
const LOGIN_CONFIG_ID = process.env.WA_LOGIN_CONFIG_ID || process.env.WA_CONFIG_ID;

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const clientId = searchParams.get("client_id") || "";
    const redirect = `${origin}/api/wa/callback`;

    // Apps on Facebook Login for Business must pass a config_id; a bare scope
    // list is ignored, which is why asset lookups came back empty.
    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: redirect,
      state: signState(clientId),
      response_type: "code",
    });
    if (LOGIN_CONFIG_ID) {
      params.set("config_id", LOGIN_CONFIG_ID);
      params.set("override_default_response_type", "true");
    } else {
      params.set("scope", "whatsapp_business_management,whatsapp_business_messaging,business_management");
    }

    const url = `https://www.facebook.com/v26.0/dialog/oauth?${params.toString()}`;
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[wa-login]", e?.message || e);
    return new NextResponse("Could not start the connection. Please try again from your dashboard.", { status: 500 });
  }
}
