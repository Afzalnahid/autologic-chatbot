// Meta's deauthorize and data-deletion callbacks act only on a request signed
// with our app secret. A forged, tampered or malformed signed_request must be
// refused without throwing — the Instagram deauth route once accepted any JSON
// user_id, and the data-deletion route crashed with a 500 on junk.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { parseSignedRequest, verifySignedRequest, readSignedRequest, makeSignedRequest } =
  await import(pathToFileURL(join(here, "..", "src", "lib", "meta-signed-request.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const FB = "fb-secret-for-tests", IG = "ig-secret-for-tests";
const good = makeSignedRequest({ algorithm: "HMAC-SHA256", issued_at: 1789600000, user_id: "17841400000000001" }, IG);

ok("a genuine request verifies and returns the user id",
  parseSignedRequest(good, IG)?.user_id === "17841400000000001");
ok("the same request with another app's secret is refused", parseSignedRequest(good, FB) === null);
ok("verifySignedRequest names the app whose secret matched",
  verifySignedRequest(good, { facebook: FB, instagram: IG })?.app === "instagram");
ok("verifySignedRequest returns the user id as a string",
  verifySignedRequest(good, { facebook: FB, instagram: IG })?.userId === "17841400000000001");

const [sig, payload] = good.split(".");
const forgedPayload = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" })).toString("base64url");
ok("a swapped payload under the old signature is refused", parseSignedRequest(`${sig}.${forgedPayload}`, IG) === null);
ok("a truncated signature is refused (no length-mismatch throw)", parseSignedRequest(`${sig.slice(0, 10)}.${payload}`, IG) === null);
ok("a request signed with a guessed secret is refused",
  parseSignedRequest(makeSignedRequest({ algorithm: "HMAC-SHA256", user_id: "1" }, "guess"), IG) === null);
ok("a wrong algorithm is refused",
  parseSignedRequest(makeSignedRequest({ algorithm: "HMAC-MD5", user_id: "1" }, IG), IG) === null);
ok("no user_id is refused", parseSignedRequest(makeSignedRequest({ algorithm: "HMAC-SHA256" }, IG), IG) === null);
ok("a non-JSON payload with a valid signature is refused",
  (() => { const p = Buffer.from("not json").toString("base64url"); return parseSignedRequest(`${makeSignedRequest({}, IG).split(".")[0]}.${p}`, IG) === null; })());
for (const junk of ["", "abc", ".", "a.b.c", "..", null, undefined, 42, {}]) {
  ok(`junk ${JSON.stringify(junk)} → null, never throws`, parseSignedRequest(junk, IG) === null);
}
ok("no secret configured → refused", parseSignedRequest(good, "") === null && verifySignedRequest(good, {}) === null);

const req = (body, type) => new Request("https://x.test/api", { method: "POST", headers: type ? { "content-type": type } : {}, body });
ok("reads a form-encoded signed_request (what Meta sends)",
  (await readSignedRequest(req(new URLSearchParams({ signed_request: good }).toString(), "application/x-www-form-urlencoded"))) === good);
ok("reads a JSON signed_request", (await readSignedRequest(req(JSON.stringify({ signed_request: good }), "application/json"))) === good);
ok("reads a multipart signed_request",
  (await (async () => { const fd = new FormData(); fd.set("signed_request", good); const r = new Request("https://x.test", { method: "POST", body: fd }); return readSignedRequest(r); })()) === good);
ok("broken JSON → empty string, never throws", (await readSignedRequest(req("{nope", "application/json"))) === "");
ok("the old attack body (JSON user_id, no signature) yields nothing to verify",
  verifySignedRequest(await readSignedRequest(req(JSON.stringify({ user_id: "17841400000000001" }), "application/json")), { instagram: IG }) === null);

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
