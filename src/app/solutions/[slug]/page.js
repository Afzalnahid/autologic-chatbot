import { notFound } from "next/navigation";
import { P } from "@/lib/landing.js";
import SiteShell, { Section } from "../../site-shell.js";
import { SOLUTIONS, bySlug, isWritten } from "@/lib/solutions/index.js";
import * as EN from "@/lib/solutions/en.js";
import * as BN from "@/lib/solutions/bn.js";
import { pageMeta, faqJsonLd, breadcrumbJsonLd, jsonLdProps } from "@/lib/seo.js";

// One marketing page per search someone actually types — "chatbot for facebook
// page", "হোয়াটসঅ্যাপ অটো রিপ্লাই". See src/lib/solutions/index.js for why
// these exist separately from the home page.
//
// Language follows the same ?lang=bn convention as the manual and the landing
// page. A page with no Bangla copy falls back to English rather than rendering
// half-translated.

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

const copy = (lang) => (lang === "bn" ? BN : EN);
const pickLang = (sp) => (sp?.lang === "bn" ? "bn" : "en");

function page(slug, lang) {
  const inLang = copy(lang).PAGES[slug];
  return isWritten(inLang) ? { doc: inLang, lang } : { doc: EN.PAGES[slug], lang: "en" };
}

export function generateMetadata({ params, searchParams }) {
  if (!bySlug(params.slug)) return {};
  const { doc, lang } = page(params.slug, pickLang(searchParams));
  if (!doc) return {};
  return pageMeta({
    title: doc.metaTitle,
    description: doc.description,
    path: `/solutions/${params.slug}`,
    lang,
    // Every solution page is written in both languages, but check rather than
    // assume — a half-written one must not advertise a Bangla address.
    bilingual: isWritten(BN.PAGES[params.slug]),
  });
}

export default function SolutionPage({ params, searchParams }) {
  const meta = bySlug(params.slug);
  if (!meta) notFound();
  const { doc, lang } = page(params.slug, pickLang(searchParams));
  if (!doc) notFound();
  const { UI } = copy(lang);
  const href = (slug) => `/solutions/${slug}${lang === "bn" ? "?lang=bn" : ""}`;
  const related = (doc.related || []).map((s) => ({ slug: s, doc: copy(lang).PAGES[s] || EN.PAGES[s] })).filter((r) => r.doc);

  return (
    <SiteShell eyebrow={doc.eyebrow} title={doc.title} lead={doc.lead}>
      <script {...jsonLdProps(breadcrumbJsonLd([
        { name: "TellMore AI", path: "/" },
        { name: "Solutions", path: "/solutions/facebook-messenger-chatbot" },
        { name: doc.title, path: `/solutions/${params.slug}` },
      ]))} />
      {doc.faq?.length && <script {...jsonLdProps(faqJsonLd(doc.faq))} />}

      {/* The first call to action sits above the sections: a visitor who
          arrived from a search already knows what they want. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "22px 0 4px" }}>
        <a href="/dashboard?auth=signup" className="navbtn navcta">{UI.cta}</a>
        <a href="/pricing" className="navbtn">{UI.pricing}</a>
        <span style={{ fontSize: 13, color: P.inkSoft }}>{UI.ctaNote}</span>
      </div>

      {doc.sections.map((s, i) => (
        <Section key={i} title={s.h}>
          {(s.p || []).map((t, j) => <p key={j}>{t}</p>)}
          {s.list && <ul>{s.list.map((t, j) => <li key={j}>{t}</li>)}</ul>}
        </Section>
      ))}

      {!!doc.faq?.length && (
        <Section title={UI.faqTitle}>
          {doc.faq.map((f, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 5 }}>{f.q}</div>
              <p style={{ margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </Section>
      )}

      <Section title={UI.more}>
        {/* Internal links: they carry a reader from one search to the next page
            that answers it, and they are how Google learns these pages belong
            to one site rather than sitting alone. */}
        <ul>
          {related.map((r) => <li key={r.slug}><a href={href(r.slug)}>{r.doc.title}</a></li>)}
          <li><a href="/pricing">{UI.pricing}</a></li>
          <li><a href={lang === "bn" ? "/docs?lang=bn" : "/docs"}>{UI.docs}</a></li>
        </ul>
        <p>
          <a href="/dashboard?auth=signup" className="navbtn navcta" style={{ marginTop: 8 }}>{UI.cta}</a>
        </p>
      </Section>
    </SiteShell>
  );
}
