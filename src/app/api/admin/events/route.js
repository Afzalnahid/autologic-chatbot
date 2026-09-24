export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { callerEmail, callerRole } from "@/lib/admin-auth.js";
import { eventMeta } from "@/lib/platform-events.js";

// The admin console's bell.
//
// Owner, 2026-09-24: "From the admin panel I don't get any notifications when
// any customer enters, or any error occurs, or something happens — it is bad
// for me."
//
// Read is open to any admin with a role, because seeing what is happening is
// not a privileged action — the privileged ones (approving a payment, changing
// a key) are guarded where they are done. Marking read is per-admin, so two
// people reading the same console do not clear each other's bell.

const LIMIT = 60;

async function listFor(email) {
  const { data: events, error } = await supabase
    .from("platform_events")
    .select("id,kind,severity,title,body,client_id,client_name,url,created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error(error.message);

  const ids = (events || []).map((e) => e.id);
  let readIds = [];
  if (ids.length) {
    const { data: reads } = await supabase
      .from("platform_event_reads").select("event_id").eq("email", email).in("event_id", ids);
    readIds = (reads || []).map((r) => r.event_id);
  }
  const seen = new Set(readIds);
  const rows = (events || []).map((e) => ({ ...e, icon: eventMeta(e.kind).icon, read: seen.has(e.id) }));
  return { events: rows, unread: rows.filter((r) => !r.read).length };
}

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!role || role === "pending" || role === "blocked") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await listFor(email), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!role || role === "pending" || role === "blocked") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "read_all") {
      const { data: events } = await supabase.from("platform_events").select("id").order("created_at", { ascending: false }).limit(LIMIT);
      const rows = (events || []).map((e) => ({ event_id: e.id, email }));
      // Upsert, not insert: pressing "mark all as read" twice must be the same
      // as pressing it once, not a duplicate-key error in the owner's face.
      if (rows.length) await supabase.from("platform_event_reads").upsert(rows, { onConflict: "event_id,email" });
      return NextResponse.json(await listFor(email));
    }
    if (body.action === "read" && body.id) {
      await supabase.from("platform_event_reads")
        .upsert({ event_id: Number(body.id), email }, { onConflict: "event_id,email" });
      return NextResponse.json(await listFor(email));
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
