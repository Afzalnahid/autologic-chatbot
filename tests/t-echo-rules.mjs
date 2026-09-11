// Business Suite's instant reply echoes seconds after a customer's message;
// treating it as a human reply would mark the customer answered and silence
// the bot. Timing tells them apart.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { isAutomatedEcho, AUTO_REPLY_WINDOW_MS, RECENT_BUSINESS_MS } =
  await loadPure(join(here, "..", "src", "lib", "echo-rules.js"), "tmp-echo-rules.mjs");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const NOW = 1_789_122_123_953;
ok("1.8 s after a fresh customer message, nobody chatting → automated",
  isAutomatedEcho({ now: NOW, lastCustomerAt: NOW - 1800, lastBusinessAt: 0 }));
ok("just inside the window → automated",
  isAutomatedEcho({ now: NOW, lastCustomerAt: NOW - AUTO_REPLY_WINDOW_MS + 1, lastBusinessAt: null }));
ok("a minute later → a person",
  !isAutomatedEcho({ now: NOW, lastCustomerAt: NOW - 60_000, lastBusinessAt: 0 }));
ok("quick reply mid-conversation (business replied 2 min ago) → a person",
  !isAutomatedEcho({ now: NOW, lastCustomerAt: NOW - 3000, lastBusinessAt: NOW - 2 * 60_000 }));
ok("quick reply after a long silence (business last spoke an hour ago) → automated",
  isAutomatedEcho({ now: NOW, lastCustomerAt: NOW - 3000, lastBusinessAt: NOW - 60 * 60_000 }));
ok("recent-business boundary: exactly at the limit counts as not recent",
  isAutomatedEcho({ now: NOW, lastCustomerAt: NOW - 3000, lastBusinessAt: NOW - RECENT_BUSINESS_MS }));
ok("no customer message at all → not automated (nothing to answer)",
  !isAutomatedEcho({ now: NOW, lastCustomerAt: 0, lastBusinessAt: 0 }));
ok("customer message in the future (clock skew) → not automated",
  !isAutomatedEcho({ now: NOW, lastCustomerAt: NOW + 5000, lastBusinessAt: 0 }));
ok("junk never throws", !isAutomatedEcho({}) && !isAutomatedEcho({ now: "x", lastCustomerAt: "y" }));

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
