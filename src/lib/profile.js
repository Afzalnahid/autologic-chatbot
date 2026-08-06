// Builds a business profile from the owner's own answers, with no AI involved.
//
// The AI generator rewrites these answers into cleaner prose, but it must never
// be the only path: if Gemini is rate-limited, out of quota, or simply slow, a
// client who finished onboarding would otherwise end up with a bot that knows
// nothing about their business. This composer guarantees every tenant always
// has a usable profile — generation upgrades it, it does not create it.

const clean = (v) => String(v || "").trim();

export function composeProfile(answers = {}, businessType = "ecommerce") {
  const a = answers;
  const isEcom = businessType !== "agency";
  const out = [];

  out.push("IDENTITY & TONE:");
  const tone = clean(a.tone) || "Friendly and helpful";
  const langs = clean(a.languages) || "Follow the customer's language";
  const langRule = /english only/i.test(langs)
    ? "Always reply in English, even when the customer writes in Bangla."
    : /bangla only/i.test(langs)
      ? "Always reply in Bangla, even when the customer writes in English."
      : "Reply in whichever language the customer used — Bangla, English or Banglish.";
  out.push(`Speak in a ${tone.toLowerCase()} tone. ${langRule}`);
  if (clean(a.special)) out.push(`Brand rules from the owner: ${clean(a.special)}`);
  out.push("");

  out.push("WHAT WE OFFER:");
  out.push(clean(a.description) || "The owner has not described the business yet. If a customer asks what you offer, say you will confirm the details with the team.");
  if (isEcom) {
    if (clean(a.catalogLink)) out.push(`Full catalog: ${clean(a.catalogLink)} — share this link when a customer asks to see everything.`);
  } else {
    if (clean(a.services)) out.push(`Services: ${clean(a.services)}`);
    if (clean(a.catalogLink)) out.push(`Website: ${clean(a.catalogLink)} — share this when a customer asks for more information.`);
  }
  out.push("");

  out.push("PRICING & POLICIES:");
  const pol = [];
  if (clean(a.hours)) pol.push(`Working hours: ${clean(a.hours)}.`);
  if (isEcom) {
    pol.push(clean(a.delivery)
      ? `Delivery: ${clean(a.delivery)}`
      : "Delivery details were not provided — if a customer asks, say you will confirm with the team and ask for their location.");
    pol.push(clean(a.payment)
      ? `Payment: ${clean(a.payment)}`
      : "Payment methods were not provided — if a customer asks, say you will confirm with the team.");
    pol.push(clean(a.returnPolicy)
      ? `Returns and refunds: ${clean(a.returnPolicy)}`
      : "A return policy was not provided — if a customer asks, say you will check with the team.");
  } else {
    pol.push(clean(a.meetingInfo)
      ? `Meetings and consultation: ${clean(a.meetingInfo)}`
      : "Consultation details were not provided — offer to book a call and let the team confirm specifics.");
  }
  if (!pol.length) pol.push("No pricing or policy details were provided. Never quote a price you were not given.");
  out.push(...pol);
  out.push("");

  out.push(isEcom ? "HOW TO HANDLE ORDERS:" : "HOW TO HANDLE BOOKINGS:");
  out.push(isEcom
    ? "When a customer wants to buy, collect their full name, phone number and full delivery address, then read the whole order back before confirming."
    : "When a customer wants to book, collect their full name, email, phone number, the service they need, and their preferred date and time, then read it back before confirming.");
  out.push("");

  if (clean(a.faq)) {
    out.push("FREQUENTLY ASKED QUESTIONS:");
    out.push(clean(a.faq));
    out.push("");
  }

  out.push("BOUNDARIES:");
  out.push("Answer only from the information above and the knowledge base. Never invent prices, services, delivery charges, timelines or policies. If you do not know something, say you will check with the team.");

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
