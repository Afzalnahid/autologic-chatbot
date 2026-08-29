// What the assistant may change OUTSIDE the catalogue — offers, bargaining,
// what the bot has been taught, who it says it is.
//
// This is the sister of inventory-actions.js and it exists for the same reason:
// the prompt that tells the model what it may ask for, the route that carries
// out what the owner confirmed, and the panel that shows the owner what they are
// confirming all have to agree. If they drift, the owner is shown one thing and
// a different thing happens, which is the only failure mode that matters here.
//
// Everything in this file lives in ONE row — `app_settings.settings` for this
// client — which is what makes the whole of the Bot Training tab reachable by
// conversation without a second write path: read the object, apply a whitelisted
// change to a copy, save the copy.
//
// Pure. No supabase, no AI. The browser and the server both import it, and the
// tests run it under node.

const str = (v) => (v === undefined || v === null ? "" : String(v)).trim();
const bool = (v) => v === true || v === "true" || v === 1 || v === "1";

// A deal the bot may quote word for word. `products` is deliberately NOT here:
// choosing which products an offer covers means picking real rows out of the
// catalogue, and a model naming them from memory would attach the offer to the
// wrong shirt. The owner does that on the Offers tab, where the list is real.
export const OFFER_FIELDS = {
  title: "Name",
  details: "What the customer gets",
  valid_until: "Runs until",
  active: "Live",
};

// What the bot has been taught about the business. The union of the shop's
// questions and the agency's — which one a client is actually asked is decided
// where the questions are shown, and a key that does not belong to their kind
// of business is simply never rendered.
export const TRAINING_FIELDS = {
  description: "What the business is",
  products: "What it sells",
  services: "Services offered",
  pricing: "How pricing works",
  process: "How the work runs",
  timeline: "How long things take",
  meetingInfo: "Meetings",
  clients: "Who the clients are",
  contract: "Contracts",
  objections: "Common objections",
  delivery: "Delivery",
  deliveryAreas: "Delivery areas",
  payment: "Payment methods",
  advancePay: "Advance payment",
  returnPolicy: "Returns",
  stock: "Stock and restocking",
  warranty: "Warranty",
  hours: "Opening hours",
  catalogLink: "Catalogue link",
  faq: "Frequently asked",
  complaints: "Complaints",
  special: "Anything else",
};

// Which of those a business is actually asked, and in what order. A shop and an
// agency are asked genuinely different things — the shop about stock, delivery
// and returns, the agency about process, timeline and objections — because a
// bot trained on the wrong questions answers badly in exactly the moments that
// cost a sale.
//
// They live here rather than in the Bot Training tab because the assistant now
// needs the same list: it has to know which questions this business has, to
// answer "what have I not told you yet" and to fill one in. Two copies of a
// list like this drift, and the drift is invisible until a question exists in
// one place and not the other.
export const TRAINING_KEYS_ECOM = ["description", "products", "delivery", "deliveryAreas", "payment", "advancePay",
  "returnPolicy", "stock", "warranty", "hours", "catalogLink", "faq", "complaints", "special"];
export const TRAINING_KEYS_AGENCY = ["description", "services", "pricing", "process", "timeline", "meetingInfo",
  "clients", "hours", "catalogLink", "contract", "faq", "objections", "special"];
export const trainingKeys = (businessType) => businessType === "agency" ? TRAINING_KEYS_AGENCY : TRAINING_KEYS_ECOM;

// Who the bot says it is. `tone` and `languages` sit inside the questionnaire
// and the rest at the top of the settings object; both are set from here, so
// the owner never has to know which is which.
export const IDENTITY_FIELDS = {
  botName: "Bot's name",
  businessName: "Business name",
  greeting: "Opening line",
  tone: "Tone",
  languages: "Languages",
};

// Fixed choices. A model that answers "polite" for a tone would otherwise write
// a value nothing in the dashboard can display.
export const TONES = ["Friendly and helpful", "Professional and formal", "Casual and fun"];
export const LANGUAGES = ["Follow the customer's language", "Bangla only", "English only"];
export const BARGAIN_MODES = ["fixed", "limited", "custom"];

export const SETTING_VERBS = [
  "offer.create", "offer.update", "offer.delete",
  "bargain.set",
  "note.add", "note.delete",
  "training.set",
  "identity.set",
  "followup.set",
];

