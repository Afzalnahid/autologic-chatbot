// handoff.js has no imports, so it loads as-is.
const M = await import(new URL("../src/lib/handoff.js", import.meta.url).href + "?v=" + Date.now());
const { extractHandoff, wantsHuman, HANDOFF_TOKEN } = M;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, c) => is(name, !!c, true);

// ── extractHandoff ───────────────────────────────────────────────────────────
is("no token → unchanged, no handoff",
  extractHandoff([{ type: "text_msg", text: "Price is 250." }]),
  { items: [{ type: "text_msg", text: "Price is 250." }], handoff: false });
is("token at the end is stripped and reported",
  extractHandoff([{ type: "text_msg", text: "A team member will help you shortly.\n" + HANDOFF_TOKEN }]),
  { items: [{ type: "text_msg", text: "A team member will help you shortly." }], handoff: true });
is("token in the middle keeps both halves",
  extractHandoff([{ type: "text_msg", text: "Sorry about that. " + HANDOFF_TOKEN + " Someone will call you." }]).items[0].text,
  "Sorry about that.\nSomeone will call you.");
is("an item that was ONLY the token is dropped",
  extractHandoff([{ type: "text_msg", text: HANDOFF_TOKEN }, { type: "image", url: "x" }]),
  { items: [{ type: "image", url: "x" }], handoff: true });
ok("the customer never sees the token",
  !JSON.stringify(extractHandoff([{ text: "a " + HANDOFF_TOKEN + " b" }]).items).includes("HANDOFF"));
is("non-text items pass through", extractHandoff([{ type: "image", url: "u" }]), { items: [{ type: "image", url: "u" }], handoff: false });
is("empty / missing list is safe", extractHandoff(undefined), { items: [], handoff: false });
ok("input is not mutated", (() => { const src = [{ text: "x " + HANDOFF_TOKEN }]; extractHandoff(src); return src[0].text.includes("HANDOFF"); })());

// ── wantsHuman: English ──────────────────────────────────────────────────────
ok("asks for a human", wantsHuman("Can I talk to a human please?"));
ok("asks for the manager", wantsHuman("I want to speak with the manager"));
ok("asks to be called", wantsHuman("Please call me on this number"));
ok("wants a real person", wantsHuman("is this a bot? I need a real person"));
ok("a normal question is not a hand-off", !wantsHuman("How much is the blue one?"));
ok("'humanity' does not match on a word boundary", !wantsHuman("I love humanity"));

// ── wantsHuman: Bangla ───────────────────────────────────────────────────────
ok("Bangla: wants to talk to a person", wantsHuman("আমি একজন মানুষের সাথে কথা বলতে চাই"));
ok("Bangla: asks for the owner", wantsHuman("মালিকের সাথে কথা বলব"));
ok("Bangla: asks for a phone number", wantsHuman("আপনাদের ফোন নাম্বার দিন"));
ok("Bangla: a price question is not a hand-off", !wantsHuman("এটার দাম কত?"));

// ── wantsHuman: Banglish ─────────────────────────────────────────────────────
ok("Banglish: kotha bolte chai", wantsHuman("ami manager er sathe kotha bolte chai"));
ok("Banglish: call koro", wantsHuman("amake call koro please"));
ok("Banglish: a stock question is not a hand-off", !wantsHuman("red color ta ache?"));

// ── edge ─────────────────────────────────────────────────────────────────────
ok("empty text is never a hand-off", !wantsHuman("") && !wantsHuman(null));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
