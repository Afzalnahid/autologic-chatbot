export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";
import { withErrors } from "@/lib/route-errors.js";
import { tagsFor, COMPLAINT } from "@/lib/tags.js";

const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } };

export const GET = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("conversation_tags").select("sender_id, tag, source")
    .eq("client_id", client.id);

  const byConversation = {};
  const counts = {};
  for (const r of data || []) {
    (byConversation[r.sender_id] ||= []).push({ tag: r.tag, source: r.source });
    counts[r.tag] = (counts[r.tag] || 0) + 1;
  }

  return NextResponse.json({
    available: tagsFor(client.business_type),
    complaint_tag: COMPLAINT,
    complaint_count: counts[COMPLAINT] || 0,
    counts,
    tags: byConversation,
  }, NO_CACHE);
}, "tags");

// Manual always wins: adding one clears whatever the bot guessed, and the bot
// never touches a conversation that has a manual tag afterwards.
export const POST = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const senderId = String(body.sender_id || "").trim();
  const tag = String(body.tag || "").trim();
  if (!senderId || !tag) return NextResponse.json({ error: "Missing conversation or tag" }, { status: 400 });

  const allowed = tagsFor(client.business_type);
  if (!allowed.includes(tag)) return NextResponse.json({ error: "That tag is not available for this business type" }, { status: 400 });

  if (body.action === "remove") {
    await supabase.from("conversation_tags").delete()
      .eq("client_id", client.id).eq("sender_id", senderId).eq("tag", tag);
    return NextResponse.json({ ok: true }, NO_CACHE);
  }

  await supabase.from("conversation_tags").delete()
    .eq("client_id", client.id).eq("sender_id", senderId).eq("source", "auto");

  const { error: insErr } = await supabase.from("conversation_tags")
    .insert({ client_id: client.id, sender_id: senderId, tag, source: "manual" });
  if (insErr && insErr.code !== "23505") {
    console.error("[tags] manual insert:", insErr.message);
    return NextResponse.json({ error: "Could not save the tag. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, NO_CACHE);
}, "tags");
