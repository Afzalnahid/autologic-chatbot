export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const clientId = searchParams.get("client_id") || "";
    const redirectUri = `${origin}/api/gcal/callback`;

    const url =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        state: signState(clientId),
      }).toString();

    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[gcal-login]", e?.message || e);
    return new NextResponse("Could not start the connection. Please try again from your dashboard.", { status: 500 });
  }
}
