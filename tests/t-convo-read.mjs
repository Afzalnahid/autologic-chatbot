// Inbox read state — Messenger's rule. A chat is unread when its newest
// CUSTOMER message is newer than the last time this device opened it and
// newer than the last "Mark all as read". A bot reply never makes it read.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { lastCustomerAt, isUnreadConvo, unreadConvoCount, trimSeen } =
  await loadPure(join(here, "..", "src", "lib", "convo-read.js"), "tmp-convo-read.mjs");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const T0 = Date.parse("2026-09-11T10:00:00Z");
const at = (min) => new Date(T0 + min * 60000).toISOString();
const convo = (id, msgs) => ({ id, messages: msgs });
const cust = (min) => ({ role: "customer", time: at(min) });
const bot = (min) => ({ role: "bot", time: at(min) });
const agent = (min) => ({ role: "agent", time: at(min) });

// ── lastCustomerAt ───────────────────────────────────────────────────────────
ok("no messages → 0", lastCustomerAt(convo("a", [])) === 0);
ok("no customer message → 0", lastCustomerAt(convo("a", [bot(1), agent(2)])) === 0);
ok("newest customer message wins", lastCustomerAt(convo("a", [cust(1), bot(2), cust(5), bot(6)])) === T0 + 5 * 60000);
ok("junk convo → 0", lastCustomerAt(null) === 0 && lastCustomerAt({}) === 0);

// ── isUnreadConvo ────────────────────────────────────────────────────────────
const fresh = { seen: {}, watermark: 0 };
const c1 = convo("c1", [cust(1), bot(2)]);
ok("never opened, customer wrote → unread", isUnreadConvo(c1, fresh));
ok("a bot reply after does not make it read", isUnreadConvo(convo("x", [cust(1), bot(2), bot(3)]), fresh));
ok("opened at its newest customer message → read", !isUnreadConvo(c1, { seen: { c1: T0 + 60000 }, watermark: 0 }));
ok("opened, then customer wrote again → unread", isUnreadConvo(convo("c1", [cust(1), bot(2), cust(9)]), { seen: { c1: T0 + 60000 }, watermark: 0 }));
ok("mark-all after the message → read", !isUnreadConvo(c1, { seen: {}, watermark: T0 + 10 * 60000 }));
ok("customer wrote after mark-all → unread", isUnreadConvo(convo("c1", [cust(20)]), { seen: {}, watermark: T0 + 10 * 60000 }));
ok("no customer message at all → read", !isUnreadConvo(convo("z", [bot(1)]), fresh));
ok("seen keyed by string id works for numeric ids", !isUnreadConvo(convo(42, [cust(1)]), { seen: { "42": T0 + 60000 }, watermark: 0 }));
ok("missing state → treated as unread", isUnreadConvo(c1, undefined));

// ── unreadConvoCount ─────────────────────────────────────────────────────────
const list = [convo("a", [cust(1)]), convo("b", [cust(2), bot(3)]), convo("c", [bot(4)]), convo("d", [cust(5)])];
ok("counts only unread chats", unreadConvoCount(list, fresh) === 3);
ok("opening one drops the count", unreadConvoCount(list, { seen: { a: T0 + 60000 }, watermark: 0 }) === 2);
ok("mark-all zeroes it", unreadConvoCount(list, { seen: {}, watermark: T0 + 60 * 60000 }) === 0);
ok("junk list → 0", unreadConvoCount(null, fresh) === 0);

// ── trimSeen ─────────────────────────────────────────────────────────────────
const big = Object.fromEntries(Array.from({ length: 600 }, (_, i) => ["s" + i, 1000 + i]));
const trimmed = trimSeen(big);
ok("keeps at most 500", Object.keys(trimmed).length === 500);
ok("keeps the newest", trimmed.s599 === 1599 && trimmed.s99 === undefined);
ok("drops zero/junk values", Object.keys(trimSeen({ a: 0, b: "x", c: 5 })).join() === "c");

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
