// Registering a WhatsApp number: the PIN we use, and when a refused registration
// still means the number can send. wa-register.js imports only node's crypto,
// so it is loaded where it lives.
import { pinFor, registerVerdict } from "../src/lib/wa-register.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};

// The PIN.
const a = pinFor("1296526726883536", "s3cret");
ok("the PIN is six digits", /^\d{6}$/.test(a), a);
ok("the same number gets the same PIN every time", a === pinFor("1296526726883536", "s3cret"));
ok("another number gets another PIN", a !== pinFor("1296526726883537", "s3cret"));
ok("another secret gives another PIN", a !== pinFor("1296526726883536", "other"));
ok("a leading zero is kept", /^\d{6}$/.test(pinFor("7", "x")) && [...Array(200).keys()].every((i) => pinFor(String(i), "k").length === 6));

// Registered.
ok("a successful registration is ok", registerVerdict({ success: true }, null).ok);

// Someone else's PIN.
const pin = registerVerdict({ error: { code: 133005, message: "Two step verification PIN Mismatch" } }, { platform_type: "CLOUD_API" });
ok("a PIN mismatch is refused even if Meta lists the number on Cloud API", !pin.ok && pin.reason === "pin", pin);
ok("and tells the owner where to turn the PIN off", /WhatsApp Manager/.test(pin.message) && /Two-step verification/.test(pin.message), pin.message);
ok("too many PIN guesses reads the same", registerVerdict({ error: { code: 133008 } }, null).reason === "pin");
ok("a PIN code in the subcode counts too", registerVerdict({ error: { code: 100, error_subcode: 133005 } }, null).reason === "pin");

// Other actionable refusals.
ok("re-verification needed", registerVerdict({ error: { code: 133006 } }, null).reason === "verify");
ok("rate limited", registerVerdict({ error: { code: 133016 } }, null).reason === "later");

// Already live: an unknown refusal on a number Meta lists on Cloud API.
const already = registerVerdict({ error: { code: 100, message: "Invalid parameter" } }, { platform_type: "CLOUD_API", status: "CONNECTED" });
ok("already on Cloud API → ok", already.ok && already.already, already);
ok("platform type is compared without case", registerVerdict({ error: { code: 1 } }, { platform_type: "cloud_api" }).ok);
ok("shared from the WhatsApp Business app → ok", registerVerdict({ error: { code: 1 } }, { platform_type: "NOT_APPLICABLE", is_on_biz_app: true }).ok);

// Not live, cause unknown: refused, with Meta's words.
const other = registerVerdict({ error: { code: 1, message: "Something odd" } }, { platform_type: "NOT_APPLICABLE" });
ok("not on Cloud API → refused", !other.ok && other.reason === "other", other);
ok("and quotes what Meta said", /Something odd/.test(other.message), other.message);
ok("an unreadable number record is refused, not assumed fine", !registerVerdict({ error: { code: 1 } }, { error: { message: "x" } }).ok);
ok("no record at all is refused too", !registerVerdict({ error: { code: 1 } }, null).ok);
ok("a network failure (no code) is refused", !registerVerdict({ error: { message: "fetch failed" } }, null).ok);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
