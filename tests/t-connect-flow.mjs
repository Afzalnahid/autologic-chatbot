// Where the dashboard goes after the channel-connect screen: the calendar step
// belongs to a new service business's signup and nowhere else.
// connect-flow.js has no imports.
import { afterChannelConnect } from "../src/lib/connect-flow.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); } };

// Signup.
ok("a new service business is asked for Google Calendar next", afterChannelConnect({ businessType: "agency" }) === "connect-cal");
ok("a new shop goes straight into the dashboard — it has nothing to book", afterChannelConnect({ businessType: "ecommerce" }) === "app");
ok("a service business whose calendar is already connected is not asked again", afterChannelConnect({ businessType: "agency", calendarConnected: true }) === "app");

// The Channels tab (the owner's bug, 2026-09-28).
ok("connecting from the Channels tab never ends on the calendar step — service business", afterChannelConnect({ fromApp: true, businessType: "agency" }) === "app");
ok("connecting from the Channels tab never ends on the calendar step — shop", afterChannelConnect({ fromApp: true, businessType: "ecommerce" }) === "app");
ok("nor when the calendar is connected", afterChannelConnect({ fromApp: true, businessType: "agency", calendarConnected: true }) === "app");

// Missing information fails safe: into the dashboard, never a stray setup step.
ok("no business type known yet → the dashboard", afterChannelConnect({}) === "app" && afterChannelConnect() === "app");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
