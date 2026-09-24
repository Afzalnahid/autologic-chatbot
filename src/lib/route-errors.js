import { NextResponse } from "next/server";

// Wraps a route handler so an unexpected throw becomes a clean JSON error
// instead of a Next.js stack trace, which would leak file paths and internals.
//
// Usage:
//   export const GET = withErrors(async (request) => { ... }, "analytics");
//
// Expected failures should still be returned explicitly by the handler — this is
// only the safety net for the ones nobody predicted.
export function withErrors(handler, label = "route") {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (e) {
      // Logged server-side with the label so it is findable in Vercel logs.
      console.error(`[${label}]`, e?.message || e);
      // …and put on the admin console's bell. Vercel keeps runtime logs for an
      // hour on this plan, so an error nobody watched for was simply gone
      // (owner, 2026-09-24: "I don't get any notifications when any error
      // occurs"). Repeats of the same route collapse into one row for ten
      // minutes — a route that starts failing fails a lot, and a bell that
      // rings a thousand times is a bell you switch off.
      //
      // Imported here rather than at the top: this module is the last line of
      // defence, and it must not be the thing that fails to load.
      import("@/lib/platform-events.js")
        .then(({ logEvent }) => logEvent({
          kind: "server_error",
          title: `${label} failed`,
          body: String(e?.message || e).slice(0, 300),
          url: "/admin",
        }))
        .catch(() => {});
      return NextResponse.json(
        { error: "Something went wrong on our side. Please try again." },
        { status: 500 }
      );
    }
  };
}
