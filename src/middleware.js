import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

// Sends a customer who is already signed in straight to their dashboard when
// they open the front page.
//
// The front page sells the product to people who do not have it yet. Someone
// who already pays for it has no reason to read the pitch again on the way to
// their own inbox.
//
// This file has to live in src/. Next only looks for middleware beside the app
// folder, so while it sat in the repository root it was never registered —
// `sortedMiddleware` in the build manifest was an empty list — and none of it
// ran. It was written to keep the Supabase session fresh on the server; that
// never happened, and nothing broke, because the browser refreshes its own
// token (see the 401 retry in dashboard/components/session.js) and every API
// route reads a Bearer header rather than a cookie.
//
// So the matcher is the front page and nothing else. Turning it on for the
// whole site would put a Supabase auth call in front of every request —
// including Meta's webhooks, which are timed — to fix something that is not
// broken. That is a separate decision, not a side effect of this one.

// A link out of an email (confirm your address, reset your password) arrives
// with a code in the query. Those are never redirected, so this can never eat
// one.
const EMAIL_LINK_PARAMS = ["code", "token_hash", "type", "error", "error_description"];

// "/?home=1" is the way back to the landing page for anyone who wants it — the
// owner checking a change, or a customer who wants to look at it before
// sending the link to someone.
function isPlainLandingVisit(url) {
  if (url.searchParams.has("home")) return false;
  return !EMAIL_LINK_PARAMS.some((p) => url.searchParams.has(p));
}

export async function middleware(request) {
  // If Supabase env is missing or auth throws, this must NOT take the front
  // page down — fall through and let it render.
  try {
    const { supabase, supabaseResponse } = createClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (user && isPlainLandingVisit(request.nextUrl)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      // The dashboard remembers its own language, so ?lang= does not travel.
      url.search = "";
      // 307, never 308: a permanent redirect is remembered by the browser and
      // would keep firing after the person logs out.
      const redirect = NextResponse.redirect(url);
      // And not stored either. If a browser kept this answer, "log out" would
      // drop the person on the front page and bounce them straight back.
      redirect.headers.set("Cache-Control", "no-store");
      // Supabase may have just refreshed the session onto supabaseResponse.
      // Those cookies have to ride along or this request throws the refresh away.
      supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware]", e?.message || e);
    return NextResponse.next({ request: { headers: request.headers } });
  }
}

// The front page and nothing else, for the reason given at the top of this
// file. /docs was briefly added here to set a Cache-Control header on the
// manual; it did not work (see the note in next.config.js) and was taken back
// out rather than left running an edge invocation for nothing.
export const config = { matcher: ["/"] };
