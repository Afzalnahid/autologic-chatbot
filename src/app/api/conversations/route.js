export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { pageAll } from "@/lib/page.js";
import { requireClient } from "@/lib/auth.js";
import { runFollowups } from "@/lib/followup.js";
import { shapeMessage } from "@/lib/messages-view.js";

export async function DELETE(request) {
  try {
    const { sender_id } = await request.json();
    if (!sender_id) return NextResponse.json({ error: "missing sender_id" }, { status: 400 });
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    await supabase.from("message_buffer").delete().eq("sender_id", sender_id).eq("client_id", client.id);
    await supabase.from("chat_memory").delete().eq("session_id", sender_id).eq("client_id", client.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });

  // Follow-ups are evaluated here rather than on a schedule. The function
  // throttles itself, so most dashboard loads do nothing at all.
  try {
    const { data: st } = await supabase.from("app_settings").select("settings").eq("id", String(client.id)).maybeSingle();
    await runFollowups(client, st?.settings || {});
  } catch (e) {
    console.error("[followup] run:", e.message);
  }

  try {
    // This builds the conversation LIST — one row per chat, its latest message as
    // the preview. The FULL history of a chat is loaded on open by
    // /api/conversations/messages, so this window only has to be wide enough that
    // every conversation still has at least its latest message in it. Only the
    // columns the list needs, so a wider window stays a light poll.
    const { data: all } = await supabase.from("message_buffer")
      .select("sender_id,role,message_content,attachments,created_at,status,platform,page_id")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(2000);
    const messages = all || [];

    // Paged: this only supplies names, but a short read means the
    // conversations further down the list lose theirs for no visible reason.
    // A failure here is swallowed on purpose — the inbox is still usable
    // without names, which is not true of the contact list itself.
    const contactRows = await pageAll((from, to) => supabase.from("contacts")
      .select("sender_id,name")
      .eq("client_id", client.id).range(from, to))
      .then((r) => r.rows)
      .catch((e) => { console.error("[conversations] contact names:", e.message); return []; });
    const nameOf = Object.fromEntries(
      (contactRows || []).filter(c => c.name).map(c => [c.sender_id, c.name])
    );
    const displayName = (sid, platform) => {
      if (nameOf[sid]) return nameOf[sid];
      // WhatsApp sender_id is the customer's phone number in international format
      if (platform === "whatsapp" && /^\d{6,}$/.test(sid || "")) return "+" + sid;
      return "User " + (sid || "").slice(-4);
    };

    const grouped = {};
    messages.forEach(m => {
      const sid = m.sender_id;
      const shaped = shapeMessage(m);
      if (!grouped[sid]) {
        const platform = m.platform || "facebook";
        grouped[sid] = {
          // page_id = which Page/account/number this thread lives on (messages
          // are newest-first, so the first row wins; null on old threads).
          id: sid, sender: displayName(sid, platform), platform, page_id: m.page_id || null,
          status: m.status === "Pending" ? "active" : "resolved",
          lastMsg: shaped.text.slice(0, 60), time: m.created_at, messages: [],
        };
      }
      grouped[sid].messages.push(shaped);
    });
    const result = Object.values(grouped);
    result.forEach(c => c.messages.sort((a, b) => new Date(a.time) - new Date(b.time)));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
