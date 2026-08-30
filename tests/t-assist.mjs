import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { loadPure } from "./shim.mjs";

const A = await loadPure(__R("src/lib/assistant-actions.js"), "tmp-assist.mjs");
const { normalizeSetting, normalizeSettingActions, applySettingActions, describeSetting, settingsSummary } = A;

// The describers take the dashboard's translator. Under node there is no
// dashboard, so this stands in for it: it returns the KEY, with the variables
// spelled out. That is enough to prove the right key was asked for and the
// right values were put in it — which is what these tests are about; whether
// the sentence reads well in Bangla is what the dictionary check is for.
const t = (key, vars) => (vars ? `${key}(${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",")})` : key);

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);

// ── the whitelist refuses what it does not know ────────────────────────────
is("an unknown verb is dropped", normalizeSetting({ do: "products.delete_all", id: "1" }), null);
is("a made-up field is dropped, the rest kept",
  normalizeSetting({ do: "offer.create", set: { title: "Eid sale", commission: "50%" } }),
  { do: "offer.create", set: { active: true, title: "Eid sale" } });
is("an offer with nothing in it is not an offer", normalizeSetting({ do: "offer.create", set: {} }), null);
is("an update needs an id", normalizeSetting({ do: "offer.update", set: { title: "x" } }), null);
is("switching an offer OFF survives, though `false` is falsy",
  normalizeSetting({ do: "offer.update", id: "o1", set: { active: false } }),
  { do: "offer.update", id: "o1", set: { active: false } });

// Fixed lists: a value the dashboard could not display is dropped rather than
// written, and the rest of the same action still applies.
is("a tone off the list is dropped, the name is kept",
  normalizeSetting({ do: "identity.set", set: { tone: "sassy", botName: "Rina" } }),
  { do: "identity.set", set: { botName: "Rina" } });
is("a tone on the list is kept",
  normalizeSetting({ do: "identity.set", set: { tone: "Casual and fun" } }),
  { do: "identity.set", set: { tone: "Casual and fun" } });
is("an invented language is dropped", normalizeSetting({ do: "identity.set", set: { languages: "Klingon" } }), null);

is("a discount is clamped to 50", normalizeSetting({ do: "bargain.set", set: { max_discount_pct: "200" } }).set.max_discount_pct, 50);
is("zero percent is not a discount", normalizeSetting({ do: "bargain.set", set: { max_discount_pct: 0 } }), null);
is("a percent sign is stripped", normalizeSetting({ do: "bargain.set", set: { max_discount_pct: "12%" } }).set.max_discount_pct, 12);
is("an unknown bargaining mode is dropped", normalizeSetting({ do: "bargain.set", set: { mode: "aggressive" } }), null);

is("follow-ups can be turned off explicitly",
  normalizeSetting({ do: "followup.set", set: { enabled: false } }),
  { do: "followup.set", set: { enabled: false } });
is("follow-ups with nothing said is not an action", normalizeSetting({ do: "followup.set", set: {} }), null);

is("at most twenty proposals survive", normalizeSettingActions(Array(40).fill({ do: "note.add", set: { text: "x" } })).length, 20);

// ── applying them ──────────────────────────────────────────────────────────
const base = {
  botName: "Rina", businessName: "Nokshi",
  questionnaire: { description: "A clothing shop", tone: "Friendly and helpful", notes: [{ id: "n1", text: "We close on Fridays" }] },
  offers: [{ id: "o1", title: "Eid sale", details: "20% off", active: true, products: [{ id: "p1" }] }],
  bargain: { enabled: true, mode: "limited", max_discount_pct: 5 },
};

let r = applySettingActions(base, [{ do: "offer.update", id: "o1", set: { active: false } }]);
is("an offer is switched off", r.next.offers[0].active, false);
is("and keeps the products it covered", r.next.offers[0].products, [{ id: "p1" }]);
is("the original is untouched", base.offers[0].active, true);

r = applySettingActions(base, [{ do: "offer.create", set: { title: "Winter", details: "Buy 2 get 1" } }]);
is("a new offer is appended", r.next.offers.length, 2);
is("and starts live", r.next.offers[1].active, true);
is("and starts covering nothing, so it is never attached to the wrong shirt", r.next.offers[1].products, []);

r = applySettingActions(base, [{ do: "offer.delete", id: "nope" }]);
is("deleting an offer that is gone says so", r.results[0], { ok: false, error: "that offer is no longer there" });
is("and changes nothing", r.next.offers.length, 1);

