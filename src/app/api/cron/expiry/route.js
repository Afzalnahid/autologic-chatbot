export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { clientsExpiringSoon, warnIfExpiringSoon, WARN_DAYS } from "@/lib/expiry.js";

// Once a day: email every owner whose trial or plan ends within the next few
// days. Scheduled in vercel.json.
//
// Until this existed the warning only went out when an owner happened to open
// their dashboard, so the ones who never logged in — because the bot was working
// — were exactly the ones whose bot stopped without notice.
//
// Safe to run twice: warnIfExpiringSoon records the expiry date it warned about,
// so a second run the same day sends nothing.

// Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set on
// the project. If it is not set the endpoint still works — otherwise adding the
// cron would change nothing until someone remembered a second setup step, and
// the job would fail silently, which is the bug this is fixing. The work itself
// is idempotent and only ever sends a client their own renewal reminder, so an
// unauthenticated call cannot do damage; it is still worth locking down.
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron/expiry] CRON_SECRET is not set — this endpoint is open. Set it in the Vercel project settings.");
    return true;
  }
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let clients;
  try {
    clients = await clientsExpiringSoon(now);
  } catch (e) {
    console.error("[cron/expiry] could not read clients:", String(e?.message || e).slice(0, 200));
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  let sent = 0;
  const skipped = {};
  const failed = [];

  // One at a time, and one failure never stops the rest — a single bad address
  // must not cost every other owner their warning.
  for (const c of clients) {
    try {
      const r = await warnIfExpiringSoon(c, now);
      if (r.sent) sent++;
      else skipped[r.skipped] = (skipped[r.skipped] || 0) + 1;
    } catch (e) {
      failed.push({ client_id: c.id, error: String(e?.message || e).slice(0, 160) });
      console.error("[cron/expiry]", c.id, String(e?.message || e).slice(0, 200));
    }
  }

  console.log(`[cron/expiry] looked at ${clients.length}, warned ${sent}, failed ${failed.length}`);
  return NextResponse.json(
    { ok: true, window_days: WARN_DAYS, looked_at: clients.length, sent, skipped, failed },
    { headers: { "Cache-Control": "no-store" } }
  );
}
