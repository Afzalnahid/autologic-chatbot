export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";

// App ID is a public value; fallback is safe. App secret stays env-only in the callback.
const APP_ID = process.env.FB_APP_ID || "914246304594380";

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const clientId = searchParams.get("client_id") || "";
    const redirect = `${origin}/api/wa/callback`;
    const scope = "whatsapp_business_management,whatsapp_business_messaging,business_management";
    const url = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(signState(clientId))}&scope=${encodeURIComponent(scope)}&response_type=code`;
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[wa-login]", e?.message || e);
    return new NextResponse("Could not start the connection. Please try again from your dashboard.", { status: 500 });
  }
}
