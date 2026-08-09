export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";
import { getValidAccessToken, deleteEvent } from "@/lib/gcal.js";

export const GET = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(500);
  return NextResponse.json(data || []);
}, "bookings");

export const PUT = withErrors(async (request) => {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, status } = await request.json();

  // Read it first: cancelling needs the Google event id, and the row must belong
  // to this client before anything is touched.
  const { data: booking } = await supabase
    .from("bookings").select("calendar_event_id,status")
    .eq("id", id).eq("client_id", client.id).maybeSingle();
  if (!booking) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase.from("bookings").update({ status }).eq("id", id).eq("client_id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The dashboard is the source of truth, so Google follows it. A failure here
  // is reported but does not undo the cancellation — the owner asked for it, and
  // a booking that says "cancelled" in one place and "confirmed" in another is
  // worse than one stale calendar entry.
  let calendar = null;
  if (status === "Cancelled" && booking.calendar_event_id && client.gcal_connected) {
    try {
      const token = await getValidAccessToken(client);
      const r = await deleteEvent(token, booking.calendar_event_id);
      calendar = r.alreadyGone ? "already removed" : "removed";
    } catch (e) {
      console.error("[bookings] calendar cancel failed:", e.message);
      calendar = "failed";
    }
  }
  return NextResponse.json({ ok: true, calendar });
}, "bookings");
