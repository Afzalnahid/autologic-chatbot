// "This customer needs a person" — the one signal the product never had.
//
// The bot has always been TOLD (FIXED_BASE, human-handoff rule) to reassure an
// angry or stuck customer that a team member will help — and then nothing
// happened: no flag, no push, no email. The owner found out when the customer
// gave up. Two ways to catch it now, both pure so they are tested here:
//
//   1. The model marks its own hand-off. The prompt asks it to end such a reply
//      with the exact token below; extractHandoff() strips the token before the
//      customer sees anything and reports that it was there.
//   2. A plain reading of the customer's words — asking for a human, a manager,
//      the owner, a phone call — in English, Bangla and Banglish. A fallback for
//      the times the model forgets the token.
//
// No imports: bot.js and the widget route use these, and the test loads them as-is.

export const HANDOFF_TOKEN = "[[HANDOFF]]";

const TOKEN_RE = /\s*\[\[HANDOFF\]\]\s*/g;

/**
 * Removes the hand-off token from every text item and says whether it was
 * present. Items are not mutated; an item left empty by the strip is dropped.
 */
export function extractHandoff(items) {
  let handoff = false;
  const out = [];
  for (const it of items || []) {
    if (it && typeof it.text === "string" && it.text.includes(HANDOFF_TOKEN)) {
      handoff = true;
      const text = it.text.replace(TOKEN_RE, (m, at, s) => (at + m.length >= s.length || at === 0 ? "" : "\n")).trim();
      if (text) out.push({ ...it, text });
    } else if (it) {
      out.push(it);
    }
  }
  return { items: out, handoff };
}

// Word-level patterns. English on word boundaries; Bangla and Banglish as plain
// substrings (Bengali script has no \b, and Banglish is spelled many ways).
const EN = /\b(a real person|real human|human|live agent|an agent|manager|the owner|call me|phone number|speak to (someone|a person)|talk to (someone|a person)|customer care|support team|complain to)\b/i;
const BN = /(মানুষ|ম্যানেজার|মালিক|কথা বলতে চাই|কথা বলব|কথা বলতে হবে|ফোন নাম্বার|ফোন নম্বর|কল দিন|কল করেন|কল দেন|অভিযোগ)/;
const BANGLISH = /\b(manush|manager|malik|kotha bolte|kotha bolbo|call koro|call diben|call den|call dao|phone number|ovijog)\b/i;

/** Does this customer message ask for a person rather than the bot? */
export function wantsHuman(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  return EN.test(s) || BN.test(s) || BANGLISH.test(s);
}
