export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { callerEmail, callerRole, CAN_DELETE, checkSuperKey } from "@/lib/admin-auth.js";

// Meta webhook health — the APP-level subscription (App Dashboard → Webhooks →
// Page). Two subscriptions must BOTH carry a field before Meta delivers it:
// the app's (this one, set once per app) and each Page's (`subscribed_apps`,
// set when a Page connects). `message_echoes` — the only way we learn that the
// owner answered a customer by hand in Business Suite / Messenger — was on
// every Page's list but missing from the app's, so no echo ever arrived
// (2026-09-11: an hour of webhook logs held customer messages only, while
// customers were visibly replying to the owner's answers). This route shows
// the app's subscription and repairs it, server-side: the app secret never
// leaves the server, and only a full-access admin holding the secret admin
// key can change anything.

const GRAPH = "https://graph.facebook.com/v24.0";
// What the Page webhook must carry for the product to work at all.
const PAGE_FIELDS = ["messages", "messaging_postbacks", "message_echoes", "feed"];   // not exported: a route file may only export handlers
const CALLBACK = "https://www.getvoicium.com/api/messenger";

function appCreds() {
  const id = process.env.FB_APP_ID || "";
  const secret = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET || "";
  if (!id || !secret) return null;
  return { id, token: `${id}|${secret}` };
}

async function readSubscriptions(creds) {
  const j = await fetch(`${GRAPH}/${creds.id}/subscriptions?access_token=${encodeURIComponent(creds.token)}`, { cache: "no-store" })
    .then((r) => r.json()).catch((e) => ({ error: { message: String(e?.message || e) } }));
  if (j.error) throw new Error(j.error.message || "Graph error");
  const page = (j.data || []).find((s) => s.object === "page") || null;
  const fields = (page?.fields || []).map((f) => (typeof f === "string" ? f : f?.name)).filter(Boolean);
  return {
    page: page ? { callback_url: page.callback_url || "", active: !!page.active, fields } : null,
    missing: PAGE_FIELDS.filter((f) => !fields.includes(f)),
  };
}

async function guard(request) {
  const email = await callerEmail(request);
  if (!email) return { err: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const role = await callerRole(email);
  if (!CAN_DELETE.includes(role)) return { err: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const creds = appCreds();
  if (!creds) return { err: NextResponse.json({ error: "The server has no FB_APP_ID / FB_APP_SECRET configured." }, { status: 500 }) };
  return { creds };
}

export async function GET(request) {
  const g = await guard(request);
  if (g.err) return g.err;
  try {
    const s = await readSubscriptions(g.creds);
    return NextResponse.json({ ok: true, required: PAGE_FIELDS, ...s }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Could not read the app's webhook subscription: " + String(e.message || e).slice(0, 200) }, { status: 502 });
  }
}

// Repair: re-subscribe the "page" object with the union of what it has and
// what we need. Meta REPLACES the field list on this call, so the current
// fields are kept on purpose. Meta verifies the callback with a GET
// (hub.verify_token) before accepting — our /api/messenger answers it with
// FACEBOOK_VERIFY_TOKEN, which must therefore be the token sent here.
export async function POST(request) {
  const g = await guard(request);
  if (g.err) return g.err;
  const keyErr = checkSuperKey(request);
  if (keyErr) return NextResponse.json({ error: keyErr }, { status: 403 });
  const verify = process.env.FACEBOOK_VERIFY_TOKEN || "";
  if (!verify) return NextResponse.json({ error: "The server has no FACEBOOK_VERIFY_TOKEN configured." }, { status: 500 });
  try {
    const before = await readSubscriptions(g.creds);
    const fields = Array.from(new Set([...(before.page?.fields || []), ...PAGE_FIELDS]));
    const form = new URLSearchParams({
      object: "page",
      callback_url: before.page?.callback_url || CALLBACK,
      fields: fields.join(","),
      verify_token: verify,
      include_values: "true",
      access_token: g.creds.token,
    });
    const j = await fetch(`${GRAPH}/${g.creds.id}/subscriptions`, { method: "POST", body: form, cache: "no-store" })
      .then((r) => r.json()).catch((e) => ({ error: { message: String(e?.message || e) } }));
    if (j.error) return NextResponse.json({ error: "Meta refused the change: " + String(j.error.message || "").slice(0, 200) }, { status: 502 });
    const after = await readSubscriptions(g.creds);
    console.log("[admin/webhooks] page fields set:", fields.join(","), "→ now:", (after.page?.fields || []).join(","));
    return NextResponse.json({ ok: true, required: PAGE_FIELDS, ...after }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Repair failed: " + String(e.message || e).slice(0, 200) }, { status: 502 });
  }
}
