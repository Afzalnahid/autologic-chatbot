// The sign-in / create-account screens must reject an obviously malformed
// address before it ever reaches Supabase (owner, 2026-09-21: "there should
// be authentication mandatory like valid email address only login or create
// account"). This holds the check itself; tests/t-nav.mjs-style source checks
// below hold the two screens that must call it.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { isValidEmail } = await import(pathToFileURL(join(root, "src", "lib", "valid-email.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

for (const good of ["a@b.co", "nahid@tellmoreai.com", "nahid.afzal@example.co.uk", "n+tag@sub.example.com", "  a@b.co  "])
  ok(`accepts ${JSON.stringify(good)}`, isValidEmail(good) === true);

for (const bad of ["", "   ", "asdf", "a@b", "a@b.c", "@b.co", "a@.co", "a@b.", "a b@c.com", "a@ b.com", "a@b .com", null, undefined, 42, "a".repeat(255) + "@b.co"])
  ok(`rejects ${JSON.stringify(bad)}`, isValidEmail(bad) === false);

// The two real screens that create or sign in to an account must use it,
// so a future edit cannot quietly drop the check from one of them.
const dash = readFileSync(join(root, "src", "app", "dashboard-client.js"), "utf8");
ok("the client dashboard's AuthGate imports the check", /import\s*\{\s*isValidEmail\s*\}\s*from\s*"@\/lib\/valid-email\.js"/.test(dash));
ok("sign-in/create-account calls isValidEmail before Supabase", /isValidEmail\(/.test(dash.slice(dash.indexOf("function AuthGate"), dash.indexOf("function AuthGate") + 3000)));
ok("the forgot-password flow also validates the address", (() => {
  const i = dash.indexOf("const forgot=");
  return i > -1 && /isValidEmail\(/.test(dash.slice(i, i + 500));
})());

const admin = readFileSync(join(root, "src", "app", "admin", "admin-client.js"), "utf8");
ok("the admin console's sign-in imports the check", /import\s*\{\s*isValidEmail\s*\}\s*from\s*"@\/lib\/valid-email\.js"/.test(admin));
ok("the admin console validates before Supabase", (() => {
  const i = admin.indexOf("const auth = async");
  return i > -1 && /isValidEmail\(/.test(admin.slice(i, i + 500));
})());

console.log(`t-valid-email: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
