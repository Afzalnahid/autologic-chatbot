import { readFileSync, writeFileSync } from "node:fs";

// Load one of the app's modules under node, with its imports stripped.
//
// The lib files reach for supabase and the AI router at the top; the pure
// functions under test touch neither, so the copy has the import block removed
// mechanically, by line, and cannot quietly test different code.
//
// The temp file is written NEXT TO THIS MODULE, addressed by a URL. Written to
// the current working directory instead, it landed in the project root while
// `import("./x.mjs")` resolved beside the test — so every run wrote a fresh
// copy somewhere nothing read it and imported a stale one from the last time
// the cwd happened to line up. The tests passed against code that no longer
// existed, which is worse than no tests at all.
export async function loadPure(appPath, tmpName) {
  const src = readFileSync(appPath, "utf8").split("\n").filter((l) => !/^import /.test(l)).join("\n");
  const at = new URL(tmpName, import.meta.url);
  writeFileSync(at, src);
  // A fresh query each time, so node's module cache cannot hand back the copy
  // it loaded a moment ago.
  return import(`${at.href}?v=${Date.now()}${Math.random()}`);
}
