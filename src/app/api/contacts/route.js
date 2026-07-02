export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function GET() {
  try {
    const { data: contacts, error: e1 } = await supabase.from("contacts").select("sender_id, name, bot_enabled");
    const { data: ch, error: e2 } = await supabase.from("channels").select("access_token, client_id, bot_enabled").eq("status", "connected").limit(1).single();

    const { data: senders, error: e3 } = await supabase.from("message_buffer").select("sender_id").eq("role", "customer");
    const uniq = [...new Set((senders || []).map(s => s.sender_id).filter(Boolean))];
    const map = Object.fromEntries((contacts || []).map(c => [c.sender_id, c]));

    for (const sid of uniq) {
      if (map[sid]?.name) continue;
      let name = null;
      if (ch?.access_token) {
        try {
          const r = await fetch(`https://graph.facebook.com/v24.0/${sid}?fields=first_name,last_name&access_token=${ch.access_token}`);
          const d = await r.json();
          if (d.first_name) name = `${d.first_name} ${d.last_name || ""}`.trim();
        } catch {}
      }
      await supabase.from("contacts").upsert({ sender_id: sid, client_id: ch?.client_id, name, bot_enabled: map[sid]?.bot_enabled ?? true }, { onConflict: "sender_id" });
      map[sid] = { sender_id: sid, name, bot_enabled: map[sid]?.bot_enabled ?? true };
    }
    return NextResponse.json({ contacts: Object.values(map), global_bot_enabled: ch?.bot_enabled ?? true, _dbg: { e1: e1?.message, e2: e2?.message, e3: e3?.message, senders: uniq.length } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { sender_id, bot_enabled, global: isGlobal } = await request.json();
    if (isGlobal) {
      await supabase.from("channels").update({ bot_enabled }).eq("status", "connected");
    } else {
      await supabase.from("contacts").upsert({ sender_id, bot_enabled }, { onConflict: "sender_id" });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