const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const pick = (raw, fields, limit = 2000) => {
  const set = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!(k in fields) || v === undefined || v === null) continue;
    if (k === "active") { set[k] = bool(v); continue; }
    const s = str(v).slice(0, limit);
    if (s) set[k] = s;
  }
  return set;
};

// One proposal, cleaned — or null when it is not something we can carry out.
// Everything outside the whitelist is dropped rather than passed along, so a
// model that invents a field simply has that field ignored.
export function normalizeSetting(raw) {
  const verb = str(raw?.do).toLowerCase();
  if (!SETTING_VERBS.includes(verb)) return null;
  const id = str(raw?.id);

  if (verb === "offer.create") {
    const set = pick(raw?.set, OFFER_FIELDS);
    if (!set.title && !set.details) return null;
    return { do: verb, set: { active: true, ...set } };
  }
  if (verb === "offer.update") {
    if (!id) return null;
    const set = pick(raw?.set, OFFER_FIELDS);
    // `active` is a boolean, so an offer being switched off has a set that is
    // "empty" by a truthiness test. Checked by key, not by value.
    if (!Object.keys(set).length) return null;
    return { do: verb, id, set };
  }
  if (verb === "offer.delete") return id ? { do: verb, id } : null;

  if (verb === "bargain.set") {
    const set = {};
    const mode = str(raw?.set?.mode).toLowerCase();
    if (BARGAIN_MODES.includes(mode)) set.mode = mode;
    if (raw?.set?.max_discount_pct !== undefined) {
      const n = Math.round(Number(String(raw.set.max_discount_pct).replace(/[^\d.]/g, "")));
      // 1–50. A model that answers 0 would silently mean "no discount", which
      // is what "fixed" is for and must not be reached by accident.
      if (Number.isFinite(n) && n >= 1) set.max_discount_pct = Math.min(50, n);
    }
    const custom = str(raw?.set?.custom).slice(0, 2000);
    if (custom) set.custom = custom;
    if (!Object.keys(set).length) return null;
    return { do: verb, set };
  }

  if (verb === "note.add") {
    const text = str(raw?.set?.text || raw?.text).slice(0, 2000);
    return text ? { do: verb, set: { text } } : null;
  }
  if (verb === "note.delete") return id ? { do: verb, id } : null;

  if (verb === "training.set") {
    const set = pick(raw?.set, TRAINING_FIELDS, 4000);
    return Object.keys(set).length ? { do: verb, set } : null;
  }

  if (verb === "identity.set") {
    const set = pick(raw?.set, IDENTITY_FIELDS, 200);
    // Two of these are a fixed list. A value off the list is dropped rather
    // than written, because nothing in the dashboard could show it back.
    if (set.tone && !TONES.includes(set.tone)) delete set.tone;
    if (set.languages && !LANGUAGES.includes(set.languages)) delete set.languages;
    return Object.keys(set).length ? { do: verb, set } : null;
  }

  if (verb === "followup.set") {
    if (raw?.set?.enabled === undefined) return null;
    return { do: verb, set: { enabled: bool(raw.set.enabled) } };
  }
  return null;
}

export const normalizeSettingActions = (list) =>
  (Array.isArray(list) ? list : []).map(normalizeSetting).filter(Boolean).slice(0, 20);

const offersOf = (s) => (Array.isArray(s?.offers) ? s.offers : []);
const notesOf = (s) => (Array.isArray(s?.questionnaire?.notes) ? s.questionnaire.notes : []);

