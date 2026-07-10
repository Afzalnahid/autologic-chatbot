export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const APP_ID = process.env.FB_APP_ID || "914246304594380";
const CONFIG_ID = process.env.FB_CONFIG_ID || "2178064332957710";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const clientId = searchParams.get("client_id") || "";
  const redirect = `${origin}/api/ig/callback`;
  const url = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(clientId)}&config_id=${CONFIG_ID}&response_type=code`;
  return NextResponse.redirect(url);
}
