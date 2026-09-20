export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { safeConnectTarget, APP_COOKIE, APP_COOKIE_MAX_AGE } from "@/lib/app-return.js";

// The first stop of a connection started inside the Android/iOS app (see
// src/lib/app-return.js for the whole trip). The app opens this address in a
// browser sheet; it marks the sheet "this trip began in the app" with a
// short-lived cookie and sends it on to the real login route. When the login
// ends, connect-page.js sees the cookie and redirects to tellmoreai://…,
// which brings the owner back into the app.
//
// `to` is checked against the handful of login routes a trip may start at, so
// this can never be used to bounce somebody to another site. It needs no
// session: the login routes themselves take only the client id, and sign it
// into the OAuth state.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const to = safeConnectTarget(searchParams.get("to"));
  if (!to) return new NextResponse("This link is not valid. Please start again from the app.", { status: 400 });
  const res = NextResponse.redirect(origin + to);
  res.cookies.set(APP_COOKIE, "1", { path: "/", maxAge: APP_COOKIE_MAX_AGE, secure: true, sameSite: "lax", httpOnly: true });
  return res;
}
