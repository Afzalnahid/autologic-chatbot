import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// Exercises the real module against the answers that actually caused this bug.
import { readJson, httpMessage, offlineError } from "../src/lib/api-error.js";

const R = (status, body, type = "text/plain") =>
  new Response(body, { status, headers: { "content-type": type } });

const cases = [
  // The one that started it: Vercel's refusal, which is HTML, not JSON.
  ["413 HTML from the platform", R(413, "<html><body>Request Entity Too Large</body></html>", "text/html")],
  ["413 empty body", R(413, "")],
  ["504 gateway timeout", R(504, "An error occurred with your deployment")],
  ["502 bad gateway", R(502, "<html>502</html>", "text/html")],
  ["500 crash page", R(500, "<html>Internal Server Error</html>", "text/html")],
  // Our own routes: their wording must survive untouched.
  ["our 403 plan-limit JSON", R(403, JSON.stringify({ error: "Your Starter package allows 50 products. Upgrade to add more." }), "application/json")],
  ["our 500 JSON", R(500, JSON.stringify({ error: "upload failed: bucket not found" }), "application/json")],
  ["our 200 success JSON", R(200, JSON.stringify({ ok: true, id: 42, analyzed: true }), "application/json")],
  ["our 400 JSON", R(400, JSON.stringify({ error: "name required" }), "application/json")],
  // Odd shapes that must not throw.
  ["200 but not JSON", R(200, "OK")],
  ["204 no content", new Response(null, { status: 204 })],
  ["200 JSON array", R(200, "[1,2,3]", "application/json")],
];

let bad = 0;
for (const [label, res] of cases) {
  let out;
  try { out = await readJson(res); }
  catch (e) { console.log(`THREW  ${label}: ${e.message}`); bad++; continue; }
  // An array is a valid answer: eight routes reply with a bare list.
  const shape = out && typeof out === "object";
  if (!shape) { console.log(`BAD SHAPE  ${label}: ${JSON.stringify(out)}`); bad++; continue; }
  const ok2xx = res.status >= 200 && res.status < 300;
  if (ok2xx && out.error) { console.log(`INVENTED FAILURE  ${label}: ${out.error}`); bad++; continue; }
  if (!ok2xx && !out.error) { console.log(`SWALLOWED FAILURE  ${label}`); bad++; continue; }
  console.log(`ok  ${label.padEnd(28)} -> ${JSON.stringify(out).slice(0, 96)}`);
}

console.log("\noffline:", JSON.stringify(offlineError()));
console.log("\n-- a few messages as the owner reads them --");
for (const s of [413, 504, 429, 401]) console.log(`  ${s}: ${httpMessage(s)}`);
console.log(bad === 0 ? "\nALL PASSED — never threw, always an object" : `\n${bad} FAILED`);

