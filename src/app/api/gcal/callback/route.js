export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { connectedPage, connectFailedPage } from "@/lib/connect-page.js";
import { verifyState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";
import { exchangeCode, fetchGoogleEmail } from "@/lib/gcal.js";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientId = verifyState(searchParams.get("state"));
  const err = searchParams.get("error");
  if (err) return htmlClose("Google Calendar connect cancelled.");
  if (!code) return connectFailedPage({ platform: "gcal", status: 400, reason: "Google did not send back an authorization code. Please try connecting again." });
  if (!clientId) return connectFailedPage({ platform: "gcal", status: 403, reason: "This connect link has expired. Please start again from your dashboard." });

  try {
    const redirectUri = `${origin}/api/gcal/callback`;
    const tok = await exchangeCode(code, redirectUri);
    const email = await fetchGoogleEmail(tok.access_token);
    const expiry = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();

    const patch = {
      gcal_access_token: tok.access_token,
      gcal_token_expiry: expiry,
      gcal_email: email,
      gcal_connected: true,
    };
    // Only overwrite refresh token when Google returns a new one
    if (tok.refresh_token) patch.gcal_refresh_token = tok.refresh_token;

    const { error } = await supabase.from("clients").update(patch).eq("id", clientId);
    if (error) return connectFailedPage({ platform: "gcal", reason: "We could not save the connection: " + error.message });

    return connectedPage({ platform: "gcal", name: email || "your Google account", seconds: 5, rows: [
      { ok: true, title: "Bookings go straight into this calendar", sub: "When a customer books, the event appears here automatically." },
      { ok: true, title: "Google Meet links are sent for you", sub: "Every confirmed booking gets a Meet link, delivered to the customer in chat." },
    ] });
  } catch (e) {
    console.error("[gcal-callback]", e?.message || e);
    return connectFailedPage({ platform: "gcal", reason: "Google did not finish the connection: " + e.message });
  }
}
