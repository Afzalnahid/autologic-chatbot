import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { loadPure } from "./shim.mjs";

// back.js imports react for the hook; pushBack and runBack touch neither.
const { pushBack, runBack } = await loadPure(__R("src/app/dashboard/components/back.js"), "tmp-back.mjs");

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

// Nothing open: the press belongs to the page.
is("an empty stack does not claim the press", runBack(), false);

// The LAST thing to open is the first to be asked — that is the whole point of
// a stack rather than the single slot this replaced.
let log = [];
const offA = pushBack(() => { log.push("A"); return true; });
const offB = pushBack(() => { log.push("B"); return true; });
is("the innermost one answers", (runBack(), log), ["B"]);
log = [];
offB();
is("and once it has closed, the next one down does", (runBack(), log), ["A"]);
offA();
is("and then nothing does", runBack(), false);

// A handler that declines passes the press down rather than swallowing it.
log = [];
const offC = pushBack(() => { log.push("C"); return false; });
const offD = pushBack(() => { log.push("D"); return false; });
is("a decline falls through to the page", runBack(), false);
is("and everyone was asked, innermost first", log, ["D", "C"]);
offC(); offD();

// Overlays do not always close in the order they opened. Popping blind would
// drop somebody else's entry.
log = [];
const off1 = pushBack(() => { log.push("1"); return true; });
const off2 = pushBack(() => { log.push("2"); return true; });
off1();                       // the OUTER one closes first
is("removing the outer one leaves the inner one", (runBack(), log), ["2"]);
off2();
is("and the stack is then empty", runBack(), false);

// A broken handler must not trap the owner: the press has to keep going.
log = [];
const offX = pushBack(() => { throw new Error("boom"); });
const offY = pushBack(() => { log.push("Y"); return false; });
is("a thrown handler does not claim the press", runBack(), false);
is("and the one under it was still asked", log, ["Y"]);
offX(); offY();
is("and the stack still works afterwards", runBack(), false);

// Unregistering twice must not take a different entry with it.
const offP = pushBack(() => true);
offP(); offP();
is("a double unregister is harmless", runBack(), false);

// The same function registered twice is two entries, and removing it once
// leaves the other.
log = [];
const same = () => { log.push("s"); return false; };
const offS1 = pushBack(same), offS2 = pushBack(same);
offS1();
is("one of a duplicated pair survives", (runBack(), log), ["s"]);
offS2();
is("until both are gone", runBack(), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
