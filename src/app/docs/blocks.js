import fs from "node:fs";
import path from "node:path";
import { P } from "@/lib/landing.js";
import { num } from "./copy.js";

// Turns the copy in src/lib/docs/{en,bn}.js into a page.
//
// The block shapes are deliberately few. A documentation page that can be
// written with six kinds of block reads the same on page 1 and page 14, and
// that consistency is most of what makes a manual feel official. Adding a
// seventh shape should feel like a decision, not a shortcut.

// **bold** and `code`, nothing else. A full Markdown parser would invite the
// copy to drift into layout, which is exactly what en.js/bn.js exist to prevent.
export function inline(s) {
  return String(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.88em",
        background: P.blueSoft, color: P.blue, padding: "1.5px 5px", borderRadius: 5 }}>{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Stable, readable anchors so "On this page" links survive a copy edit that
// only changes punctuation.
export const headingId = (s, i) =>
  "s" + i + "-" + String(s).toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export const headings = (blocks) =>
  blocks.map((b, i) => (b.h ? { id: headingId(b.h, i), text: b.h } : null)).filter(Boolean);

const Pill = ({ children, tone }) => (
  <span className="lbl" style={{ fontSize: 8.5, padding: "3px 8px", borderRadius: 999,
    background: tone === "agency" ? "color-mix(in srgb, var(--lp-ink) 8%, transparent)" : P.blueSoft,
    color: tone === "agency" ? P.inkSoft : P.blue, whiteSpace: "nowrap" }}>{children}</span>
);

const shotDir = () => path.join(process.cwd(), "public", "docs", "shots");
const hasShot = (file) => { try { return fs.existsSync(path.join(shotDir(), file)); } catch { return false; } };

// The pixel size of a screenshot, read out of the WebP header itself.
//
// Without it every picture is a 1px sliver until it arrives and then shoves
// everything below it down the page — the jump a reader on Bangladeshi mobile
// data feels most, and the one that makes them lose their place mid-sentence.
// Handing the browser width and height lets it hold the exact space open from
// the first paint. Read from the file rather than typed into the copy so a new
// screenshot needs nothing but dropping the file in.
//
// Only the first 32 bytes are read, and the answer is cached for the build.
const DIMS = new Map();
function shotSize(file) {
  if (DIMS.has(file)) return DIMS.get(file);
  let out = null;
  try {
    const fd = fs.openSync(path.join(shotDir(), file), "r");
    const b = Buffer.alloc(32);
    fs.readSync(fd, b, 0, 32, 0);
    fs.closeSync(fd);
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const fmt = b.toString("ascii", 12, 16);
      // The three WebP flavours keep their size in three different places.
      if (fmt === "VP8X") out = { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      else if (fmt === "VP8 ") out = { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      else if (fmt === "VP8L") {
        const bits = b.readUInt32LE(21);
        out = { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
  } catch { out = null; }
  // A size we could not read is simply left off; the picture still shows.
  if (out && (!out.w || !out.h)) out = null;
  DIMS.set(file, out);
  return out;
}

// WebP rather than PNG, and not for fashion: these screenshots are full of the
// dashboard's soft neumorphic shadows, which PNG cannot compress. The same 28
// images are 6.6 MB as PNG and 1.8 MB as WebP with no visible difference — and
// the people reading this manual are on Bangladeshi mobile data.
function Shot({ name, cap, ui }) {
  // Checked on the server so a screenshot that has not been taken yet shows a
  // labelled frame instead of a broken image icon.
  const rel = `/docs/shots/${name}.webp`;
  const exists = hasShot(`${name}.webp`);
  // A light screenshot on a dark page (or the reverse) is the one thing that
  // makes a manual look thrown together. Where a <name>.dark.png has been
  // taken it is swapped in — keyed on the site's own data-theme rather than on
  // prefers-color-scheme, because a reader who pressed the theme button has
  // overruled their operating system and the picture must follow the page.
  // Where no dark shot exists the light one serves both, which is merely plain
  // rather than broken.
  const dark = hasShot(`${name}.dark.webp`) ? `/docs/shots/${name}.dark.webp` : null;
  const lightSize = exists ? shotSize(`${name}.webp`) : null;
  const darkSize = dark ? shotSize(`${name}.dark.webp`) : null;
  // No `display` here on purpose: an inline style would outrank the .shot-l /
  // .shot-d class rules that do the theme swap, and both pictures would show.
  const imgStyle = { width: "100%", height: "auto", borderRadius: 14,
    border: `1px solid ${P.line}`, background: P.paper2 };
  return (
    <figure style={{ margin: "26px 0" }}>
      {exists ? (
        // A dashboard screenshot is 1600px wide and the column on a phone is
        // about 343px — everything inside it is far too small to read. Tapping
        // opens the picture on its own, where the phone can zoom into it. The
        // link carries the light/dark class so the swap still works.
        <>
          <a className={dark ? "shot-l" : undefined} href={rel} target="_blank" rel="noreferrer"
            aria-label={ui?.zoom} title={ui?.zoom}>
            <img src={rel} alt={cap || name} loading="lazy" decoding="async"
              width={lightSize?.w} height={lightSize?.h} style={imgStyle} />
          </a>
          {dark && <a className="shot-d" href={dark} target="_blank" rel="noreferrer"
            aria-label={ui?.zoom} title={ui?.zoom}>
            <img src={dark} alt={cap || name} loading="lazy" decoding="async"
              width={darkSize?.w} height={darkSize?.h} style={imgStyle} />
          </a>}
        </>
      ) : (
        <div style={{ border: `1px dashed ${P.line}`, borderRadius: 14, background: P.paper2,
          padding: "44px 20px", textAlign: "center", color: P.inkSoft }}>
          <i className="ti ti-photo" style={{ fontSize: 26, opacity: .6 }} />
          <div className="lbl" style={{ fontSize: 9, marginTop: 8 }}>{name}.webp</div>
        </div>
      )}
      {(cap || exists) && <figcaption style={{ fontSize: 12.5, color: P.inkSoft, marginTop: 9, lineHeight: 1.6 }}>
        {cap && inline(cap)}
        {/* Only worth saying where the picture is actually too small to read. */}
        {exists && ui?.zoom && <span className="shot-zoom" style={{ color: P.blue }}>{cap ? " " : ""}{ui.zoom}</span>}
      </figcaption>}
    </figure>
  );
}

function Note({ text, kind }) {
  const warn = kind === "warn";
  const tint = warn ? "#D92632" : P.blue;
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", margin: "22px 0", padding: "14px 16px",
      borderRadius: 13, background: `color-mix(in srgb, ${tint} 6%, transparent)`,
      border: `1px solid color-mix(in srgb, ${tint} 20%, transparent)` }}>
      <i className={`ti ti-${warn ? "alert-triangle" : "bulb"}`}
        style={{ fontSize: 17, color: tint, flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>{inline(text)}</div>
    </div>
  );
}

function Table({ head, rows }) {
  return (
    // Wide tables scroll inside their own box; the page itself never scrolls
    // sideways, which on a phone is the difference between usable and not.
    <div style={{ overflowX: "auto", margin: "22px 0", border: `1px solid ${P.line}`, borderRadius: 13 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 420, fontSize: 13.5 }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} className="lbl" style={{ fontSize: 9, color: P.inkSoft, textAlign: "left",
              padding: "11px 14px", borderBottom: `1px solid ${P.line}`, background: P.paper2,
              whiteSpace: "nowrap" }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => (
              <td key={j} style={{ padding: "11px 14px", lineHeight: 1.65, verticalAlign: "top",
                borderBottom: i === rows.length - 1 ? "none" : `1px solid ${P.line}`,
                color: j === 0 ? P.ink : P.inkSoft }}>{inline(cell)}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Steps({ items, lang }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: "18px 0", counterReset: "s" }}>
      {items.map((s, i) => (
        <li key={i} style={{ display: "flex", gap: 13, marginBottom: 13, alignItems: "flex-start" }}>
          <span style={{ width: 24, height: 24, borderRadius: 8, background: P.blueSoft, color: P.blue,
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            fontSize: 12, fontWeight: 700, marginTop: 1 }}>{num(i + 1, lang)}</span>
          {/* The steps are the point of the manual, so they are not set
              smaller than the prose around them. */}
          <span style={{ fontSize: 15.5, lineHeight: 1.75 }}>{inline(s)}</span>
        </li>
      ))}
    </ol>
  );
}

function Faq({ items }) {
  return (
    <div style={{ margin: "18px 0", border: `1px solid ${P.line}`, borderRadius: 13, overflow: "hidden" }}>
      {items.map((f, i) => (
        <details key={i} style={{ borderTop: i ? `1px solid ${P.line}` : "none" }}>
          <summary style={{ cursor: "pointer", padding: "13px 16px", fontSize: 14, fontWeight: 600,
            listStyle: "none", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <i className="ti ti-chevron-right" style={{ fontSize: 15, color: P.blue, flexShrink: 0, marginTop: 2 }} />
            <span>{inline(f.q)}</span>
          </summary>
          <div style={{ padding: "0 16px 15px 41px", fontSize: 14, lineHeight: 1.75, color: P.inkSoft }}>{inline(f.a)}</div>
        </details>
      ))}
    </div>
  );
}

export default function Blocks({ blocks, ui, lang }) {
  return blocks.map((b, i) => (
    <section key={i} id={b.h ? headingId(b.h, i) : undefined} style={{ scrollMarginTop: 84 }}>
      {b.biz && (
        <div style={{ marginTop: 26 }}>
          <Pill tone={b.biz}>{b.biz === "agency" ? ui.forAgency : ui.forEcom}</Pill>
        </div>
      )}
      {b.h && (
        <h2 className="fr" style={{ fontSize: "clamp(20px,3vw,26px)", lineHeight: 1.25,
          margin: b.biz ? "10px 0 12px" : "38px 0 12px" }}>{b.h}</h2>
      )}
      {/* 16px, not 15. This manual is read by people who are not technical and
          often in their second language; the body of a page is not the place
          to save a pixel. */}
      {b.p && b.p.map((para, j) => (
        <p key={j} style={{ fontSize: 16, lineHeight: 1.75, color: P.inkSoft, margin: "0 0 14px" }}>{inline(para)}</p>
      ))}
      {b.steps && <Steps items={b.steps} lang={lang} />}
      {b.table && <Table head={b.table.head} rows={b.table.rows} />}
      {b.shot && <Shot name={b.shot} cap={b.cap} ui={ui} />}
      {b.note && <Note text={b.note} kind={b.kind} />}
      {b.faq && <Faq items={b.faq} />}
    </section>
  ));
}
