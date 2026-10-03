// The blog (owner, 2026-10-04): the owner gives a keyword and a language, a GPT
// model writes a draft, the owner reads and edits it in the admin Blog tab, and
// only an approved draft is published on tellmoreai.com/blog. Nothing is ever
// published by the machine on its own.
//
// Pure, no imports: the prompt, the checks on what the model sends back, slugs
// and reading time — so tests/t-blog.mjs can hold them steady. The OpenAI call
// lives in lib/blog-writer.js; the database in api/admin/blog.
//
// Why a facts sheet goes into every prompt: a model asked to "write about
// WhatsApp chatbots for TellMore" will happily invent a price, a statistic, a
// customer or a "Meta partnership". Everything it may say about the product is
// handed to it, and it is told that anything not on the sheet is not to be
// claimed.

export const LANGS = { en: "English", bn: "Bangla" };
export const MAX_TITLE = 70;
export const MAX_META = 160;
export const MIN_BODY_WORDS = 450;

// "Facebook Page chatbot: 7 ways…" → "facebook-page-chatbot-7-ways". Latin only:
// a Bangla title gives a slug the model writes in English, and anything that
// still has no letters becomes "post".
export function slugify(text) {
  const s = String(text || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || "post";
}

// A slug nobody else has: "x", then "x-2", "x-3"…
export function uniqueSlug(base, taken = []) {
  const used = new Set(taken);
  const b = slugify(base);
  if (!used.has(b)) return b;
  for (let i = 2; i < 1000; i++) if (!used.has(`${b}-${i}`)) return `${b}-${i}`;
  return `${b}-${Date.now()}`;
}

// Minutes to read: ~200 words a minute in English, a little slower in Bangla.
export function readingMinutes(md, lang = "en") {
  const words = String(md || "").replace(/[#*_>`\[\]()\-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / (lang === "bn" ? 160 : 200)));
}

export function wordCount(md) {
  return String(md || "").split(/\s+/).filter(Boolean).length;
}

// The facts the model may use. `plans` are the live packages (id, name, biz,
// monthly, byok_monthly); `solutions` the site's own pages it may link to.
export function factsSheet({ plans = [], solutions = [], trialDays = 3 } = {}) {
  const shop = plans.filter((p) => p.biz === "ecommerce" && Number(p.monthly) > 0);
  const svc = plans.filter((p) => p.biz === "agency" && Number(p.monthly) > 0);
  const line = (p) => `${p.name}: ৳${Number(p.monthly).toLocaleString("en-IN")}/month (own AI key: ৳${Number(p.byok_monthly || 0).toLocaleString("en-IN")})`;
  return [
    "PRODUCT: TellMore AI (tellmoreai.com), an AI customer-service chatbot for Bangladeshi businesses. Made by Autolinium, Chattogram, Bangladesh.",
    "WHAT IT DOES: answers customers automatically on Facebook Messenger, Instagram DM, WhatsApp and a chat widget on the business's own website; replies in Bangla and English; reads product photos customers send and finds the matching product; understands voice notes; replies to post comments; takes orders (shops); books meetings into Google Calendar with a Meet link (services); answers from uploaded documents (services); broadcasts and follow-ups inside Meta's 24-hour window; hands a chat to a human when needed; an AI Assistant in the dashboard.",
    "SETUP: one-click connection of the Facebook Page, Instagram and WhatsApp; no code, no tokens to copy.",
    `TRIAL: ${trialDays}-day free trial, no card needed.`,
    shop.length ? `SHOP PACKAGES: ${shop.map(line).join("; ")}.` : "",
    svc.length ? `SERVICE PACKAGES: ${svc.map(line).join("; ")}.` : "",
    "PRICING RULES: every package has every feature, only the amounts differ; the customer can raise replies, products/files and AI Assistant questions with a slider; on their own Gemini or OpenAI key the package is half price.",
    "META: the only allowed wording is \"Meta Tech Provider\" and \"Business verified by Meta\". Never write \"Meta Verified\", \"official Meta partner\" or similar.",
    "DO NOT INVENT: no statistics, percentages, customer names, testimonials, awards, integrations or features that are not on this sheet. If a point needs a number you do not have, make the point without one.",
    solutions.length ? `INTERNAL LINKS YOU MAY USE (relative URLs): /pricing (prices), /dashboard?auth=signup (start the free trial), ${solutions.map((s) => `/solutions/${s.slug}${s.title ? ` (${s.title})` : ""}`).join(", ")}.` : "INTERNAL LINKS YOU MAY USE: /pricing, /dashboard?auth=signup.",
  ].filter(Boolean).join("\n");
}

// The two messages for the chat API. The model must answer with one JSON object.
export function buildPrompt({ keyword, lang = "en", notes = "", facts = "" }) {
  const bn = lang === "bn";
  const system = [
    "You write search-optimised blog articles for TellMore AI's website.",
    "Audience: owners of small and medium businesses in Bangladesh — online shops selling through Facebook pages, and service businesses (agencies, clinics, coaching, real estate).",
    bn
      ? "Write in natural, conversational Bangla, the way a Bangladeshi business writer talks to a shop owner. Not stiff, not machine-translated, no textbook (সাধু) forms. Keep everyday English tech words as Bangladeshis say them (চ্যাটবট, ফেসবুক পেজ, অর্ডার, ইনবক্স)."
      : "Write in clear, plain English for readers in Bangladesh. Short sentences, no hype, no filler.",
    "Be genuinely useful first: explain the problem, give practical steps and examples a business can use even without TellMore. Mention TellMore AI where it honestly fits, and end with one short call to action.",
    "Use only the facts below about the product. Follow every rule in them.",
    "",
    facts,
    "",
    "Return ONE JSON object and nothing else, with these keys:",
    `  "title": the article title, at most ${MAX_TITLE} characters, containing the keyword naturally${bn ? ", in Bangla" : ""};`,
    `  "slug": a short URL slug in lowercase English words joined by hyphens (even for a Bangla article);`,
    `  "meta_description": at most ${MAX_META} characters, a reason to click${bn ? ", in Bangla" : ""};`,
    `  "excerpt": one or two sentences for the blog list${bn ? ", in Bangla" : ""};`,
    `  "body_markdown": the article in Markdown — at least ${MIN_BODY_WORDS + 350} words; start with an introduction paragraph (no H1, the title is shown separately); then sections with ## and ### headings; use bullet or numbered lists where they help; link 2–3 of the internal links naturally as [text](/path); no images, no HTML, no tables;`,
    `  "faq": 3 to 5 objects {"q": question, "a": answer of 1–3 sentences} that people actually search${bn ? ", in Bangla" : ""}.`,
  ].join("\n");
  const user = [
    `Keyword: ${String(keyword || "").trim()}`,
    `Language: ${LANGS[lang] || "English"}`,
    notes ? `Owner's notes for this article: ${String(notes).trim()}` : "",
  ].filter(Boolean).join("\n");
  return { system, user };
}

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "") + "…";
};

// What the model sent back → a clean draft, or a plain reason it is unusable.
// Over-long titles and descriptions are trimmed (the owner can edit them); a
// missing or too-short article is refused rather than saved half-written.
export function parseDraft(raw, { keyword = "" } = {}) {
  let o = raw;
  if (typeof raw === "string") {
    const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    try { o = JSON.parse(t); } catch { return { ok: false, error: "The model did not return a readable draft. Try again." }; }
  }
  if (!o || typeof o !== "object") return { ok: false, error: "The model did not return a draft. Try again." };
  const body = String(o.body_markdown || o.body || "").trim();
  const title = clip(o.title, MAX_TITLE);
  if (!title) return { ok: false, error: "The draft came back without a title. Try again." };
  if (wordCount(body) < MIN_BODY_WORDS) return { ok: false, error: `The draft came back too short (${wordCount(body)} words). Try again, or choose a stronger model.` };
  const faq = (Array.isArray(o.faq) ? o.faq : [])
    .map((f) => ({ q: String(f?.q || f?.question || "").trim(), a: String(f?.a || f?.answer || "").trim() }))
    .filter((f) => f.q && f.a)
    .slice(0, 6);
  return {
    ok: true,
    draft: {
      title,
      slug: slugify(o.slug || title || keyword),
      meta_description: clip(o.meta_description || o.excerpt || "", MAX_META),
      excerpt: clip(o.excerpt || o.meta_description || "", 300),
      // A stray "# Title" at the top would print the title twice.
      body_md: body.replace(/^#\s+[^\n]*\n+/, ""),
      faq,
    },
  };
}

// What the owner may change in the editor, checked the same way.
export function cleanEdit(e = {}) {
  const title = String(e.title || "").replace(/\s+/g, " ").trim();
  if (!title) return { ok: false, error: "A post needs a title." };
  if (title.length > 120) return { ok: false, error: "Keep the title under 120 characters." };
  const body = String(e.body_md || "").trim();
  if (!body) return { ok: false, error: "The article is empty." };
  const faq = (Array.isArray(e.faq) ? e.faq : []).map((f) => ({ q: String(f?.q || "").trim(), a: String(f?.a || "").trim() })).filter((f) => f.q && f.a).slice(0, 8);
  return {
    ok: true,
    edit: {
      title,
      slug: slugify(e.slug || title),
      meta_description: String(e.meta_description || "").replace(/\s+/g, " ").trim().slice(0, 200),
      excerpt: String(e.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 400),
      body_md: body,
      faq,
    },
  };
}
