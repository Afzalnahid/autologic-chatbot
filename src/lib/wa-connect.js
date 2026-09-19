import { supabase } from "@/lib/supabase.js";
import { ownedByAnotherClient, ALREADY_CONNECTED } from "@/lib/channels.js";
import { checkChannelQuota } from "@/lib/plan-limits.js";

const GRAPH = "https://graph.facebook.com/v24.0";

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

  // 2. Register the number on Cloud API. Without this the number is verified
  // but cannot send. A number already registered returns an error we ignore.
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const reg = await fetch(`${GRAPH}/${phoneId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
  if (reg.error) console.error("[wa-connect] register:", reg.error.message);
  else console.log("[wa-connect] registered phone", phoneId);

  // 3. Read the number back so the dashboard can show something human.
  let displayNumber = phoneId;
  let verifiedName = "WhatsApp Business";
  try {
    const info = await fetch(
      `${GRAPH}/${phoneId}?fields=display_phone_number,verified_name&access_token=${token}`
    ).then(r => r.json());
    if (info.display_phone_number) displayNumber = info.display_phone_number;
    if (info.verified_name) verifiedName = info.verified_name;
  } catch (e) {
    console.error("[wa-connect] could not read number details:", e.message);
  }

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
