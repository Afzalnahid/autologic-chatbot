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
      return NextResponse.json(
        { error: "Something went wrong on our side. Please try again." },
        { status: 500 }
      );
    }
  };
}
