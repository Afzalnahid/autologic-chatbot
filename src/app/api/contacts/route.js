export const dynamic = "force-dynamic";
// Re-enabling the bot can trigger a reply (LLM + Graph send), so allow room.
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { pageAll } from "@/lib/page.js";
import { requireClient } from "@/lib/auth.js";
import { botAllowed, processConversation } from "@/lib/bot.js";

// When the owner turns the bot back ON for one conversation, answer the last
// customer message that came in while it was paused. Only a genuinely unanswered
// message is left "Pending" (a human reply clears them), so this is a no-op when
// the owner already handled everything by hand. Best-effort and never throws —
// the toggle itself must always succeed.
async function replyToPending(client, senderId) {
  try {
    const { data: last } = await supabase.from("message_buffer")
      .select("platform,page_id,role,status")
      .eq("client_id", client.id).eq("sender_id", senderId)
      .order("created_at", { ascending: false }).limit(1);
    const top = last?.[0];
    // Nothing waiting, or the last word was the business's — nothing to answer.
    if (!top || top.role !== "customer" || top.status !== "Pending") return;
    // The website widget has no channel to push a proactive reply to.
    if (top.platform === "website") return;

    const { data: chans } = await supabase.from("channels").select("*")
      .eq("client_id", client.id).eq("status", "connected");
    const ch = (top.page_id && (chans || []).find((c) => c.page_id === top.page_id))
      || (chans || []).find((c) => c.platform === top.platform)
      || (chans || [])[0];
    if (!ch) return;

    // botAllowed re-checks the (now enabled) contact, the channel, quota and
    // suspension — so a lapsed plan or a paused channel still stays silent.
    const block = await botAllowed(ch, senderId);
    if (!block.allowed) return;
    await processConversation(ch, senderId, null);
  } catch (e) {
    console.error("[contacts] reply-to-pending on enable:", e?.message || e);
  }
}

export async function GET(request) {
  try {
    const { client, error } = await requireClient(request);
    // On an auth blip (e.g. the access token expired between the 45s polls)
    // reply 401 so api() refreshes the token and retries — NEVER a 200 carrying
    // a default global_bot_enabled:true, which silently flipped the owner's
    // saved "Bot OFF" back to ON on the next poll. A valid token with no client
    // row yet (mid-onboarding) returns an empty list but no switch value, so
    // the UI keeps showing "Loading…" instead of a wrong ON.
    if (error) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!client) return NextResponse.json({ contacts: [] });
    // Paged, not trusted: an unbounded select stops at db-max-rows and comes
    // back as a normal 200 with a short array, so a shop with more contacts
    // than the cap was shown a list quietly missing people.
    let contacts = [];
    try {
      contacts = (await pageAll((from, to) => supabase.from("contacts")
        .select("*").eq("client_id", client.id).range(from, to))).rows;
    } catch {
      // A failed read is not an empty address book, and "no contacts yet" is
      // the wrong thing to tell somebody who has thousands.
      return NextResponse.json({ error: "Could not load your contacts. Please try again." }, { status: 500 });
    }
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

    // Who has written recently, so a contact row can be made for anyone who
    // does not have one yet.
    //
    // This used to ask for EVERY customer message this client has ever had, on
    // every dashboard poll — and the Inbox polls every forty-five seconds. Two
    // things wrong with that: it grows without bound, and PostgREST answers an
    // unbounded select with at most its max-rows and says nothing, so past that
    // line the newest senders were the ones being dropped and their names never
    // resolved.
    //
    // Newest first and capped, which is the right shape anyway: this loop only
    // ever ADDS rows for senders that have none, and somebody who wrote months
    // ago has had a row since the poll that followed their message.
    const { data: allMsgs } = await supabase.from("message_buffer").select("sender_id,role,client_id,platform")
      .eq("client_id", client.id).eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(3000);
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
      // Write carefully. This loop runs on every dashboard poll, seconds after
      // its own SELECT — writing bot_enabled back from that stale snapshot
      // raced the owner's toggle PUT and silently flipped a fresh OFF back ON.
      // A NEW customer gets a row (bot on by default); an EXISTING row is only
      // ever touched to add a newly-found name, never its switch.
      //
      // `ignoreDuplicates` is what actually holds that rule. Without it the
      // guarantee rested on `map` being complete, and `map` comes from a SELECT
      // — so a read that came back short for any reason took the branch below,
      // upserted `bot_enabled: true` over a customer the owner had paused, and
      // turned their bot back on with nothing anywhere saying so. Now the write
      // can only ever INSERT: an existing row is untouched whatever the map
      // happens to believe.
      if (!map[sid]) {
        const { data: made } = await supabase.from("contacts")
          .upsert({ sender_id: sid, client_id: client.id, name, bot_enabled: true },
            { onConflict: "client_id,sender_id", ignoreDuplicates: true })
          .select("sender_id,name,bot_enabled");
        // Empty means a row was already there and was left alone — so we do
        // NOT know its switch, and must not answer as though it were on. It is
        // simply left out of this response; the next poll reads it properly.
        if (made?.length) map[sid] = { sender_id: sid, name, bot_enabled: true };
      } else if (name) {
        await supabase.from("contacts").update({ name }).eq("client_id", client.id).eq("sender_id", sid);
        map[sid] = { ...map[sid], name };
      }
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
    // Write AND read back in the same call: `saved` proves what actually
    // landed in the database, so a save that silently changed nothing can never
    // masquerade as success. If no row came back, the update matched nothing —
    // report that as a failure instead of a false "ok".
    const { data: saved, error: upErr } = isGlobal
      ? await supabase.from("channels").update({ bot_enabled }).eq("client_id", client.id).select("id,bot_enabled")
      // Flipping the switch for a customer means the owner has looked at them —
      // the "needs a person" flag is cleared either way.
      : await supabase.from("contacts").upsert({ sender_id, bot_enabled, needs_human: false, client_id: client.id }, { onConflict: "client_id,sender_id" }).select("sender_id,bot_enabled");
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    if (!saved || !saved.length) return NextResponse.json({ error: "Nothing was saved (no matching row)." }, { status: 500 });
    // Turning the bot back ON for one conversation: answer the message that came
    // in while it was off. (Global re-enable is left alone — it could span many
    // waiting chats; this is the per-conversation switch the owner just flipped.)
    if (bot_enabled === true && !isGlobal && sender_id) await replyToPending(client, sender_id);
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
