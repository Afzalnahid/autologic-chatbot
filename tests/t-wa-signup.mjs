// The redirect-based WhatsApp signup: telling a signup callback from a login
// callback, building Meta's link, and finding the new account and number from
// what Meta returns. wa-signup.js has no imports, so it is loaded where it lives.
import { markSignup, readSignup, signupUrl, sharedWabaIds, choosePhone } from "../src/lib/wa-signup.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };
const id = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

// state marker
ok(readSignup(markSignup(id)).signup === true, "a marked state reads as a signup");
ok(readSignup(markSignup(id)).clientId === id, "the client id survives the marker");
ok(readSignup(id).signup === false && readSignup(id).clientId === id, "a plain client id is a login, not a signup");
ok(readSignup(null).clientId === null && readSignup("").clientId === null, "no state gives no client");
ok(!/_/.test(id), "UUID client ids never contain the marker character");

// the link
const url = new URL(signupUrl({ appId: "914246304594380", configId: "1417283913551939", redirect: "https://www.tellmoreai.com/api/wa/callback", state: "S.1.x", prefill: { business: { name: "Nandi" } }, featureType: "whatsapp_business_app_onboarding" }));
ok(url.origin === "https://www.facebook.com" && url.pathname === "/v26.0/dialog/oauth", "opens Meta's OAuth dialog");
ok(url.searchParams.get("config_id") === "1417283913551939", "carries the Embedded Signup configuration");
ok(url.searchParams.get("redirect_uri") === "https://www.tellmoreai.com/api/wa/callback", "returns to the whitelisted callback");
ok(url.searchParams.get("response_type") === "code" && url.searchParams.get("override_default_response_type") === "true", "asks for a code");
ok(url.searchParams.get("state") === "S.1.x", "carries the signed state");
const extras = JSON.parse(url.searchParams.get("extras"));
ok(extras.setup.business.name === "Nandi" && extras.featureType === "whatsapp_business_app_onboarding" && extras.sessionInfoVersion === "3", "extras carry the pre-fill and the signup flavour");

// finding the account
const dbg = { granular_scopes: [
  { scope: "business_management", target_ids: ["111"] },
  { scope: "whatsapp_business_management", target_ids: ["222", "333"] },
  { scope: "whatsapp_business_messaging", target_ids: ["222"] },
] };
ok(JSON.stringify(sharedWabaIds(dbg)) === JSON.stringify(["222", "333"]), "WhatsApp scopes only, each account once");
ok(sharedWabaIds({}).length === 0 && sharedWabaIds(null).length === 0, "no scopes → no accounts");
ok(sharedWabaIds({ granular_scopes: [{ scope: "whatsapp_business_management" }] }).length === 0, "a scope with no targets adds nothing");

// picking the number
ok(choosePhone([]) === null && choosePhone(null) === null, "no numbers → nothing to connect");
ok(choosePhone([{ id: "9" }]).id === "9", "a single number is chosen");
ok(choosePhone([{ id: "1", code_verification_status: "NOT_VERIFIED" }, { id: "2", code_verification_status: "VERIFIED" }]).id === "2", "a verified number wins over an unverified one");
ok(choosePhone([{ id: "1", code_verification_status: "EXPIRED" }, { id: "2" }]).id === "1", "with none verified, the first is taken");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
