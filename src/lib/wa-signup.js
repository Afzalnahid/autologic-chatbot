// WhatsApp Embedded Signup as a same-tab REDIRECT, not a popup.
//
// The popup version (Meta's JS SDK, FB.login) hands the new account's ids back
// to the page that opened it by postMessage. On a phone that page sits in a
// background tab for the whole signup, often 15–20 minutes, and Chrome freezes
// or reloads it to save memory — so the ids were posted to nobody and nothing
// was saved (seen live 2026-09-19: Meta created the account, our finish step
// never ran). A redirect has no opener to lose: Meta sends the browser straight
// back to our callback with a code, and the server finds the new account from
// that code alone. Pure functions only, so they are tested in tests/t-wa-signup.

// The state token marks a signup flow so /api/wa/callback can tell it apart
// from the "find my number" login that shares the same whitelisted redirect
// URL. Client ids are UUIDs, which never contain "_".
const ES = "es_";
export const markSignup = (clientId) => ES + clientId;
export function readSignup(raw) {
  const s = String(raw || "");
  return s.startsWith(ES) ? { clientId: s.slice(ES.length), signup: true } : { clientId: s || null, signup: false };
}

// Meta's OAuth dialog, driven by the Embedded Signup configuration, in the same
// tab. `extras` carries what FB.login's extras did: the business profile we
// pre-fill and which flavour of signup to open.
export function signupUrl({ appId, configId, redirect, state, prefill, featureType, version = "v26.0" }) {
  const p = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    redirect_uri: redirect,
    state,
    response_type: "code",
    override_default_response_type: "true",
    extras: JSON.stringify({ setup: prefill || {}, featureType: featureType || "", sessionInfoVersion: "3" }),
  });
  return `https://www.facebook.com/${version}/dialog/oauth?${p.toString()}`;
}

// The WhatsApp accounts this signup gave us, read from the token's
// granular_scopes (Graph /debug_token). Meta's documented way to find the WABA
// when the popup's session message is missing.
export function sharedWabaIds(debugData) {
  const scopes = (debugData && debugData.granular_scopes) || [];
  const ids = [];
  for (const s of scopes) {
    if (s.scope !== "whatsapp_business_management" && s.scope !== "whatsapp_business_messaging") continue;
    for (const id of s.target_ids || []) if (id && !ids.includes(String(id))) ids.push(String(id));
  }
  return ids;
}

// One number to connect. A signup normally leaves exactly one; if an account
// holds several, prefer a verified number over one still waiting for its code.
export function choosePhone(phones) {
  const list = (phones || []).filter((p) => p && p.id);
  if (!list.length) return null;
  const verified = list.find((p) => String(p.code_verification_status || "").toUpperCase() === "VERIFIED");
  return verified || list[0];
}
