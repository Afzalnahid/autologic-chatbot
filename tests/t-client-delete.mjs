// Deleting a client from the admin console must leave nothing behind.
//
// The owner deleted a business and found its login still there (2026-09-24),
// and looking properly showed three more leaks: `comments`, `processed_comments`
// and `usage_daily` kept their rows, because the route emptied SIX tables by a
// list typed in by hand while TWENTY-ONE carry a client_id. The rule now lives
// in the database (ON DELETE CASCADE on every one of them,
// docs/sql/2026-09-24-delete-a-client-means-delete-everything.sql), which is the
// only place a route cannot forget it.
//
// This suite cannot reach the database, so it guards the shape of the code: the
// hand-maintained list must not come back, the two things a cascade cannot do
// must still be done, and neither may fail silently.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const route = readFileSync(join(root, "src", "app", "api", "admin", "route.js"), "utf8");
const panel = readFileSync(join(root, "src", "app", "admin", "admin-client.js"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };
const del = route.slice(route.indexOf("export async function DELETE"));

// The list that could never keep up.
ok("no hand-written table list is emptied before the client row",
  !/for \(const t of \[[^\]]*"message_buffer"/.test(route));
ok("the client row is deleted, and the database takes the rest", /from\("clients"\)\.delete\(\)\.eq\("id", id\)/.test(del));
ok("the cascade is named where the next reader will look", /ON DELETE CASCADE|on delete cascade/.test(route));

// The two things no cascade can do.
ok("the login is removed", /deleteAuthUserByEmail\(cl\?\.owner_email\)/.test(del));
ok("the uploaded files are removed", /deleteClientFiles\(id\)/.test(del));
ok("both storage buckets are emptied",
  route.includes('"knowledge-files"') && route.includes('"product-images"'));
ok("storage listing pages rather than stopping at the first hundred", /offset \+= 100/.test(route));

// Nothing may fail quietly.
ok("the login helper returns its verdict instead of swallowing it",
  /return \{ removed: false, reason:/.test(route) && /return \{ removed: true \}/.test(route));
ok("a half-done delete is reported to the console as a warning", /ok: true, warning:/.test(del));
ok("the warning says what is still out there and where to finish it",
  /Authentication → Users/.test(del) && /still in storage/.test(del));
ok("the panel reads the body on success too, or no warning would ever be seen",
  /else if \(d\.warning\) setErr\(d\.warning\)/.test(panel));

// The migration that moved the rule into the database has to stay in the repo:
// it is what a fresh environment needs, and the proof of what was done.
const sql = readdirSync(join(root, "docs", "sql"));
const file = sql.find((f) => f.includes("delete-a-client-means-delete-everything"));
ok("the migration is kept with the other SQL", !!file);
if (file) {
  const text = readFileSync(join(root, "docs", "sql", file), "utf8");
  for (const t of ["allowance_events", "broadcast_recipients", "comments", "processed_comments", "usage_daily"]) {
    ok(`${t} is given a cascading foreign key`, new RegExp(`alter table ${t}\\s+add\\s+constraint`).test(text));
  }
  ok("the stranded rows are cleared first, or the constraint could not be added", /delete from comments\s+x where not exists/.test(text));
  ok("it can be run twice", (text.match(/drop constraint if exists/g) || []).length >= 5);
  ok("it carries the query that finds the next table to slip through", /information_schema/.test(text) && /delete_rule = 'CASCADE'/.test(text));
}

console.log(`t-client-delete: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