// Carry out the confirmed proposals against a COPY of the settings, and say what
// happened to each. Pure on purpose: the route reads the settings, calls this,
// and writes the result — so the rule about what may change lives in one place
// that can be run without a database.
export function applySettingActions(settings, actions) {
  let next = { ...(settings || {}) };
  const results = [];
  const q = () => ({ ...(next.questionnaire || {}) });

  for (const a of normalizeSettingActions(actions)) {
    try {
      if (a.do === "offer.create") {
        next.offers = [...offersOf(next), { id: newId(), products: [], ...a.set }];
        results.push({ ok: true, did: "offer added", label: a.set.title || a.set.details });
      } else if (a.do === "offer.update") {
        const list = offersOf(next);
        const at = list.findIndex((o) => String(o?.id) === a.id);
        if (at < 0) { results.push({ ok: false, error: "that offer is no longer there" }); continue; }
        next.offers = list.map((o, i) => i === at ? { ...o, ...a.set } : o);
        results.push({ ok: true, did: "offer changed", label: next.offers[at].title || next.offers[at].details });
      } else if (a.do === "offer.delete") {
        const list = offersOf(next);
        const gone = list.find((o) => String(o?.id) === a.id);
        if (!gone) { results.push({ ok: false, error: "that offer is no longer there" }); continue; }
        next.offers = list.filter((o) => String(o?.id) !== a.id);
        results.push({ ok: true, did: "offer removed", label: gone.title || gone.details });
      } else if (a.do === "bargain.set") {
        // Choosing a mode turns bargaining on: an owner who has just said how
        // far the bot may go has not also asked for it to be disabled.
        next.bargain = { enabled: true, mode: "limited", max_discount_pct: 5, custom: "", ...(next.bargain || {}), ...a.set };
        results.push({ ok: true, did: "bargaining set", label: next.bargain.mode });
      } else if (a.do === "note.add") {
        next.questionnaire = { ...q(), notes: [...notesOf(next), { id: newId(), text: a.set.text }] };
        results.push({ ok: true, did: "the bot was taught", label: a.set.text.slice(0, 60) });
      } else if (a.do === "note.delete") {
        const list = notesOf(next);
        const gone = list.find((n) => String(n?.id) === a.id);
        if (!gone) { results.push({ ok: false, error: "that note is no longer there" }); continue; }
        next.questionnaire = { ...q(), notes: list.filter((n) => String(n?.id) !== a.id) };
        results.push({ ok: true, did: "note removed", label: gone.text?.slice(0, 60) });
      } else if (a.do === "training.set") {
        next.questionnaire = { ...q(), ...a.set };
        results.push({ ok: true, did: "training updated", label: Object.keys(a.set).map((k) => TRAINING_FIELDS[k]).join(", ") });
      } else if (a.do === "identity.set") {
        const { tone, languages, ...top } = a.set;
        next = { ...next, ...top };
        if (tone || languages) next.questionnaire = { ...q(), ...(tone ? { tone } : {}), ...(languages ? { languages } : {}) };
        results.push({ ok: true, did: "identity updated", label: Object.keys(a.set).map((k) => IDENTITY_FIELDS[k]).join(", ") });
      } else if (a.do === "followup.set") {
        next.followup = { ...(next.followup || {}), enabled: a.set.enabled };
        results.push({ ok: true, did: a.set.enabled ? "follow-ups on" : "follow-ups off" });
      }
    } catch (e) {
      results.push({ ok: false, error: e.message });
    }
  }
  return { next, results };
}

