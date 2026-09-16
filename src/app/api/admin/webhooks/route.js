export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { callerEmail, callerRole, CAN_DELETE, checkSuperKey } from "@/lib/admin-auth.js";

// Meta webhook health — the APP-level subscriptions (App Dashboard → Webhooks).
// Two subscriptions must BOTH carry a field before Meta delivers it: the
// app's (this one, set once per app) and each Page's / account's / WABA's
// (set when a channel connects). `message_echoes` — the only way we learn
// that the owner answered a customer by hand in Business Suite / Messenger —
// was on every Page's list but missing from the app's, so no echo ever
// arrived (2026-09-11; repaired from the admin console the same day and
// verified end to end). The WhatsApp twin is `smb_message_echoes` (a reply
// typed on the owner's own phone); Instagram echoes ride the ordinary
// `messages` field. This route shows each object's list and repairs it,
// server-side: the app secrets never leave the server, and only a
// full-access admin holding the secret admin key can change anything.

const GRAPH = "https://graph.facebook.com/v24.0";
const SITE = "https://www.tellmoreai.com";

// object → which Meta app owns it, what it must carry, where Meta calls back.
// Not exported: a route file may only export handlers.
const OBJECTS = {
  page: { app: "facebook", label: "Facebook Pages", required: ["messages", "messaging_postbacks", "message_echoes", "feed"], callback: `${SITE}/api/messenger` },
  whatsapp_business_account: { app: "facebook", label: "WhatsApp", required: ["messages", "smb_message_echoes"], callback: `${SITE}/api/whatsapp` },
  instagram: { app: "instagram", label: "Instagram", required: ["messages", "comments"], callback: `${SITE}/api/messenger` },
};

function apps() {
  const out = {};
  const fbId = process.env.FB_APP_ID || "", fbSecret = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET || "";
  if (fbId && fbSecret) out.facebook = { id: fbId, token: `${fbId}|${fbSecret}` };
  const igId = process.env.IG_APP_ID || "", igSecret = process.env.IG_APP_SECRET || "";
  if (igId && igSecret) out.instagram = { id: igId, token: `${igId}|${igSecret}` };
  return out;
}

async function readApp(creds) {
  const j = await fetch(`${GRAPH}/${creds.id}/subscriptions?access_token=${encodeURIComponent(creds.token)}`, { cache: "no-store" })
    .then((r) => r.json()).catch((e) => ({ error: { message: String(e?.message || e) } }));
  if (j.error) throw new Error(j.error.message || "Graph error");
  return j.data || [];
}

// One row per object we care about: what is on, what is missing, or why we
// could not look (app not configured / Meta refused).
async function status() {
  const creds = apps();
  const cache = {};
  const rows = [];
  for (const [object, def] of Object.entries(OBJECTS)) {
    const c = creds[def.app];
    if (!c) { rows.push({ object, label: def.label, app: def.app, error: `The server has no ${def.app === "facebook" ? "FB_APP_ID / FB_APP_SECRET" : "IG_APP_ID / IG_APP_SECRET"} configured.` , required: def.required, fields: [], missing: def.required }); continue; }
    try {
      if (!cache[def.app]) cache[def.app] = await readApp(c);
      const sub = cache[def.app].find((s) => s.object === object) || null;
      const fields = (sub?.fields || []).map((f) => (typeof f === "string" ? f : f?.name)).filter(Boolean);
      rows.push({ object, label: def.label, app: def.app, subscribed: !!sub, callback_url: sub?.callback_url || "", active: !!sub?.active, required: def.required, fields, missing: def.required.filter((f) => !fields.includes(f)),
        // The callback must be this site's canonical address. An old host (the
        // retired getvoicium.com, the vercel.app alias) is flagged so the
        // repair moves it; a redirecting host would silently drop every POST.
        expected_callback: def.callback, callback_ok: (sub?.callback_url || "") === def.callback });
    } catch (e) {
      rows.push({ object, label: def.label, app: def.app, error: "Could not read the app's subscription: " + String(e.message || e).slice(0, 160), required: def.required, fields: [], missing: def.required });
    }
  }
  return rows;
}

async function guard(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function GET(request) {
  const err = await guard(request);
  if (err) return err;
  return NextResponse.json({ ok: true, objects: await status() }, { headers: { "Cache-Control": "no-store" } });
}

// Repair ONE object: re-subscribe with the union of what it has and what we
// need, on this site's canonical callback address (www.tellmoreai.com) — an
// object still pointing at an old host is moved here by the same click. Meta
// REPLACES the field list on this call, so the current fields are kept on
// purpose. Meta verifies the callback with a GET (hub.verify_token)
// before accepting — our webhook routes answer it with FACEBOOK_VERIFY_TOKEN,
// which must therefore be the token sent here.
export async function POST(request) {
  const err = await guard(request);
  if (err) return err;
  const keyErr = checkSuperKey(request);
  if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const object = String(body.object || "page");
  const def = OBJECTS[object];
  if (!def) return NextResponse.json({ error: "Unknown webhook object." }, { status: 400 });
  const creds = apps()[def.app];
  if (!creds) return NextResponse.json({ error: `The server has no ${def.app === "facebook" ? "FB_APP_ID / FB_APP_SECRET" : "IG_APP_ID / IG_APP_SECRET"} configured.` }, { status: 500 });
  const verify = process.env.FACEBOOK_VERIFY_TOKEN || "";
  if (!verify) return NextResponse.json({ error: "The server has no FACEBOOK_VERIFY_TOKEN configured." }, { status: 500 });
  try {
    const before = (await readApp(creds)).find((s) => s.object === object) || null;
    const have = (before?.fields || []).map((f) => (typeof f === "string" ? f : f?.name)).filter(Boolean);
    const fields = Array.from(new Set([...have, ...def.required]));
    const form = new URLSearchParams({
      object,
      callback_url: def.callback,
      fields: fields.join(","),
      verify_token: verify,
      include_values: "true",
      access_token: creds.token,
    });
    const j = await fetch(`${GRAPH}/${creds.id}/subscriptions`, { method: "POST", body: form, cache: "no-store" })
      .then((r) => r.json()).catch((e) => ({ error: { message: String(e?.message || e) } }));
    if (j.error) return NextResponse.json({ error: "Meta refused the change: " + String(j.error.message || "").slice(0, 200) }, { status: 502 });
    console.log("[admin/webhooks]", object, "callback:", def.callback, "fields set:", fields.join(","));
    return NextResponse.json({ ok: true, objects: await status() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Repair failed: " + String(e.message || e).slice(0, 200) }, { status: 502 });
  }
}
