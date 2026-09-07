// The inbox shows "User 5184" when a contact has no name. The name comes from
// the Conversations API (the direct profile endpoint is gated behind an
// unapproved permission and answers 100/33), and participantName picks the right
// participant out of that response — the CUSTOMER, never the page's own entry,
// which would otherwise show the shop's own name against every chat.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BOT = join(here, "..", "src", "lib", "bot.js");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};

const { participantName } = await loadPure(BOT, "tmp-name.mjs");

const PAGE = "112231873927166";
const SID = "7632992603419204";
// The real shape the Graph API returned in testing: the customer AND the page.
const conv = {
  data: [{
    participants: { data: [
      { name: "Nahid Afzal", email: `${SID}@facebook.com`, id: SID },
      { name: "Broker's BD", email: `${PAGE}@facebook.com`, id: PAGE },
    ] },
    id: "t_2576925145904754",
  }],
};

ok("picks the customer's name, not the page's", participantName(conv, SID) === "Nahid Afzal");
ok("order does not matter — page first still yields the customer",
  participantName({ data: [{ participants: { data: [
    { name: "Broker's BD", id: PAGE }, { name: "Itz Gtk", id: "28366714309684244" },
  ] } }] }, "28366714309684244") === "Itz Gtk");
ok("ids are compared as strings (number sender)", participantName(conv, Number(SID)) === "Nahid Afzal");
ok("a sender not in the thread yields empty", participantName(conv, "999") === "");

// Degenerate responses must never throw and never invent a name.
ok("empty conversations → ''", participantName({ data: [] }, SID) === "");
ok("no data key → ''", participantName({}, SID) === "");
ok("null → ''", participantName(null, SID) === "");
ok("participants present but empty → ''",
  participantName({ data: [{ participants: { data: [] } }] }, SID) === "");
ok("a participant with no name → ''",
  participantName({ data: [{ participants: { data: [{ id: SID }] } }] }, SID) === "");
ok("whitespace name is trimmed to empty",
  participantName({ data: [{ participants: { data: [{ id: SID, name: "   " }] } }] }, SID) === "");

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
