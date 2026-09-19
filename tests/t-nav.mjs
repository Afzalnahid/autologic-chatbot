import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { readFileSync } from "node:fs";

// PAGES, ICONS and LABELS are three parallel arrays addressed by the same
// index. Adding a tab to one and not the others gives every page after it the
// wrong icon and the wrong name, silently.
const s = readFileSync(__R("src/app/dashboard-client.js"), "utf8");
const arr = (name) => {
  const m = s.match(new RegExp(`const ${name}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
  if (!m) throw new Error(`no ${name}`);
  return JSON.parse(m[1]);
};
const PAGES = arr("PAGES"), ICONS = arr("ICONS"), LABELS = arr("LABELS");
// NAV is the sidebar's order — one flat list since the design deck of
// 2026-09-20 (the grouped sidebar it replaced read the same way here).
const groups = arr("NAV");

let bad = 0;
const say = (ok, msg) => { if (!ok) { bad++; console.log("FAIL " + msg); } };

say(PAGES.length === ICONS.length, `PAGES ${PAGES.length} vs ICONS ${ICONS.length}`);
say(PAGES.length === LABELS.length, `PAGES ${PAGES.length} vs LABELS ${LABELS.length}`);
// Overview is the home tab and leads the list (design handoff, 2026-09-20);
// the assistant, which led before, is right behind it. The three arrays are
// index-aligned, so a page added in one place and not the others shows up here.
say(PAGES[0] === "overview", `first page is ${PAGES[0]}, expected overview`);
say(ICONS[0] === "ti-layout-dashboard", `first icon is ${ICONS[0]}`);
say(LABELS[0] === "Overview", `first label is ${LABELS[0]}`);
say(PAGES[1] === "assistant" && ICONS[1] === "ti-sparkles" && LABELS[1] === "AI Assistant", "the assistant is second, with its icon and label");
say(new Set(PAGES).size === PAGES.length, "a page key is listed twice");

// Every page must appear exactly once in the sidebar, or it has no way in.
for (const p of PAGES) say(groups.filter((g) => g === p).length === 1, `${p} appears ${groups.filter((g) => g === p).length} times in NAV`);
for (const g of groups) say(PAGES.includes(g), `NAV lists unknown page ${g}`);
say(groups[0] === "overview", `the sidebar starts with ${groups[0]}, expected overview`);

// ── every tab's "Read docs" link ───────────────────────────────────────────
// The AI Assistant tab shipped with a documentation page and no link to it,
// because LearnMore kept its own copy of the tab → slug map and nobody told it
// about the new tab. It reads the manual's list now; this is the check that it
// keeps doing so.
const docs = await import(__R("src/lib/docs/index.js?v=").href + Date.now());
const learn = readFileSync(__R("src/app/dashboard/components/LearnMore.js"), "utf8");

say(/for \(const p of PAGES\)/.test(learn), "LearnMore no longer derives its slugs from PAGES — a second copy has come back");
say(!/analytics:\s*"analytics"/.test(learn), "a hand-written slug map has reappeared in LearnMore");

const slugFor = {};
for (const p of docs.PAGES) if (p.tab && !slugFor[p.tab]) slugFor[p.tab] = p.slug;

// A tab the manual documents must be reachable from that tab.
for (const p of docs.PAGES) {
  if (!p.tab) continue;
  say(PAGES.includes(p.tab), `docs page ${p.slug} points at tab "${p.tab}", which the dashboard does not have`);
}
// The assistant is the one this went wrong on, so it is named rather than
// left to the loop.
say(slugFor.assistant === "ai-assistant", `the AI Assistant tab resolves to "${slugFor.assistant}"`);
// Reading order decides which page a shared tab opens.
say(slugFor.channels === "channels", `channels opens "${slugFor.channels}", not its introduction`);

// Every tab in the sidebar should have somewhere to read about it. Listed by
// name so that adding a tab makes a deliberate decision rather than a silent
// gap: put it in the manual, or add it here saying why not.
const NO_DOCS = [];
for (const p of PAGES) say(slugFor[p] || NO_DOCS.includes(p), `dashboard tab "${p}" has no documentation page — add one, or list it in NO_DOCS`);

console.log(`${PAGES.length} pages, ${groups.length} in groups, ${Object.keys(slugFor).length} with docs`);
console.log(bad ? `\n${bad} problem(s)` : "\nPAGES, ICONS, LABELS, the sidebar groups and every tab's docs link all line up");
process.exit(bad ? 1 : 0);
