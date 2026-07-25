export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const APP_ID = process.env.FB_APP_ID;
const CONFIG_ID = process.env.FB_CONFIG_ID;

export async function GET(request) {
  if (!APP_ID || !CONFIG_ID) {
    return new NextResponse("Server misconfigured: FB_APP_ID or FB_CONFIG_ID missing", { status: 500 });
  }
  const { searchParams, origin } = new URL(request.url);
  const clientId = searchParams.get("client_id") || "";
  const redirect = `${origin}/api/fb/callback`;
  const url = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(clientId)}&config_id=${CONFIG_ID}&response_type=code`;
  return NextResponse.redirect(url);
}
