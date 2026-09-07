// Fill in the real name of every Facebook/Instagram contact that has none.
//
// WHY
// The inbox shows "User 5184" for a contact with no saved name. New messages now
// resolve the name from the Conversations API (the direct profile endpoint is
// gated behind an unapproved permission), but existing conversations keep showing
// "User …" until their next message. This backfills them in one pass.
//
// WHAT IT TOUCHES
//   • Only the `contacts` table, and only rows whose `name` is empty.
//   • Only Facebook and Instagram contacts (WhatsApp already stores the name from
//     its webhook). The name is read from the page's own conversation with that
//     person, using the page's stored access token.
//
// SAFE BY DEFAULT
// It is a DRY RUN unless you pass --write. The dry run prints every name it would
// set and changes nothing.
//
// HOW TO RUN  (from the project root)
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-contact-names.mjs
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-contact-names.mjs --write

import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY."); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

function participantName(json, senderId) {
  const parts = json?.data?.[0]?.participants?.data || [];
  const them = parts.find((p) => String(p?.id) === String(senderId));
  return String(them?.name || "").trim();
}

async function nameFor(pageId, senderId, token, platform) {
  if (!pageId || !senderId || !token) return "";
  try {
    const json = await fetch(
      `https://graph.facebook.com/v24.0/${pageId}/conversations?platform=${platform}` +
      `&user_id=${encodeURIComponent(senderId)}&fields=participants&access_token=${token}`
    ).then((r) => r.json());
    return participantName(json, senderId);
  } catch { return ""; }
}

async function main() {
  console.log(`Mode: ${WRITE ? "WRITE" : "DRY RUN (nothing will be saved)"}\n`);

  // Connected FB/IG channels, keyed by (client_id, page_id) → token.
  const { data: chans } = await sb.from("channels").select("client_id,page_id,platform,access_token,name")
    .in("platform", ["facebook", "instagram"]).eq("status", "connected");
  const tokenFor = new Map();
  for (const c of chans || []) tokenFor.set(`${c.client_id}/${c.page_id}`, { token: c.access_token, platform: c.platform, page: c.name });

  // Contacts with no name.
  const { data: contacts } = await sb.from("contacts").select("client_id,sender_id,name");
  const nameless = (contacts || []).filter((c) => !c.name);
  console.log(`Contacts without a name: ${nameless.length}\n`);

  let resolved = 0, wrote = 0;
  for (const c of nameless) {
    // Which page did this person message? Take it from their latest buffered row.
    const { data: mb } = await sb.from("message_buffer").select("page_id,platform")
      .eq("client_id", c.client_id).eq("sender_id", c.sender_id).order("created_at", { ascending: false }).limit(1);
    const pageId = mb?.[0]?.page_id;
    const plat = mb?.[0]?.platform;
    if (plat === "whatsapp" || plat === "website") continue; // not resolvable this way
    const ch = tokenFor.get(`${c.client_id}/${pageId}`);
    if (!ch) continue;
    const convPlatform = ch.platform === "instagram" ? "instagram" : "messenger";
    const name = await nameFor(pageId, c.sender_id, ch.token, convPlatform);
    if (!name) continue;
    resolved++;
    console.log(`  …${String(c.sender_id).slice(-6)}  ->  ${JSON.stringify(name)}   [${ch.page}]`);
    if (WRITE) {
      const { error } = await sb.from("contacts").upsert(
        { client_id: c.client_id, sender_id: c.sender_id, name },
        { onConflict: "client_id,sender_id" });
      if (error) console.error("   save failed:", error.message); else wrote++;
    }
  }

  console.log(`\nResolved ${resolved} name(s)${WRITE ? `, saved ${wrote}` : ""}.`);
  if (!WRITE && resolved) console.log("Dry run only. Re-run with --write to save them.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
