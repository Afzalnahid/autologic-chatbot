// A small, safe Markdown renderer for blog articles. Pure, no imports.
//
// The text comes from a language model and from the owner's editor, so it is
// treated as untrusted: every character is HTML-escaped FIRST, and only a short
// list of Markdown forms is turned back into tags — headings (## ###), paragraphs,
// bullet and numbered lists, block quotes, **bold**, *italic*, `code`, and links.
// A link may only point at http(s) or a path on this site, so nothing can smuggle
// in a script, an iframe, an image or a javascript: URL.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function safeHref(url) {
  const u = String(url || "").trim();
  if (/^\/(?!\/)/.test(u)) return u;                         // a path on this site
  if (/^https?:\/\/[^\s"'<>]+$/i.test(u)) return u;          // a full web address
  return null;
}

// Inline forms, on text that is already escaped.
function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    // The URL was escaped with the rest; undo that for the check, re-escape after.
    const raw = url.replace(/&amp;/g, "&");
    const href = safeHref(raw);
    if (!href) return label;
    const ext = /^https?:/i.test(href);
    return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener nofollow"' : ""}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s;
}

// "Getting started" → "getting-started", for heading anchors (Latin only; a
// Bangla heading gets h-1, h-2…).
function anchor(text, n) {
  const a = String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return a || `h-${n}`;
}

// → { html, headings: [{ level, text, id }] }
export function renderMarkdown(md) {
  const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const headings = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`); quote = []; } };
  const flush = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.+)$/))) {
      flush();
      // A "#" title inside the body is shown as a section, never a second H1.
      const level = Math.min(4, Math.max(2, m[1].length));
      const text = m[2].replace(/#+\s*$/, "").trim();
      const id = anchor(text, headings.length + 1);
      headings.push({ level, text, id });
      out.push(`<h${level} id="${esc(id)}">${inline(text)}</h${level}>`);
      continue;
    }
    if ((m = line.match(/^[-*+]\s+(.+)$/))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flush(); out.push("<hr/>"); continue; }
    flushList(); flushQuote();
    para.push(line);
  }
  flush();
  return { html: out.join("\n"), headings };
}