// What the owner reads before pressing the button. `before` is the settings as
// they stand, so a change reads "5% → 10%" rather than just "10%" — the
// difference between confirming a change and confirming a number.
//
// `t` is the dashboard's translator and is required, not optional: a default
// that quietly falls back to English is exactly how English comes back under a
// Bangla screen. Only the browser calls this — the routes import the whitelist
// and the applier, never the describer — so there is always one to hand.
//
// The labels are keys that mostly already exist: the bot's profile questions
// are labelled on the Bot Training form, so `lbl.*` is read in both places and
// translated once.
export function describeSetting(a, settings, t) {
  const offers = offersOf(settings);
  const notes = notesOf(settings);
  const s = settings || {};
  const q = s.questionnaire || {};
  const show = (v) => (v === true ? t("card.on") : v === false ? t("card.off") : String(v ?? ""));
  // "was → now", or just "now" when there was nothing there before. The arrow
  // needs no translation and the label is looked up once.
  const change = (label, before, after) => (before && before !== after ? `${label}: ${before} → ${after}` : `${label}: ${after}`);
  const clip = (v, n) => `${String(v).slice(0, n)}${String(v).length > n ? "…" : ""}`;

  if (a.do === "offer.create") return {
    title: t("card.addOffer", { name: a.set.title || a.set.details }),
    lines: Object.entries(a.set).filter(([k]) => k !== "title").map(([k, v]) => `${t(`sfld.${k}`)}: ${show(v)}`)
      .concat(t("card.offerQuoted")),
  };
  if (a.do === "offer.update") {
    const was = offers.find((o) => String(o?.id) === a.id) || {};
    return {
      title: t("card.changeOffer", { name: was.title || was.details || "—" }),
      lines: Object.entries(a.set).map(([k, v]) => change(t(`sfld.${k}`), show(was[k] ?? ""), show(v))),
    };
  }
  if (a.do === "offer.delete") {
    const was = offers.find((o) => String(o?.id) === a.id) || {};
    return { title: t("card.removeOffer", { name: was.title || was.details || "—" }), danger: true, lines: [t("card.removeOfferWhy")] };
  }
  if (a.do === "bargain.set") {
    const b = s.bargain || {};
    const mode = (m) => (m ? t(`card.mode.${m}`) : t("card.notSet"));
    const lines = [];
    if (a.set.mode) lines.push(change(t("card.bargainMode"), a.set.mode !== b.mode ? mode(b.mode) : "", mode(a.set.mode)));
    if (a.set.max_discount_pct !== undefined) {
      lines.push(change(t("card.bargainPct"), b.max_discount_pct ? `${b.max_discount_pct}%` : "", `${a.set.max_discount_pct}%`));
    }
    if (a.set.custom) lines.push(`${t("card.bargainCustom")}: ${clip(a.set.custom, 160)}`);
    return { title: t("card.bargain"), lines };
  }
  if (a.do === "note.add") return { title: t("card.teach"), lines: [a.set.text] };
  if (a.do === "note.delete") {
    const was = notes.find((n) => String(n?.id) === a.id) || {};
    return { title: t("card.forget"), danger: true, lines: [was.text || "—"] };
  }
  if (a.do === "training.set") return {
    title: t("card.training"),
    lines: Object.entries(a.set)
      .map(([k, v]) => (str(q[k]) ? change(t(`lbl.${k}`), clip(str(q[k]), 70), clip(v, 70)) : `${t(`lbl.${k}`)}: ${clip(v, 140)}`))
      .concat(t("card.trainingThen")),
  };
  if (a.do === "identity.set") return {
    title: t("card.identity"),
    lines: Object.entries(a.set).map(([k, v]) => change(t(`sfld.${k}`), str(k === "tone" || k === "languages" ? q[k] : s[k]), v)),
  };
  if (a.do === "followup.set") return {
    title: t(a.set.enabled ? "card.followOn" : "card.followOff"),
    lines: [t(a.set.enabled ? "card.followOnWhy" : "card.followOffWhy")],
  };
  return { title: t("card.setting"), lines: [] };
}

// A short, honest picture of the settings for the model to answer from. Kept
// small on purpose: the whole object contains the generated business profile,
// which is thousands of words the model does not need to repeat back.
export function settingsSummary(settings, keys) {
  const s = settings || {};
  const q = s.questionnaire || {};
  const offers = offersOf(s);
  const notes = notesOf(s);
  const b = s.bargain || {};
  const line = (k) => {
    const v = str(q[k]);
    return `- ${k}: ${v ? `${v.slice(0, 200)}${v.length > 200 ? "…" : ""}` : "(not answered)"}`;
  };
  return [
    `IDENTITY: bot name=${str(s.botName) || "(not set)"}, business name=${str(s.businessName) || "(not set)"}, greeting=${str(s.greeting) || "(not set)"}, tone=${str(q.tone) || "(not set)"}, languages=${str(q.languages) || "(not set)"}`,
    `FOLLOW-UP MESSAGES: ${s.followup?.enabled ? "on" : "off"}`,
    `BARGAINING: ${b.mode ? `${b.mode}${b.mode === "limited" ? ` up to ${b.max_discount_pct ?? 5}%` : ""}` : "(not chosen)"}`,
    "",
    `OFFERS (${offers.length}):`,
    offers.length
      ? offers.map((o) => `- id=${o.id} | title=${str(o.title) || "(untitled)"} | details=${str(o.details).slice(0, 160)} | until=${str(o.valid_until) || "(no end date)"} | ${o.active === false ? "SWITCHED OFF" : "live"} | covers ${(o.products || []).length} product(s)`).join("\n")
      : "- none yet",
    "",
    `WHAT THE BOT HAS BEEN TAUGHT (${notes.length} note${notes.length === 1 ? "" : "s"}):`,
    notes.length ? notes.map((n) => `- id=${n.id} | ${str(n.text).slice(0, 200)}`).join("\n") : "- none yet",
    "",
    "THE BUSINESS PROFILE ANSWERS:",
    (keys || Object.keys(TRAINING_FIELDS)).map(line).join("\n"),
  ].join("\n");
}
