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

const LIMIT = 60;          // one page — what the bell shows without asking for more
const MARK_CAP = 500;      // how many "mark all as read" clears in one press

// One page of events, newest first. `before` is the id of the oldest row the
// console already has, so "show older" asks for what comes before it.
//
// Keyed on the ID, not an offset and not the timestamp. An offset shifts when a
// new event arrives between two pages, which silently skips a row. A timestamp
// looks safer but is worse: `created_at < oldest shown` also excludes any
// UNSHOWN row sharing that exact timestamp, and events raised in one loop can
// land in the same microsecond. The id is a bigserial, so it is monotonic with
// insertion order and can never tie.
//
// The count is deliberately NOT taken from this page. It used to be, so the
// badge could never say more than 60 however many were waiting, and "mark all
// as read" only ever cleared the page it could see (owner asked how much the
// panel holds, 2026-09-24).
async function listFor(email, { before = null, limit = LIMIT } = {}) {
  let q = supabase
    .from("platform_events")
    .select("id,kind,severity,title,body,client_id,client_name,url,created_at")
    .order("id", { ascending: false })
    .limit(limit + 1);                    // one extra, to learn whether more exist
  if (before) q = q.lt("id", before);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const page = (data || []).slice(0, limit);
  const hasMore = (data || []).length > limit;

  const ids = page.map((e) => e.id);
  let readIds = [];
  if (ids.length) {
    const { data: reads } = await supabase
      .from("platform_event_reads").select("event_id").eq("email", email).in("event_id", ids);
    readIds = (reads || []).map((r) => r.event_id);
  }
  const seen = new Set(readIds);
  const rows = page.map((e) => ({ ...e, icon: eventMeta(e.kind).icon, read: seen.has(e.id) }));
  return { events: rows, unread: await unreadFor(email), has_more: hasMore, total: await totalEvents() };
}

// Every event minus the ones this admin has marked read. Exact, and two cheap
// counts rather than reading any rows: a read mark is deleted with its event
// (ON DELETE CASCADE), so the subtraction cannot drift.
async function unreadFor(email) {
  const [all, mine] = await Promise.all([
    supabase.from("platform_events").select("id", { count: "exact", head: true }),
    supabase.from("platform_event_reads").select("event_id", { count: "exact", head: true }).eq("email", email),
  ]);
  return Math.max(0, (all.count || 0) - (mine.count || 0));
}

async function totalEvents() {
  const { count } = await supabase.from("platform_events").select("id", { count: "exact", head: true });
  return count || 0;
}

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!role || role === "pending" || role === "blocked") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const raw = new URL(request.url).searchParams.get("before");
    const before = raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
    return NextResponse.json(await listFor(email, { before }), { headers: { "Cache-Control": "no-store" } });
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
      // Everything, not only the page on screen — it used to clear the newest
      // 60 and leave the rest unread with no way to reach them. Bounded at
      // MARK_CAP so one press cannot turn into an unbounded write; more than
      // that and the next press clears the rest, which the console shows
      // because the count does not go to zero.
      const { data: events } = await supabase.from("platform_events")
        .select("id").order("id", { ascending: false }).limit(MARK_CAP);
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
