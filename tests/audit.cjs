// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => require("node:path").join(__dirname, "..", p);
const ROOT_SLASH = require("node:path").join(__dirname, "..").replace(/\\/g, "/") + "/";

// A sweep for the classes of bug this codebase has actually produced, rather
// than a general lint. Every check below exists because one of them shipped.
//
//   1. tenant isolation — a query on a per-client table with no client_id
//   2. .eq(col, null)   — PostgREST writes `= NULL`, which is never true
//   3. unbounded select — silently capped by db-max-rows, so a partial read
//                         looks like a complete one
//   4. fail-open        — `count || 0` after an error reads as zero, which is
//                         under every limit
//   5. swallowed errors — catch {} that returns an empty result
//   6. retired plan ids — leftovers from the package split
const fs = require("fs");
const path = require("path");

const ROOT = __R("src");
const walk = (d, out = []) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(n)) out.push(p);
  }
  return out;
};
const files = walk(ROOT);
const rel = (f) => f.replace(/\\/g, "/").replace(__R(""), "");

// Tables that hold one client's rows. A read of these without a client_id
// filter is either a bug or an admin/cron route that means it.
const TENANT = ["products", "orders", "bookings", "contacts", "message_buffer", "conversations",
  "channels", "broadcasts", "broadcast_recipients", "file_registry", "knowledge_chunks",
  "usage_daily", "tags", "followups", "offers", "product_images"];

// Routes that legitimately read across every client.
const CROSS_TENANT = /\/(api\/admin|api\/cron|api\/webhook|api\/messenger|api\/whatsapp|api\/comments)\//;

const hits = { tenant: [], eqNull: [], unbounded: [], failOpen: [], swallow: [], retired: [] };

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  const isCross = CROSS_TENANT.test(rel(f)) || /lib\/(admin-auth|platform-ai|model-catalog|fx)\.js$/.test(rel(f));

  // ── 1 & 3: one supabase chain at a time ──────────────────────────────────
  // A chain runs from .from("x") to the first semicolon or the end of the
  // statement; joining the next few lines is enough because these are written
  // as fluent chains.
  const re = /\.from\(\s*["'`](\w+)["'`]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    const at = src.slice(m.index, m.index + 700);
    const chain = at.split(/;\s*\n/)[0];
    const line = src.slice(0, m.index).split("\n").length;
    const isRead = /\.select\(/.test(chain);
    if (!isRead) continue;

    if (TENANT.includes(table) && !/client_id/.test(chain) && !isCross) {
      hits.tenant.push(`${rel(f)}:${line}  ${table}`);
    }
    // A read with no ceiling: no limit, no range, no single/maybeSingle, and
    // not a head-only count.
    const bounded = /\.(limit|range|single|maybeSingle)\(/.test(chain) || /head:\s*true/.test(chain);
    if (TENANT.includes(table) && !bounded) {
      hits.unbounded.push(`${rel(f)}:${line}  ${table}`);
    }
  }

  lines.forEach((l, i) => {
    const n = i + 1;
    // ── 2 ──
    if (/\.eq\([^)]*,\s*null\s*\)/.test(l)) hits.eqNull.push(`${rel(f)}:${n}  ${l.trim().slice(0, 90)}`);
    // ── 4: a count coerced to 0 where an error was possible ──
    if (/\bcount\s*\|\|\s*0\b/.test(l) && !/error/.test(lines.slice(Math.max(0, i - 4), i + 1).join(" "))) {
      hits.failOpen.push(`${rel(f)}:${n}  ${l.trim().slice(0, 90)}`);
    }
    // ── 6 ──
    if (/["'`](starter|pro|agency)["'`]/.test(l) && /plan|PLAN/.test(l) && !/retired|PAID_PLANS|business_type/.test(l)) {
      hits.retired.push(`${rel(f)}:${n}  ${l.trim().slice(0, 90)}`);
    }
  });

  // ── 5: catch that returns an empty collection ──
  for (const c of src.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*return\s+(\[\]|\{\}|NextResponse\.json\(\s*\[\s*\])/g)) {
    hits.swallow.push(`${rel(f)}:${src.slice(0, c.index).split("\n").length}`);
  }
}

const show = (k, title, note) => {
  const v = [...new Set(hits[k])];
  console.log(`\n${"=".repeat(70)}\n${title} — ${v.length}\n${note}`);
  v.slice(0, 40).forEach((x) => console.log("  " + x));
  if (v.length > 40) console.log(`  … and ${v.length - 40} more`);
};

show("tenant", "TENANT ISOLATION", "a per-client table read with no client_id filter");
show("eqNull", "eq(col, null)", "PostgREST writes `= NULL`, which matches nothing");
show("unbounded", "UNBOUNDED READ", "no limit/range — silently capped, partial looks complete");
show("failOpen", "FAIL OPEN", "count || 0 with no error check above it");
show("swallow", "SWALLOWED ERROR", "catch returning an empty collection");
show("retired", "RETIRED PLAN IDS", "starter / pro / agency left in code after the split");
