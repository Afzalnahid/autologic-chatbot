import { supabase } from "@/lib/supabase.js";
import { ownedByAnotherClient, ALREADY_CONNECTED } from "@/lib/channels.js";
import { checkChannelQuota } from "@/lib/plan-limits.js";
import { pinFor, registerVerdict } from "@/lib/wa-register.js";

const GRAPH = "https://graph.facebook.com/v24.0";
// The server-only secret the two-step PIN is derived from (same fallback chain
// as the OAuth state signer). Changing it would change every future PIN.
const PIN_SECRET = process.env.OAUTH_STATE_SECRET || process.env.FB_APP_SECRET || process.env.SUPABASE_SERVICE_KEY || "";

// The last step of every WhatsApp Embedded Signup, whichever way the browser
// came back: subscribe our webhook to the WhatsApp account, register the number
// on Cloud API so it can send, read its display name, and save the channel.
// `token` is the business token Meta gave us for this client's account.
// Returns { ok, number, name } or { error, status }.
export async function completeWhatsApp({ clientId, token, wabaId, phoneId }) {
  // One WhatsApp number powers exactly one TellMore AI account. Checked before
  // any Meta call so a taken number costs nothing.
  if (await ownedByAnotherClient("whatsapp", phoneId, clientId)) {
    return { error: ALREADY_CONNECTED.whatsapp, status: 409 };
  }
  const cq = await checkChannelQuota(clientId, "whatsapp", phoneId);
  if (!cq.ok) return { error: cq.message, status: 403 };

  // 1. Subscribe our webhook to the WABA so incoming messages reach us.
  if (wabaId) {
    const sub = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
    if (sub.error) console.error("[wa-connect] WABA subscribe failed:", sub.error.message);
    else console.log("[wa-connect] subscribed webhook to WABA", wabaId);
  }

  // 2. Register the number on Cloud API — without this it is verified but
  // cannot send. The PIN is the same for the same number every time (pinFor),
  // so a reconnect by us matches the PIN we set before.
  const reg = await fetch(`${GRAPH}/${phoneId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", pin: pinFor(phoneId, PIN_SECRET) }),
  }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

  // 3. Read the number back: its name for the dashboard, and Meta's own record
  // of whether it is on Cloud API, which decides a refused registration.
  let info = null;
  try {
    info = await fetch(
      `${GRAPH}/${phoneId}?fields=display_phone_number,verified_name,platform_type,status&access_token=${token}`
    ).then(r => r.json());
  } catch (e) {
    console.error("[wa-connect] could not read number details:", e.message);
  }
  // A refused registration on a number shared from the WhatsApp Business app
  // (coexistence) is expected. Asked separately: an older API version that does
  // not know the field would fail the whole read above.
  if (reg.error && String(info?.platform_type || "").toUpperCase() !== "CLOUD_API") {
    const biz = await fetch(`${GRAPH}/${phoneId}?fields=is_on_biz_app&access_token=${token}`)
      .then(r => r.json()).catch(() => null);
    if (biz && biz.is_on_biz_app === true) info = { ...(info || {}), is_on_biz_app: true };
  }
  const verdict = registerVerdict(reg, info);
  if (reg.error) console.error(`[wa-connect] register ${phoneId}: code ${reg.error.code}/${reg.error.error_subcode || "-"} ${reg.error.message} → platform ${info?.platform_type || "?"} → ${verdict.ok ? "ok (already on Cloud API)" : verdict.reason}`);
  else console.log("[wa-connect] registered phone", phoneId);
  // Never say "Connected" for a number that cannot send. Nothing is saved, so
  // the owner fixes the cause and connects again.
  if (!verdict.ok) return { error: verdict.message, status: 409 };

  const displayNumber = info?.display_phone_number || phoneId;
  const verifiedName = info?.verified_name || "WhatsApp Business";

  // onConflict must name a real unique index: (client_id, platform, page_id).
  const { error: dbErr } = await supabase.from("channels").upsert(
    {
      client_id: clientId,
      platform: "whatsapp",
      page_id: phoneId,
      access_token: token,
      name: [verifiedName, displayNumber].filter(Boolean).join(" · ") || null,
      status: "connected",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "client_id,platform,page_id" }
  );
  if (dbErr) {
    console.error("[wa-connect] save failed:", dbErr.message);
    return { error: "Could not save the connection. Please try again.", status: 500 };
  }
  return { ok: true, number: displayNumber, name: verifiedName };
}
