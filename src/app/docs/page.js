import { P } from "@/lib/landing.js";
import { PAGES, GROUPS } from "@/lib/docs/index.js";
import { pickLang, copy, docHref, writtenSet } from "./copy.js";
import { pageMeta } from "@/lib/seo.js";
import DocsShell from "./shell.js";

// The documentation hub: every page, grouped the way the sidebar groups them.
// A reader who does not yet know what they are looking for starts here.

export function generateMetadata({ searchParams }) {
  const lang = pickLang(searchParams);
  const { UI } = copy(lang);
  return {
    // The hub is written in both languages, so each version points at itself
    // and the two are declared to each other (see pageMeta).
    ...pageMeta({ title: `${UI.brand} — TellMore AI`, description: UI.tagline, path: "/docs", lang, bilingual: true }),
  };
}

export default function DocsHome({ searchParams }) {
  const lang = pickLang(searchParams);
  const { UI, DOCS } = copy(lang);
  const written = writtenSet(lang);

  return (
    <DocsShell lang={lang} slug="" ui={UI} written={written}>
      <header style={{ marginBottom: 34 }}>
        <div className="lbl" style={{ fontSize: 9.5, color: P.blue, marginBottom: 12 }}>{UI.brand}</div>
        <h1 className="fr" style={{ fontSize: "clamp(30px,5vw,46px)", lineHeight: 1.08, margin: "0 0 12px" }}>
          {UI.tagline}
        </h1>
      </header>

      {GROUPS.map((g) => {
        const items = PAGES.filter((p) => p.group === g);
        if (!items.length) return null;
        return (
          <section key={g} style={{ marginBottom: 34 }}>
            <div className="lbl" style={{ fontSize: 9.5, color: P.inkSoft, marginBottom: 12 }}>{UI.groups[g] || g}</div>
            <div style={{ display: "grid", gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" }}>
              {items.map((p) => {
                const doc = DOCS[p.slug];
                const soon = !written.has(p.slug);
                return (
                  <a key={p.slug} href={docHref(p.slug, lang)} className="card"
                    style={{ padding: 18, textDecoration: "none", color: P.ink, display: "block",
                      opacity: soon ? 0.55 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 10, background: P.blueSoft,
                        color: P.blue, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0 }}>
                        <i className={`ti ${p.icon}`} style={{ fontSize: 17 }} />
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{UI.names[p.slug] || p.slug}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: P.inkSoft }}>
                      {soon ? UI.writing : doc.lead}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="card" style={{ padding: 22, marginTop: 40 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{UI.needHelp}</div>
        <div style={{ fontSize: 14, color: P.inkSoft, lineHeight: 1.7, marginBottom: 14 }}>{UI.needHelpBody}</div>
        <a href="/contact" className="navbtn navcta">{UI.contact}</a>
      </div>
    </DocsShell>
  );
}
