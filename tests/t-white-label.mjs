// White-label (owner, 2026-10-03): the same platform opened from a partner's
// address prints the partner's product name, and no mark of ours. Everything
// else — data, accounts, bot — is shared. lib/white-label.js holds the list.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const W = await import(pathToFileURL(join(root, "src", "lib", "white-label.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// Which address gets which name.
ok("tellmoreai.com is ours", W.brandForHost("www.tellmoreai.com").id === "tellmore");
ok("an unknown address is ours", W.brandForHost("example.com").name === "TellMore AI");
ok("no host at all is ours", W.brandForHost(undefined).name === "TellMore AI");
ok("localhost is ours", W.brandForHost("localhost:3000").logo === true);
ok("the partner address is Tell Me", W.brandForHost("tellme.ufirstltd.com").name === "Tell Me");
ok("the partner shows no logo", W.brandForHost("tellme.ufirstltd.com").logo === false);
ok("a port does not matter", W.brandForHost("tellme.ufirstltd.com:443").id === "tellme");
ok("capitals do not matter", W.brandForHost("TellMe.UfirstLtd.com").id === "tellme");
ok("www. does not matter", W.brandForHost("www.tellme.ufirstltd.com").id === "tellme");
ok("a trailing dot does not matter", W.brandForHost("tellme.ufirstltd.com.").id === "tellme");
ok("the parent domain is not the partner", W.brandForHost("ufirstltd.com").id === "tellmore");
ok("a look-alike is not the partner", W.brandForHost("tellme.ufirstltd.com.evil.com").id === "tellmore");

// Text swaps.
const tm = W.brandForHost("tellme.ufirstltd.com");
ok("rebrand swaps the full name", W.rebrand("TellMore AI now answers", tm) === "Tell Me now answers");
ok("rebrand handles the possessive", W.rebrand("Running on TellMore AI's AI", tm) === "Running on Tell Me's AI");
ok("rebrand swaps a bare TellMore", W.rebrand("TellMore", tm) === "Tell Me");
ok("rebrand leaves our own text alone", W.rebrand("TellMore AI", W.DEFAULT_BRAND) === "TellMore AI");
ok("isWhiteLabel is false for ours", !W.isWhiteLabel(W.DEFAULT_BRAND));
ok("isWhiteLabel is true for the partner", W.isWhiteLabel(tm));
ok("currentBrand outside a browser is ours", W.currentBrand().id === "tellmore");

// The screens read it, instead of printing our name as a literal.
const home = read("src", "app", "page.js");
ok("home page reads the host", /brandForHost\(headers\(\)\.get\("host"\)\)/.test(home));
ok("home nav prints the brand name", /className="fr navword"[^>]*>\{brand\.name\}/.test(home));
ok("home hides our structured data on a partner address", /\{!wl && <script type="application\/ld\+json"/.test(home));
ok("home keeps a partner address out of search engines", /robots: \{ index: false, follow: false \}/.test(home));
const dash = read("src", "app", "dashboard-client.js");
ok("sign-in screen prints the brand name", /\{BRAND\.name\}\s*<\/div>/.test(dash));
ok("launch screen uses the brand name", /const LAUNCH_NAME = BRAND\.name;/.test(dash));
const shell = read("src", "app", "dashboard", "components", "Shell.js");
ok("sidebar prints the brand name", /\{brand\.name\} · \{isAgency/.test(shell));
ok("sidebar shows our mark only when the brand has one", /brand\.logo \? <BotMark/.test(shell));
const ui = read("src", "app", "dashboard", "components", "ui.js");
ok("onboarding frame prints the brand name", /\{brand\.name\}\s*<\/div>/.test(ui));

console.log(`white-label: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
