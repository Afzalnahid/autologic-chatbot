import { supabase } from "@/lib/supabase.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

// Exchange an authorization code for tokens
export async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).then((r) => r.json());
  if (res.error) throw new Error(res.error_description || res.error);
  return res; // { access_token, refresh_token, expires_in, ... }
}

// Refresh an access token using a stored refresh token
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).then((r) => r.json());
  if (res.error) throw new Error(res.error_description || res.error);
  return res; // { access_token, expires_in, ... }
}

// Return a valid access token for a client, refreshing + persisting if needed
export async function getValidAccessToken(client) {
  if (!client?.gcal_refresh_token) {
    console.error("[gcal] no refresh token stored for client", client?.id);
    return null;
  }
  const expiry = client.gcal_token_expiry ? new Date(client.gcal_token_expiry).getTime() : 0;
  const now = Date.now();
  if (client.gcal_access_token && expiry - now > 60_000) {
    return client.gcal_access_token;
  }

  let refreshed;
  try {
    refreshed = await refreshAccessToken(client.gcal_refresh_token);
  } catch (e) {
    // invalid_grant means the user revoked access or the refresh token expired
    // (unverified apps get 7-day refresh tokens). Mark it so the dashboard can
    // prompt a reconnect instead of silently failing on every booking.
    console.error("[gcal] refresh failed:", e.message);
    if (/invalid_grant|invalid_request/i.test(e.message)) {
      await supabase
        .from("clients")
        .update({ gcal_connected: false, gcal_access_token: null, gcal_token_expiry: null })
        .eq("id", client.id);
      console.error("[gcal] refresh token is dead — client must reconnect Google Calendar");
    }
    return null;
  }

  const newExpiry = new Date(now + (refreshed.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from("clients")
    .update({ gcal_access_token: refreshed.access_token, gcal_token_expiry: newExpiry })
    .eq("id", client.id);
  console.log("[gcal] access token refreshed, valid until", newExpiry);
  return refreshed.access_token;
}

// Fetch the user's primary email (used when connecting)
export async function fetchGoogleEmail(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json()).catch(() => ({}));
  return res.email || "";
}

// Check if a time slot is free. start/end are ISO strings.
export async function checkAvailability(accessToken, startISO, endISO) {
  const res = await fetch(`${CAL_BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: "primary" }],
    }),
  }).then((r) => r.json());
  if (res.error) throw new Error(res.error.message || "freeBusy failed");
  const busy = res.calendars?.primary?.busy || [];
  return { free: busy.length === 0, busy };
}

// Create an event with a Google Meet link. Returns { eventId, meetLink, htmlLink }
export async function createEvent(accessToken, { summary, description, startISO, endISO, attendeeEmail }) {
  const requestId = "meet-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const body = {
    summary,
    description: description || "",
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (attendeeEmail) body.attendees = [{ email: attendeeEmail }];

  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  ).then((r) => r.json());
  if (res.error) throw new Error(res.error.message || "event create failed");

  const meetLink =
    res.hangoutLink ||
    res.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    "";
  return { eventId: res.id, meetLink, htmlLink: res.htmlLink };
}
