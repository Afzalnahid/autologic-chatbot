export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const IG_APP_ID = process.env.IG_APP_ID || "1249182887184854";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const clientId = searchParams.get("client_id") || "";
  const redirect = `${origin}/api/ig/callback`;
  const scope = [
    "instagram_business_basic",
    "instagram_business_manage_messages",
  ].join(",");
  const url = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${IG_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(clientId)}`;
  return NextResponse.redirect(url);
}