r = applySettingActions(base, [{ do: "note.add", set: { text: "Delivery is free over 2000" } }]);
is("a note is added", r.next.questionnaire.notes.length, 2);
is("without disturbing the training answers", r.next.questionnaire.description, "A clothing shop");

r = applySettingActions(base, [{ do: "note.delete", id: "n1" }]);
is("a note is removed", r.next.questionnaire.notes, []);

r = applySettingActions(base, [{ do: "identity.set", set: { botName: "Mina", tone: "Casual and fun" } }]);
is("the name moves to the top of settings", r.next.botName, "Mina");
is("the tone moves inside the questionnaire", r.next.questionnaire.tone, "Casual and fun");
is("and the notes are still there", r.next.questionnaire.notes.length, 1);

r = applySettingActions(base, [{ do: "bargain.set", set: { mode: "custom", custom: "Never below cost" } }]);
is("bargaining keeps what was not mentioned", r.next.bargain.max_discount_pct, 5);
is("and turns itself on", r.next.bargain.enabled, true);

r = applySettingActions({}, [{ do: "followup.set", set: { enabled: true } }]);
is("follow-ups work from an empty settings object", r.next.followup, { enabled: true });

r = applySettingActions(base, [{ do: "training.set", set: { delivery: "Same day inside Dhaka", nonsense: "x" } }]);
is("a training answer is written", r.next.questionnaire.delivery, "Same day inside Dhaka");
is("and the invented field is not", r.next.questionnaire.nonsense, undefined);

// Several at once, in order, each seeing the last one's result.
r = applySettingActions(base, [
  { do: "offer.create", set: { title: "A" } },
  { do: "offer.create", set: { title: "B" } },
  { do: "offer.delete", id: "o1" },
]);
is("three in a row all land", r.next.offers.map((o) => o.title), ["A", "B"]);
is("and all three are reported ok", r.results.filter((x) => x.ok).length, 3);

// ── what the owner reads ───────────────────────────────────────────────────
const d = describeSetting({ do: "bargain.set", set: { max_discount_pct: 10 } }, base, t);
ok("a percent change reads as a change, not a number", d.lines.some((l) => l.includes("5% → 10%")));
ok("removing an offer is marked dangerous", describeSetting({ do: "offer.delete", id: "o1" }, base, t).danger);
ok("removing an offer names it", describeSetting({ do: "offer.delete", id: "o1" }, base, t).title.includes("Eid sale"));
ok("a training change points at Bot Training",
  describeSetting({ do: "training.set", set: { delivery: "x" } }, base, t).lines.includes("card.trainingThen"));

// Every word on a card comes through the translator now — no sentence is left
// hardcoded in English under a Bangla screen. Checked by giving it a stand-in
// that returns the key: anything that comes back NOT looking like a key is a
// literal somebody forgot.
const KEYISH = /^(card|sfld|lbl|fld)\.[\w.]+/;
const cardKeys = (a, s) => {
  const r = describeSetting(a, s, t);
  return [r.title, ...r.lines];
};
const looksTranslated = (parts, allowed = []) =>
  parts.every((p) => KEYISH.test(String(p)) || allowed.some((x) => String(p).includes(x)));
ok("a new offer's card is all keys", looksTranslated(cardKeys({ do: "offer.create", set: { title: "A", details: "B" } }, base), ["card.addOffer"]));
ok("a bargaining card is all keys", looksTranslated(cardKeys({ do: "bargain.set", set: { mode: "fixed" } }, base), ["card.bargain"]));
ok("a follow-up card is all keys", looksTranslated(cardKeys({ do: "followup.set", set: { enabled: true } }, base)));
ok("an identity card is all keys", looksTranslated(cardKeys({ do: "identity.set", set: { botName: "Mina" } }, base), ["sfld.botName"]));
// A note is the owner's own sentence and must NOT be translated.
is("a note card shows what the owner typed", describeSetting({ do: "note.add", set: { text: "We close on Fridays" } }, base, t).lines, ["We close on Fridays"]);
is("switching an offer off reads as a change",
  describeSetting({ do: "offer.update", id: "o1", set: { active: false } }, base, t).lines,
  ["sfld.active: card.on → card.off"]);

// ── the summary the model answers from ─────────────────────────────────────
const sum = settingsSummary(base, ["description", "delivery"]);
ok("the summary carries the offer id so it can be changed", sum.includes("id=o1"));
ok("the summary carries the note id", sum.includes("id=n1"));
ok("an unanswered question says so rather than looking blank", sum.includes("delivery: (not answered)"));
ok("the summary says how far the bot may bargain", sum.includes("limited up to 5%"));
is("an empty shop still produces a summary", typeof settingsSummary({}, ["description"]), "string");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
