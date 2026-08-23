export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function GET(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ contacts: [], global_bot_enabled: true });
    const { data: contactRows, error: e1 } = await supabase.from("contacts").select("*").eq("client_id", client.id);
    const contacts = contactRows || [];
    // Any connected OR paused channel — a paused channel keeps its access token,
    // and the owner should still see who is messaging even while the bot is off.
    // Fetching names must not depend on the bot being live.
    const { data: chans } = await supabase.from("channels").select("*").eq("client_id", client.id).neq("status", "disconnected");
    const channels = chans || [];
    const byPlatform = Object.fromEntries(channels.map(c => [c.platform, c]));
    // The account-wide bot switch lives on the messaging channels; a website
    // widget row (bot_enabled null) must never answer for it, or the switch
    // reads ON forever regardless of what was saved.
    const ch = byPlatform.facebook || channels.find(c => c.platform !== "website") || channels[0];

    const { data: allMsgs } = await supabase.from("message_buffer").select("sender_id,role,client_id,platform")
      .eq("client_id", client.id).eq("role", "customer");
    const senders = allMsgs || [];
    const uniq = [...new Set(senders.map(s => s.sender_id).filter(Boolean))];
    const platformOf = {};
    for (const m of senders) if (m.sender_id && !platformOf[m.sender_id]) platformOf[m.sender_id] = m.platform || "facebook";
    const map = Object.fromEntries((contacts || []).map(c => [c.sender_id, c]));

    for (const sid of uniq) {
      if (map[sid]?.name) continue;
      let name = null;
      const plat = platformOf[sid] || "facebook";
      const chan = byPlatform[plat] || ch;
      if (plat === "facebook" && chan?.access_token) {
        try {
          const d = await fetch(`https://graph.facebook.com/v24.0/${sid}?fields=first_name,last_name&access_token=${chan.access_token}`).then(r => r.json());
          if (d.first_name) name = `${d.first_name} ${d.last_name || ""}`.trim();
        } catch {}
      } else if (plat === "instagram" && chan?.access_token) {
        try {
          const d = await fetch(`https://graph.facebook.com/v24.0/${sid}?fields=name,username&access_token=${chan.access_token}`).then(r => r.json());
          if (d.username) name = "@" + d.username;
          else if (d.name) name = d.name;
        } catch {}
      }
      await supabase.from("contacts").upsert({ sender_id: sid, client_id: client.id, name, bot_enabled: map[sid]?.bot_enabled ?? true }, { onConflict: "client_id,sender_id" });
      map[sid] = { sender_id: sid, name, bot_enabled: map[sid]?.bot_enabled ?? true };
    }
    return NextResponse.json({ contacts: Object.values(map), global_bot_enabled: ch?.bot_enabled ?? true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { sender_id, bot_enabled, global: isGlobal } = await request.json();
    if (isGlobal) {
      await supabase.from("channels").update({ bot_enabled }).eq("client_id", client.id);
    } else {
      await supabase.from("contacts").upsert({ sender_id, bot_enabled, client_id: client.id }, { onConflict: "client_id,sender_id" });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
