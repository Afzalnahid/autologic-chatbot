export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { getValidAccessToken, getEventMeetLink } from "@/lib/gcal.js";

// A fresh path. /api/bookings had a cached response sitting in front of it, so
// the function never ran and the list never changed — no logs, no new bookings,
// no amount of refreshing helping. Nothing has ever been cached here.
export const GET = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) {
    return NextResponse.json({ bookings: [], error: "auth" }, { status: authErr ? 401 : 200 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[bookings/list] query failed:", error.message);
    return NextResponse.json({ bookings: [], error: error.message }, { status: 500 });
  }

  const rows = data || [];
  console.log("[bookings/list] client", client.id, "rows", rows.length,
    "platforms", [...new Set(rows.map((r) => r.platform))].join(","));

  // Events whose Meet room finished building after the booking was saved.
  const orphans = rows.filter(
    (b) => b.calendar_event_id && !b.meeting_link && b.status !== "Cancelled"
  ).slice(0, 5);

  if (orphans.length && client.gcal_connected) {
    try {
      const token = await getValidAccessToken(client);
      await Promise.all(orphans.map(async (b) => {
        const link = await getEventMeetLink(token, b.calendar_event_id);
        if (!link) return;
        await supabase.from("bookings").update({ meeting_link: link })
          .eq("id", b.id).eq("client_id", client.id);
        b.meeting_link = link;
      }));
      console.log("[bookings/list] filled meet links for", orphans.length, "booking(s)");
    } catch (e) {
      console.error("[bookings/list] meet link backfill:", e.message);
    }
  }

  return NextResponse.json({ bookings: rows, count: rows.length }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "CDN-Cache-Control": "no-store" },
  });
}, "bookings-list");
