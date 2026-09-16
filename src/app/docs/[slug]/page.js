import { notFound } from "next/navigation";
import { P } from "@/lib/landing.js";
import { PAGES, bySlug, neighbours, isWritten } from "@/lib/docs/index.js";
import { pickLang, copy, docHref, num, writtenSet } from "../copy.js";
import { pageMeta, SITE } from "@/lib/seo.js";
import DocsShell from "../shell.js";
import Blocks, { headings } from "../blocks.js";

// One documentation page. The slug is the route; the words come from
// src/lib/docs/{en,bn}.js. A page declared in the map but not yet written
// renders an honest "being written" panel and is marked noindex, because an
// empty page in Google's results is worse than no page at all.

export function generateStaticParams() {
  return PAGES.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params, searchParams }) {
  const page = bySlug(params.slug);
  if (!page) return {};
  const lang = pickLang(searchParams);
  const { UI, DOCS } = copy(lang);
  const doc = DOCS[params.slug];
  const name = UI.names[params.slug] || params.slug;
  const written = isWritten(doc);
  return {
    ...pageMeta({
      title: `${name} — TellMore AI ${UI.brand}`,
      description: written ? doc.lead : UI.tagline,
      path: `/docs/${params.slug}`,
      lang,
      robots: written ? undefined : { index: false, follow: true },
    }),
    // Unchanged, for the reason given on the docs hub page.
    alternates: { canonical: `${SITE}/docs/${params.slug}` },
  };
}

export default function DocPage({ params, searchParams }) {
  const page = bySlug(params.slug);
  if (!page) notFound();

  const lang = pickLang(searchParams);
  const { UI, DOCS } = copy(lang);
  const doc = DOCS[params.slug];
  const written = isWritten(doc);
  const name = UI.names[params.slug] || params.slug;
  const { prev, next } = neighbours(params.slug);
  const toc = written ? headings(doc.blocks) : [];

  return (
    <DocsShell lang={lang} slug={params.slug} ui={UI} written={writtenSet(lang)}>
      {/* 680px, down from 760. At 760 a line of body text ran to 86 characters;
          the eye starts losing its place on the way back to the left margin
          past about 75, and this is a manual people read end to end. The
          pictures narrow with it, which costs nothing — they open full size on
          a tap. */}
      <article style={{ maxWidth: 680 }}>
        <nav className="lbl crumb" style={{ fontSize: 9, color: P.inkSoft, marginBottom: 14 }}>
          <a href={docHref("", lang)} style={{ color: "inherit", textDecoration: "none" }}>{UI.brand}</a>
          <span style={{ margin: "0 7px", opacity: .5 }}>/</span>
          <span style={{ color: P.blue }}>{UI.groups[page.group] || page.group}</span>
        </nav>

        <h1 className="fr" style={{ fontSize: "clamp(28px,4.4vw,42px)", lineHeight: 1.1, margin: "0 0 14px" }}>
          {written ? doc.title : name}
        </h1>

        {written && (
          <>
            <p style={{ fontSize: 16.5, lineHeight: 1.75, color: P.inkSoft, margin: "0 0 18px" }}>{doc.lead}</p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
              paddingBottom: 22, borderBottom: `1px solid ${P.line}` }}>
              {page.tab && (
                // The dashboard reads window.location.hash on load, so this
                // lands the reader on the exact tab they were just reading about.
                <a href={`/dashboard#${page.tab}`} className="navbtn navcta">
                  <i className="ti ti-external-link" style={{ fontSize: 13 }} />{UI.openTab}
                </a>
              )}
              {doc.time && (
                <span className="lbl" style={{ fontSize: 9, color: P.inkSoft }}>
                  {UI.readTime.replace("{n}", num(doc.time, lang))}
                </span>
              )}
            </div>

            {toc.length > 2 && (
              <nav aria-label={UI.onThisPage} className="toc" style={{ margin: "26px 0 8px", padding: "14px 18px",
                background: P.paper2, border: `1px solid ${P.line}`, borderRadius: 13 }}>
                <div className="lbl" style={{ fontSize: 9, color: P.inkSoft, marginBottom: 9 }}>{UI.onThisPage}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} style={{ fontSize: 13.5, color: P.blue, textDecoration: "none",
                        lineHeight: 1.55 }}>{h.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <Blocks blocks={doc.blocks} ui={UI} lang={lang} />
          </>
        )}

        {!written && (
          <div className="card" style={{ padding: 24, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <i className="ti ti-pencil" style={{ fontSize: 19, color: P.blue, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>{UI.writing}</div>
                <div style={{ fontSize: 14, lineHeight: 1.75, color: P.inkSoft }}>{UI.writingBody}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between",
          marginTop: 44, paddingTop: 22, borderTop: `1px solid ${P.line}` }}>
          {prev ? (
            <a href={docHref(prev.slug, lang)} className="navbtn">
              <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
              {UI.names[prev.slug] || prev.slug}
            </a>
          ) : <span />}
          {next && (
            <a href={docHref(next.slug, lang)} className="navbtn">
              {UI.names[next.slug] || next.slug}
              <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
            </a>
          )}
        </div>

        <div className="card" style={{ padding: 22, marginTop: 22 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>{UI.needHelp}</div>
          <div style={{ fontSize: 14, color: P.inkSoft, lineHeight: 1.7, marginBottom: 14 }}>{UI.needHelpBody}</div>
          <a href="/contact" className="navbtn">{UI.contact}</a>
        </div>
      </article>
    </DocsShell>
  );
}
