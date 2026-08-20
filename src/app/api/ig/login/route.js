export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";

const IG_APP_ID = process.env.IG_APP_ID || "1249182887184854";

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const clientId = searchParams.get("client_id") || "";
    const redirect = `${origin}/api/ig/callback`;
    // instagram_business_manage_comments is not yet Advanced Access-approved
    // by Meta (checked in App Review → Permissions and Features, 2026-08-20).
    // Requesting an unapproved permission in the same OAuth call blocks the
    // WHOLE login for the general public — only the app's own admins/testers
    // bypass that, which is exactly why the owner's own account could connect
    // but every client saw "Facebook Login is currently unavailable ...".
    // Drop it until it is approved; DM automation (the two scopes below) is
    // fully approved and unaffected. Comment automation already degrades
    // gracefully — ig/select's connected page shows "waiting for Meta" when
    // the "comments" field isn't subscribed. Add it back once approved.
    const scope = [
      "instagram_business_basic",
      "instagram_business_manage_messages",
    ].join(",");
    const url = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${IG_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(signState(clientId))}`;
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[ig-login]", e?.message || e);
    return new NextResponse("Could not start the connection. Please try again from your dashboard.", { status: 500 });
  }
}
