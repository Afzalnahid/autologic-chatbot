"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { T, Card, Btn, Inp, Badge, Select, Segmented, useIsMobile, taka } from "./ui.js";
import { api, apiJson } from "./session.js";
import { parseCsv, autoMap, toProducts, COLUMNS, SAMPLE_CSV } from "@/lib/csv.js";
import { shrinkBatch, fileSize } from "@/lib/shrink-image.js";
import { uploadPhotos, tooLargePhotos, PHOTO_MAX_BYTES } from "./photo-upload.js";
import { buildVariants, usableOptions, newVariantId, knownAxes } from "@/lib/variants.js";
import { findTwins } from "@/lib/duplicate-keys.js";
import { productState, MISSING, missingToSell, missingMessage } from "@/lib/readiness.js";
import PhotoBatchSheet from "./PhotoBatch.js";
import DuplicateSweep from "./DuplicateSweep.js";
import CollectionOverview from "./CollectionOverview.js";
import { useT } from "./i18n.js";
import { useBackClose } from "./back.js";

// The Inventory tab: the shop's catalogue, organised. Products carry a
// category, a brand, tags, a photo gallery and — for things that come in
// sizes/colours — options and variants. Everything is edited in one drawer;
// the list is filtered by category rail, stock, search and sort.
//
// This is the MANUAL tab. It had a chat panel folded into the top of it, and
// the assistant now has a tab of its own — so there is one AI surface in the
// dashboard rather than one per page. Everything here is hand-driven: the
// drawer, the four imports, the filters. The only thing the chat left behind is
// a door to it.

// The assistant lives on its own page; this is how the rest of the dashboard
// asks to be taken there. dashboard-client.js listens for it.
const goAssistant = () => window.dispatchEvent(new CustomEvent("al-goto", { detail: "assistant" }));

const price = (p) => { const n = Number(String(p ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const LOW = 5;
const stockOf = (p) => {
  const q = p.stock_qty;
  if (p.stock_status === "outofstock" || q === 0) return "out";
  if (q !== null && q !== undefined && q !== "" && Number(q) <= LOW) return "low";
  return "in";
};
const catOf = (p) => (p.category || "").trim() || "Uncategorized";
const imgOf = (p) => p.image_url || p.images?.[0] || "";
const galleryOf = (p) => (p.images?.length ? p.images : (p.image_url ? [p.image_url] : []));

function PriceTag({ p, big }) {
  const vs = (p.variants || []).map((v) => price(v.sale_price) || price(v.regular_price)).filter(Boolean);
  const sale = price(p.sale_price), reg = price(p.regular_price);
  const from = vs.length ? Math.min(...vs) : null;
  const main = sale || reg || from;
  if (!main) return <span style={{ color: T.textDim, fontSize: big ? 15 : 13 }}>No price</span>;
  return <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
    {!sale && !reg && from && <span style={{ fontSize: 11, color: T.textDim }}>from</span>}
    <span style={{ fontSize: big ? 18 : 14, fontWeight: 700, color: T.gold }}>{taka(main)}</span>
    {sale && reg && reg > sale && <span style={{ fontSize: big ? 13 : 11.5, color: T.textDim, textDecoration: "line-through" }}>{taka(reg)}</span>}
  </span>;
}
function StockBadge({ p }) {
  const s = stockOf(p);
  const c = s === "out" ? T.danger : s === "low" ? T.warn : T.success;
  const l = s === "out" ? "Out of stock" : s === "low" ? `Low · ${p.stock_qty} left` : (p.stock_qty != null && p.stock_qty !== "" ? `In stock · ${p.stock_qty}` : "In stock");
  return <Badge color={c}>{l}</Badge>;
}
function Thumb({ p, size = 44, radius = 12 }) {
  const u = imgOf(p);
  return <div style={{ width: size, height: size, borderRadius: radius, background: T.bgAlt, boxShadow: T.nmIn, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
    {u ? <img src={u} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="ti ti-photo" style={{ fontSize: size * 0.42, color: T.textDim }} />}
  </div>;
}

export default function Inventory({ products, refresh, intent, onIntentDone }) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [stock, setStock] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("grid");
  const [sel, setSel] = useState(() => new Set());
  const [editor, setEditor] = useState(null);      // null | {mode:"add"} | {mode:"edit", p}
  const [importer, setImporter] = useState(null);  // null | "url" | "woo"
  const [toast, setToast] = useState("");
  // Bumped to ask the assistant to start an interview. A counter rather than a
  // boolean, so pressing the button a second time starts a second product
  // instead of doing nothing.
  const t = useT();
  const [sweep, setSweep] = useState(false);
  // What the chat already asked for — the kind, the price, the sizes — handed
  // to the photo sheet so the same three questions are not asked twice.
  const [prefill, setPrefill] = useState(null);
  const [busyBulk, setBusyBulk] = useState(false);
  // A warning has to be readable, not glimpsed: "the photo could not be
  // analysed" is a sentence the owner has to act on, and 3.2s is not enough
  // time to read it, understand it and decide. Plain confirmations keep the
  // short life they had.
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), toast.warn ? 9000 : 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { try { const v = localStorage.getItem("al-inv-view"); if (v === "grid" || v === "list") setView(v); } catch {} }, []);
  const pickView = (v) => { setView(v); try { localStorage.setItem("al-inv-view", v); } catch {} };

  const cats = useMemo(() => {
    const m = new Map();
    for (const p of products) { const c = catOf(p); m.set(c, (m.get(c) || 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0] === "Uncategorized" ? 1 : b[0] === "Uncategorized" ? -1 : a[0].localeCompare(b[0]));
  }, [products]);
  const catNames = cats.map(([c]) => c).filter((c) => c !== "Uncategorized");
  // What this shop already sells choices along — Size and Colour for clothes,
  // Capacity and Model for phones, Weight and Flavour for food. Read from their
  // own products rather than assumed, so nothing here is a clothing shop's
  // answer imposed on everyone else.
  const shopAxes = useMemo(() => knownAxes(products), [products]);

  // Everything that opens ON TOP of this tab answers the phone's back button
  // before the tab does, innermost first. A half-typed product must not be
  // thrown away because the owner pressed back expecting to close the drawer.
  useBackClose(!!editor, () => setEditor(null));
  useBackClose(!!importer, () => { setImporter(null); setPrefill(null); });
  useBackClose(sweep, () => setSweep(false));

  // The assistant sent the owner here to do something specific — open the CSV
  // sheet, start a photo batch with the answers it already collected. Keyed on
  // `at`, a timestamp, so asking for the same sheet twice in a row opens it
  // twice rather than being swallowed as "no change".
  useEffect(() => {
    if (!intent?.at) return;
    if (intent.importer) { setPrefill(intent.prefill || null); setImporter(intent.importer); }
    if (intent.add) setEditor({ mode: "add" });
    // Consume it. The intent is a ONE-SHOT request from the assistant; the page
    // remounts on every tab switch (key={page} in the shell), so an intent left
    // set would re-open its importer each time the owner came back to Inventory —
    // which is how a stale "photos" intent popped the batch sheet open on its own.
    onIntentDone?.();
  }, [intent?.at]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let l = products.filter((p) => {
      if (cat !== "all" && catOf(p) !== cat) return false;
      const s = stockOf(p);
      if (stock === "instock" && s === "out") return false;
      if (stock === "outofstock" && s !== "out") return false;
      if (stock === "low" && s !== "low") return false;
      // Not a stock state at all — it shares the filter because it answers the
      // same shape of question: which of these can the bot actually sell?
      if (stock === "notready" && productState(p).state === "ready") return false;
      if (!q) return true;
      const hay = [p.product_name, p.product_code, p.category, p.brand, p.description, ...(p.tags || []), ...(p.variants || []).map((v) => `${v.name} ${v.sku}`)].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const pv = (p) => price(p.sale_price) || price(p.regular_price) || 0;
    if (sort === "name") l = [...l].sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""));
    else if (sort === "price-asc") l = [...l].sort((a, b) => pv(a) - pv(b));
    else if (sort === "price-desc") l = [...l].sort((a, b) => pv(b) - pv(a));
    else if (sort === "stock") l = [...l].sort((a, b) => ({ out: 0, low: 1, in: 2 })[stockOf(a)] - ({ out: 0, low: 1, in: 2 })[stockOf(b)]);
    return l;
  }, [products, search, cat, stock, sort]);

  const stats = useMemo(() => ({
    total: products.length, cats: catNames.length,
    out: products.filter((p) => stockOf(p) === "out").length,
    low: products.filter((p) => stockOf(p) === "low").length,
    variants: products.reduce((n, p) => n + (p.variants?.length || 0), 0),
  }), [products, catNames.length]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisible = list.length > 0 && list.every((p) => sel.has(p.id));
  const bulkDelete = async () => {
    if (!sel.size || busyBulk) return;
    if (!confirm(`Delete ${sel.size} product${sel.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBusyBulk(true);
    const r = await apiJson("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel] }) });
    setBusyBulk(false);
    if (r.error) { setToast("Delete failed: " + r.error); return; }
    setToast(`Deleted ${sel.size} product${sel.size > 1 ? "s" : ""}`); setSel(new Set()); refresh();
  };
  const bulkStock = async (status) => {
    if (!sel.size || busyBulk) return;
    setBusyBulk(true);
    for (const id of sel) { const fd = new FormData(); fd.append("id", id); fd.append("stock_status", status); await api("/api/products", { method: "PATCH", body: fd }).catch(() => {}); }
    setBusyBulk(false); setToast(`Marked ${sel.size} as ${status === "instock" ? "in stock" : "out of stock"}`); setSel(new Set()); refresh();
  };
  const del = async (p) => {
    if (!confirm(`Delete "${p.product_name || "this product"}"?`)) return;
    const r = await apiJson("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
    if (r.error) { setToast("Delete failed: " + r.error); return; }
    setToast("Product deleted"); refresh();
  };

  // Every product the bot cannot fully answer for, and why. Older products —
  // imported before the rule, or saved without a photo — are the ones this
  // finds; anything added from now on already has all three.
  const notReady = useMemo(() => products.map((p) => ({ p, ...productState(p) })).filter((x) => x.state !== "ready"), [products]);

  const stockItems = [{ value: "all", label: "All" }, { value: "instock", label: "In stock" }, { value: "low", label: "Low", badge: stats.low || undefined }, { value: "outofstock", label: "Out", badge: stats.out || undefined },
    ...(notReady.length ? [{ value: "notready", label: "Not ready", badge: notReady.length }] : [])];
  const catItems = [{ value: "all", label: "All products", icon: "ti-layout-grid", badge: products.length }, ...cats.map(([c, n]) => ({ value: c, label: c, icon: c === "Uncategorized" ? "ti-folder-question" : "ti-folder", badge: n }))];
  const wide = !isMobile;

  const empty = products.length === 0;
  // Twins already in the catalogue. Worked out from the products the tab is
  // already holding, so noticing them costs no request — and the bot is being
  // confused by them right now, whether or not anyone goes looking.
  const twins = useMemo(() => findTwins(products), [products]);

  return <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
    {/* Stats strip — the shape of the catalogue at a glance. */}
    {!empty && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {[["ti-package", "Products", stats.total, T.gold], ["ti-folders", "Categories", stats.cats, T.purple], ["ti-versions", "Variants", stats.variants, T.info],
        ["ti-alert-triangle", "Low stock", stats.low, T.warn], ["ti-circle-x", "Out of stock", stats.out, T.danger]].map(([ic, l, v, c]) =>
        <Card key={l} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11, cursor: l === "Low stock" || l === "Out of stock" ? "pointer" : "default" }}
          onClick={() => { if (l === "Low stock") setStock("low"); if (l === "Out of stock") setStock("outofstock"); }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${c} 11%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${ic}`} style={{ fontSize: 17, color: c }} /></div>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{v}</div><div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: .7, whiteSpace: "nowrap" }}>{l}</div></div>
        </Card>)}
    </div>}

    {/* Toolbar */}
    <Card style={{ padding: isMobile ? "10px 10px" : "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
        <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textDim, fontSize: 16 }} />
        <input placeholder="Search name, code, tag, brand…" value={search} onChange={(e) => setSearch(e.target.value)} className="ui-inp"
          style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px 10px 36px", color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        {search && <button onClick={() => setSearch("")} aria-label="Clear" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 15, minHeight: 0, padding: 4 }}><i className="ti ti-x" /></button>}
      </div>
      <Segmented size="sm" value={stock} onChange={setStock} items={stockItems} />
      <Select value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first", icon: "ti-clock" }, { value: "name", label: "Name A–Z", icon: "ti-sort-ascending-letters" }, { value: "price-asc", label: "Price low → high", icon: "ti-arrow-up" }, { value: "price-desc", label: "Price high → low", icon: "ti-arrow-down" }, { value: "stock", label: "Stock issues first", icon: "ti-alert-triangle" }]} />
      <div style={{ display: "flex", gap: 4, background: T.bgAlt, boxShadow: T.nmIn, borderRadius: 11, padding: 3 }}>
        {/* ui-sq, and no minHeight:0 — these opted out of the 44px touch floor
            and came out 34x34 on a phone, smaller than every other icon button
            in the dashboard. On a mouse they stay 34. */}
        {[["grid", "ti-layout-grid"], ["list", "ti-list"]].map(([v, ic]) => <button key={v} onClick={() => pickView(v)} aria-label={v} aria-pressed={view === v} className="ui-btn ui-sq"
          style={{ width: 34, height: 34, borderRadius: 9, border: "none", cursor: "pointer", background: view === v ? T.accGrad : "transparent", color: view === v ? T.onGold : T.textMuted, boxShadow: view === v ? T.accGlow : "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${ic}`} style={{ fontSize: 16 }} /></button>)}
      </div>
      {/* Four buttons no longer fit a phone on one line — without wrapping, the
          last one hangs off the right edge and takes the whole page with it. */}
      <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
        {/* Straight to Bot Training → Offers, so bundling products into a deal
            is one click from where the products live. */}
        <Btn onClick={() => { try { sessionStorage.setItem("al-bt-tab", "offers"); } catch {} window.dispatchEvent(new CustomEvent("al-goto", { detail: "settings" })); }} style={{ padding: "9px 14px", borderRadius: 12, whiteSpace: "nowrap" }}><i className="ti ti-discount-2" style={{ marginRight: 6 }} />{t("inv.offers")}</Btn>
        {/* This tab is the manual one now. The ways to add products are grouped
            so the menu reads as a decision, not a flat list: add by hand (one
            product with its sizes/colours, or many from photos), or import an
            existing shop. Each carries a plain-language second line, and every
            label goes through the translator so it flips with the language. */}
        <Select value="" placeholder={t("inv.add.placeholder")} options={[
          { header: true, label: t("inv.add.grp.byhand") },
          { value: "add", label: t("inv.add.single"), desc: t("inv.add.single.desc"), icon: "ti-box" },
          { value: "photos", label: t("inv.add.many"), desc: t("inv.add.many.desc"), icon: "ti-photo-plus" },
          { header: true, label: t("inv.add.grp.import") },
          { value: "url", label: t("inv.add.url"), desc: t("inv.add.url.desc"), icon: "ti-link" },
          { value: "csv", label: t("inv.add.csv"), desc: t("inv.add.csv.desc"), icon: "ti-table" },
          { value: "woo", label: t("inv.add.woo"), desc: t("inv.add.woo.desc"), icon: "ti-brand-wordpress" },
          { value: "shopify", label: t("inv.add.shopify"), desc: t("inv.add.shopify.desc"), icon: "ti-brand-shopee" },
        ]} onChange={(v) => (v === "add" ? setEditor({ mode: "add" }) : setImporter(v))} />
        {/* The chat is one tab away, not on this page. A door to it, not a
            second copy of it: two panels that both add products are two things
            to keep in step, and the owner asked for one. */}
        <Btn gold onClick={goAssistant} style={{ padding: "9px 16px", borderRadius: 12, whiteSpace: "nowrap" }}><i className="ti ti-sparkles" style={{ marginRight: 6 }} />{t("nav.assistant")}</Btn>
      </div>
    </Card>

    {/* Said plainly, above everything else, because the owner cannot see this
        from the outside: the bot is already answering some questions from the
        wrong row. Not dismissible — it goes away when it is fixed. */}
    {twins.length > 0 && <Card style={{ padding: "12px 14px", marginBottom: 14, background: T.warnBg, border: `1px solid color-mix(in srgb, ${T.warn} 35%, transparent)`, display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
      <i className="ti ti-copy" style={{ fontSize: 20, color: T.warn, flexShrink: 0 }} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.warn }}>
          {twins.length} product{twins.length > 1 ? "s appear" : " appears"} more than once
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>
          The bot cannot tell the copies apart, so a customer asking about {twins.length > 1 ? "one of them" : "it"} may be quoted the wrong price or stock.
        </div>
      </div>
      <Btn onClick={() => setSweep(true)} style={{ borderRadius: 12, background: T.card, color: T.warn, whiteSpace: "nowrap" }}>Review them</Btn>
    </Card>}

    {/* The owner cannot see this from the outside either: these products are in
        the catalogue but the bot cannot fully answer for them. Anything added
        from now on has all three; this is what came before the rule. */}
    {notReady.length > 0 && <Card style={{ padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
      <i className="ti ti-alert-circle" style={{ fontSize: 20, color: T.textMuted, flexShrink: 0 }} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {notReady.length} product{notReady.length > 1 ? "s are" : " is"} not ready to sell
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>
          {(() => {
            const tally = {};
            for (const x of notReady) for (const k of (x.missing.length ? x.missing : ["unreadable"])) tally[k] = (tally[k] || 0) + 1;
            const parts = Object.entries(tally).map(([k, n]) => k === "unreadable"
              ? `${n} whose photo could not be read, so ${n > 1 ? "they cannot" : "it cannot"} be found by picture`
              : `${n} without ${MISSING[k]?.label || k}`);
            return `${parts.join(", ")}. Open one to fix it.`;
          })()}
        </div>
      </div>
      <Btn onClick={() => setStock("notready")} style={{ borderRadius: 12, whiteSpace: "nowrap" }}>Show them</Btn>
    </Card>}

    {/* Body: category rail + products */}
    {empty
      ? <Card style={{ padding: "clamp(24px,5vw,44px) 20px", textAlign: "center" }}>
          <div style={{ width: 66, height: 66, borderRadius: 20, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><i className="ti ti-package" style={{ fontSize: 30, color: T.gold }} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Your catalogue is empty</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, maxWidth: 440, margin: "6px auto 22px", lineHeight: 1.6 }}>Add products with photos, prices, categories and sizes or colours. The bot shows them to customers, matches photos and takes orders.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, maxWidth: 640, margin: "0 auto" }}>
            {/* `label`, not `t` — `t` is the translator in this component now,
                and a map variable that shadows it is exactly the shadow that
                bites later. */}
            {[["ti-sparkles", t("nav.assistant"), "Answer a few questions and it fills the form in", goAssistant], ["ti-plus", "Add a product", "Name, photos, price, variants", () => setEditor({ mode: "add" })], ["ti-photo-plus", "Add many from photos", "One photo becomes one product", () => setImporter("photos")], ["ti-table", "Upload a spreadsheet", "A CSV from Excel or Google Sheets", () => setImporter("csv")], ["ti-link", "Paste a product URL", "We fetch name, photo and price", () => setImporter("url")], ["ti-brand-wordpress", "Import WooCommerce", "Bring your whole shop over", () => setImporter("woo")]].map(([ic, label, s, fn]) =>
              <button key={label} type="button" onClick={fn} className="ui-btn ob-row" style={{ padding: "16px 14px", borderRadius: 16, background: T.card, boxShadow: T.nmSm, border: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: T.text }}>
                <i className={`ti ${ic}`} style={{ fontSize: 22, color: T.gold }} /><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>{label}</div><div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{s}</div>
              </button>)}
          </div>
        </Card>
      : <div style={{ display: "grid", gridTemplateColumns: wide ? "220px minmax(0,1fr)" : "minmax(0,1fr)", gap: 14, alignItems: "start", minWidth: 0 }}>
          {wide
            ? <Card style={{ padding: 10, position: "sticky", top: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: T.textDim, padding: "6px 12px 8px" }}>Categories</div>
                <Segmented vertical value={cat} onChange={setCat} items={catItems} />
              </Card>
            : <div style={{ overflowX: "auto", margin: "0 -2px", padding: "2px", WebkitOverflowScrolling: "touch" }}>
                <Segmented size="sm" value={cat} onChange={setCat} items={catItems} style={{ flexWrap: "nowrap", width: "max-content" }} />
              </div>}

          <div style={{ minWidth: 0 }}>
            {/* The overview belongs to a category, so it lives under the one the
                owner has selected — pick "Powerbank" and set Powerbank's overview
                right there. On "All products" it's a quiet prompt to pick one. */}
            <div style={{ marginBottom: 12 }}>
              <CollectionOverview selectedCat={cat} catNames={catNames} onGotoCategory={setCat} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 12.5, color: T.textMuted, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" checked={allVisible} onChange={() => setSel(allVisible ? new Set() : new Set(list.map((p) => p.id)))} style={{ accentColor: T.gold, width: 15, height: 15 }} />
                {list.length} {list.length === 1 ? "product" : "products"}{cat !== "all" ? ` in ${cat}` : ""}
              </label>
              {sel.size > 0 && <span style={{ color: T.gold, fontWeight: 600 }}>{sel.size} selected</span>}
            </div>

            {list.length === 0
              ? <Card style={{ padding: 36, textAlign: "center", color: T.textDim }}><i className="ti ti-search-off" style={{ fontSize: 26, display: "block", marginBottom: 8 }} />No products match. <span onClick={() => { setSearch(""); setStock("all"); setCat("all"); }} style={{ color: T.gold, cursor: "pointer", fontWeight: 600 }}>Clear filters</span></Card>
              : view === "grid"
                ? <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 196}px, 1fr))`, gap: isMobile ? 10 : 14 }}>
                    {list.map((p) => <ProductCard key={p.id} p={p} on={sel.has(p.id)} toggle={() => toggle(p.id)} open={() => setEditor({ mode: "edit", p })} isMobile={isMobile} />)}
                  </div>
                : <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["", "Product", "Category", "Price", "Stock", "Variants", ""].map((h, i) => <th key={i} style={{ padding: "11px 14px", textAlign: "left", color: T.textMuted, fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: .8, width: i === 0 ? 36 : undefined }}>{h}</th>)}
                      </tr></thead>
                      <tbody>{list.map((p) => <tr key={p.id} className="ui-row" onClick={() => setEditor({ mode: "edit", p })} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                        <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: T.gold, width: 15, height: 15 }} /></td>
                        <td style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}><Thumb p={p} size={40} radius={10} /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{p.product_name || "Unnamed"}</div><div style={{ fontSize: 11.5, color: T.textDim, fontFamily: "monospace" }}>{p.product_code || "—"}{p.brand ? ` · ${p.brand}` : ""}</div></div></div></td>
                        <td style={{ padding: "10px 14px" }}><Badge color={T.purple}>{catOf(p)}</Badge></td>
                        <td style={{ padding: "10px 14px" }}><PriceTag p={p} /></td>
                        <td style={{ padding: "10px 14px" }}><StockBadge p={p} /></td>
                        <td style={{ padding: "10px 14px", color: T.textMuted }}>{p.variants?.length ? `${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}` : "—"}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditor({ mode: "edit", p })} className="ui-btn" title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: T.gold, fontSize: 17, minHeight: 0, padding: 6 }}><i className="ti ti-pencil" /></button>
                          <button onClick={() => del(p)} className="ui-btn" title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, fontSize: 17, minHeight: 0, padding: 6 }}><i className="ti ti-trash" /></button>
                        </td>
                      </tr>)}</tbody>
                    </table></div>
                  </Card>}
          </div>
        </div>}

    {/* Bulk action bar */}
    {sel.size > 0 && <div style={{ position: "fixed", left: "50%", bottom: `calc(18px + env(safe-area-inset-bottom))`, transform: "translateX(-50%)", zIndex: 70, background: T.card, boxShadow: T.nmOut, border: `1px solid ${T.border}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, maxWidth: "calc(100vw - 20px)", flexWrap: "wrap", justifyContent: "center" }} className="ui-page">
      <span style={{ fontSize: 12.5, fontWeight: 600, padding: "0 6px" }}>{sel.size} selected</span>
      <Btn small onClick={() => bulkStock("instock")} disabled={busyBulk}><i className="ti ti-check" style={{ marginRight: 5 }} />In stock</Btn>
      <Btn small onClick={() => bulkStock("outofstock")} disabled={busyBulk}><i className="ti ti-circle-x" style={{ marginRight: 5 }} />Out of stock</Btn>
      <Btn small danger onClick={bulkDelete} disabled={busyBulk}><i className="ti ti-trash" style={{ marginRight: 5 }} />Delete</Btn>
      <button onClick={() => setSel(new Set())} aria-label="Clear selection" className="ui-btn" style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 16, padding: "0 6px", minHeight: 0 }}><i className="ti ti-x" /></button>
    </div>}

    {/* A toast is either a plain string (a confirmation) or { text, warn } —
        the object form is used when something worked but not completely, and
        it has to look different from a tick, not just say different words. */}
    {toast && <div style={{ position: "fixed", left: "50%", top: 14, transform: "translateX(-50%)", zIndex: 90,
      background: toast.warn ? T.warnBg : T.text, color: toast.warn ? T.warn : T.bg,
      border: toast.warn ? `1px solid ${T.warn}` : "none",
      borderRadius: 12, padding: "9px 14px", fontSize: 13, fontWeight: 500, boxShadow: T.nmOut,
      maxWidth: "min(520px, calc(100vw - 24px))", lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }} className="ui-page">
      {toast.warn && <i className="ti ti-alert-triangle" style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />}
      <span>{toast.text || toast}</span>
    </div>}

    {editor && <ProductEditor key={editor.p?.id || "new"} mode={editor.mode} p={editor.p} categories={catNames} isMobile={isMobile}
      onClose={() => setEditor(null)}
      onSaved={(msg) => { setEditor(null); setToast(msg); refresh(); }}
      onDelete={async () => { const p = editor.p; setEditor(null); await del(p); }} />}

    {/* "photos" is a different shape of job from the other three — many
        products out of many files, rather than many products out of one
        source — so it gets its own sheet rather than a fourth branch inside
        ImportSheet. */}
    {sweep && twins.length > 0 && <DuplicateSweep groups={twins} isMobile={isMobile}
      onClose={() => setSweep(false)} onDone={(msg) => { setToast(msg); refresh(); }} />}

    {importer === "photos"
      ? <PhotoBatchSheet isMobile={isMobile} categories={catNames} shopAxes={shopAxes} prefill={prefill} onClose={() => { setImporter(null); setPrefill(null); }} onDone={(msg) => { setToast(msg); refresh(); }} />
      : importer && <ImportSheet kind={importer} isMobile={isMobile} onClose={() => setImporter(null)} onDone={(msg) => { setToast(msg); refresh(); }} />}
  </div>;
}

function ProductCard({ p, on, toggle, open, isMobile }) {
  const u = imgOf(p);
  const nv = p.variants?.length || 0;
  const s = stockOf(p);
  return <div className="ui-card inv-card" onClick={open} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
    style={{ background: T.card, borderRadius: 18, border: `1px solid ${on ? T.gold : T.border}`, boxShadow: on ? T.accGlow : T.nmSm, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
    <div style={{ position: "relative", aspectRatio: "1", background: T.bgAlt, overflow: "hidden" }}>
      {u ? <img src={u} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .35s cubic-bezier(.16,1,.3,1)" }} className="inv-img" />
        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim }}><i className="ti ti-photo" style={{ fontSize: 34 }} /></div>}
      <label onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 8, left: 8, width: 26, height: 26, borderRadius: 8, background: on ? T.accGrad : "rgba(255,255,255,.85)", boxShadow: "0 2px 8px rgba(0,0,0,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} className={on ? "" : "inv-check"}>
        <input type="checkbox" checked={on} onChange={toggle} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} aria-label="Select" />
        {on ? <i className="ti ti-check" style={{ color: "#fff", fontSize: 15 }} /> : <span style={{ width: 12, height: 12, borderRadius: 4, border: "1.5px solid #8A91A3" }} />}
      </label>
      {nv > 0 && <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(25,28,36,.72)", color: "#fff", fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 999, backdropFilter: "blur(6px)" }}><i className="ti ti-versions" style={{ fontSize: 11, marginRight: 4 }} />{nv}</span>}
      {s !== "in" && <span style={{ position: "absolute", bottom: 8, left: 8, background: s === "out" ? T.danger : T.warn, color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>{s === "out" ? "Out of stock" : "Low stock"}</span>}
    </div>
    <div style={{ padding: isMobile ? "10px 11px 11px" : "12px 13px 13px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 35 }}>{p.product_name || "Unnamed"}</div>
      <div style={{ fontSize: 11, color: T.textDim, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product_code || "—"}{p.brand ? ` · ${p.brand}` : ""}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
        <PriceTag p={p} />
        <Badge color={T.purple}>{catOf(p)}</Badge>
      </div>
    </div>
    <span className="inv-edit" style={{ position: "absolute", right: 10, bottom: 10, width: 30, height: 30, borderRadius: 10, background: T.accGrad, color: T.onGold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: T.accGlow, opacity: 0, transition: "opacity .18s ease-out" }}><i className="ti ti-pencil" style={{ fontSize: 14 }} /></span>
    <style dangerouslySetInnerHTML={{__html:`
      @media (hover:hover) and (pointer:fine) {
        .inv-card:hover .inv-img { transform: scale(1.04) }
        .inv-card:hover .inv-edit { opacity: 1 }
        .inv-card .inv-check { opacity: 0; transition: opacity .15s }
        .inv-card:hover .inv-check { opacity: 1 }
      }
    `}}/>
  </div>;
}

// ── Editor drawer ────────────────────────────────────────────────────────────
// Photo, name, SKU, price, sale, qty, status, remove.
const VAR_COLS = "44px minmax(0,1.5fr) minmax(0,1fr) 84px 84px 70px 92px 30px";

function ProductEditor({ mode, p, categories, isMobile, onClose, onSaved, onDelete }) {
  const edit = mode === "edit";
  const [f, setF] = useState(() => ({
    product_name: p?.product_name || "", product_code: p?.product_code || "", category: p?.category || "", brand: p?.brand || "",
    tags: (p?.tags || []).join(", "), regular_price: p?.regular_price || "", sale_price: p?.sale_price || "",
    stock_status: p?.stock_status === "outofstock" ? "outofstock" : "instock", stock_qty: p?.stock_qty ?? "", description: p?.description || "",
    options: (p?.options || []).map((o) => ({ name: o.name, values: [...(o.values || [])] })),
    variants: (p?.variants || []).map((v) => ({ ...v, attrs: { ...(v.attrs || {}) } })),
  }));
  // One ordered gallery: saved/pasted URLs and new files side by side, so a
  // new photo can be dragged to the front and saved as primary in one go.
  const [gallery, setGallery] = useState(() => galleryOf(p || {}).map((u) => ({ kind: "url", u })));
  // A photo chosen for one variant, before it has been uploaded: keyed by the
  // variant's id so reordering or renaming cannot detach it from its row.
  // Kept out of f.variants because a File cannot survive JSON.stringify, and
  // the variants list is sent as JSON.
  const [varImg, setVarImg] = useState({});
  const varFileRef = useRef(null);
  const varTarget = useRef(null);
  const [urlIn, setUrlIn] = useState("");
  const [busy, setBusy] = useState(false);
  // True while photos are being resized. Resizing several large pictures takes
  // a moment on a phone, and without a sign the drawer just looks frozen.
  const [prepping, setPrepping] = useState(false);
  const [err, setErr] = useState("");
  // The product the server says this looks like. Set only after a refusal, so
  // "Add anyway" cannot be pressed before the warning has been read.
  const [dup, setDup] = useState(null);
  const [tab, setTab] = useState("details");
  const fileRef = useRef(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, []);
  useEffect(() => () => gallery.forEach((g) => g.kind === "file" && URL.revokeObjectURL(g.u)), []);
  useEffect(() => () => Object.values(varImg).forEach((x) => x?.u && URL.revokeObjectURL(x.u)), []);

  // Photos are shrunk BEFORE they enter the gallery, so the picture previewed
  // here is byte-for-byte the one that gets uploaded. A phone camera writes
  // 2–5 MB per shot and Vercel refuses any request over ~4.5 MB at the edge,
  // which is what made "Add product" fail with nothing but the word "network".
  const addFiles = async (list) => {
    const arr = [...list].filter((x) => x.type.startsWith("image/")).slice(0, 8);
    if (!arr.length) return;
    setPrepping(true);
    // What the gallery already carries, so twelve photos added one at a time
    // cannot creep past the budget the way a per-batch check would.
    const keep = gallery.reduce((a, g) => a + (g.kind === "file" ? g.file.size : 0), 0);
    const ready = await shrinkBatch(arr, keep);
    setPrepping(false);
    setGallery((s) => [...s, ...ready.map((file) => ({ kind: "file", file, u: URL.createObjectURL(file) }))].slice(0, 12));
  };
  // One hidden input serves every variant row; varTarget remembers which row
  // asked, so twenty variants do not need twenty file inputs in the DOM.
  const pickVarImg = (id) => { varTarget.current = id; varFileRef.current?.click(); };
  const takeVarImg = async (file) => {
    const id = varTarget.current;
    if (!id || !file) return;
    setPrepping(true);
    const keep = gallery.reduce((a, g) => a + (g.kind === "file" ? g.file.size : 0), 0)
      + Object.values(varImg).reduce((a, x) => a + (x?.file?.size || 0), 0);
    const [small] = await shrinkBatch([file], keep);
    setPrepping(false);
    setVarImg((s) => {
      // Release the preview this replaces, or the tab leaks a blob per retake.
      if (s[id]?.u) URL.revokeObjectURL(s[id].u);
      return { ...s, [id]: { file: small, u: URL.createObjectURL(small) } };
    });
  };

  const makePrimary = (g) => setGallery((s) => [g, ...s.filter((x) => x !== g)]);
  const removeImg = (g) => setGallery((s) => s.filter((x) => x !== g));
  const addUrl = () => { const u = urlIn.trim(); if (!/^https?:\/\//.test(u)) { setErr("Paste a full image link starting with http"); return; } setGallery((s) => [...s, { kind: "url", u }].slice(0, 12)); setUrlIn(""); setErr(""); };

  // Options → variants
  const setOpt = (i, patch) => set("options", f.options.map((o, j) => j === i ? { ...o, ...patch } : o));
  const addOptValue = (i, raw) => { const vals = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean); if (!vals.length) return; setOpt(i, { values: [...new Set([...f.options[i].values, ...vals])] }); };
  const generate = () => {
    if (!usableOptions(f.options).length) { setErr("Add an option (e.g. Size) with some values first"); return; }
    set("variants", buildVariants(f.options, f, f.variants)); setErr("");
  };
  const setVar = (i, patch) => set("variants", f.variants.map((v, j) => j === i ? { ...v, ...patch } : v));
  const addVariant = () => set("variants", [...f.variants, { id: newVariantId(), name: "", sku: "", attrs: {}, regular_price: f.regular_price, sale_price: f.sale_price, stock_qty: "", stock_status: "instock", image_url: "" }]);
  const applyPriceAll = () => set("variants", f.variants.map((v) => ({ ...v, regular_price: f.regular_price, sale_price: f.sale_price })));

  // `force` is the owner having read that this looks like something they
  // already have, and saying they meant it.
  const save = async (force = false) => {
    if (!f.product_name.trim()) { setErr("Product name is required"); setTab("details"); return; }
    // The same three things the server insists on when a product is CREATED,
    // asked for here first so the answer is instant instead of a round trip.
    // Only on add: editing is how an older incomplete product gets fixed, and
    // refusing that save would trap it.
    if (!edit) {
      const short = missingToSell({ product_name: f.product_name, regular_price: f.regular_price, sale_price: f.sale_price, image_url: gallery.length ? "x" : "" });
      if (short.length) {
        setErr(missingMessage(short));
        setTab(short.includes("photo") && !short.includes("price") ? "photos" : "details");
        return;
      }
    }
    if (busy) return;
    // Photos the browser could not shrink can never be sent — the platform
    // refuses them before our code runs. Say so, instead of "check your internet".
    const files0 = gallery.filter((g) => g.kind === "file");
    const kept0 = f.variants.filter((v) => (v.name || "").trim() || Object.keys(v.attrs || {}).length || varImg[v.id]?.file || v.image_url);
    const varFiles0 = kept0.filter((v) => varImg[v.id]?.file).map((v) => ({ file: varImg[v.id].file }));
    const big = tooLargePhotos([...files0, ...varFiles0]).length;
    if (big) { setErr(`${big} photo${big > 1 ? "s" : ""} could not be shrunk and ${big > 1 ? "are" : "is"} over ${fileSize(PHOTO_MAX_BYTES)} — too large to send. Remove or re-attach ${big > 1 ? "them" : "it"}.`); setTab("photos"); return; }
    setBusy(true); setErr(""); setDup(null);

    // Every photo but the first gallery file goes up ONE AT A TIME first and
    // becomes a URL, so no request can exceed the platform's ~4.5 MB ceiling
    // however many gallery or variant photos there are. The first gallery file
    // stays as bytes: the server's photo duplicate check hashes it.
    const extraGallery = files0.slice(1).map((g) => ({ file: g.file, g }));
    const variantUps = kept0.filter((v) => varImg[v.id]?.file).map((v) => ({ file: varImg[v.id].file, vid: v.id }));
    const ups = [...extraGallery, ...variantUps];
    let urlOfG = new Map(), urlOfV = new Map();
    if (ups.length) {
      const up = await uploadPhotos(ups, { from: 0 });
      if (!up.ok) { setBusy(false); setErr(up.error); return; }
      up.photos.forEach((u) => { if (u.g) urlOfG.set(u.g, u.url); else urlOfV.set(u.vid, u.url); });
    }

    const fd = new FormData();
    if (force) fd.append("allow_duplicate", "1");
    if (edit) fd.append("id", p.id);
    for (const k of ["product_name", "product_code", "category", "brand", "tags", "regular_price", "sale_price", "stock_status", "description"]) fd.append(k, f[k] ?? "");
    fd.append("stock_qty", f.stock_qty === "" || f.stock_qty === null ? "" : String(f.stock_qty));
    fd.append("options", JSON.stringify(f.options.filter((o) => o.name.trim() && o.values.length)));

    // Order is the owner's. The first new file is "upload:0"; every other new
    // file is the URL it was just given above.
    const files = files0;
    fd.append("image_urls", JSON.stringify(gallery.map((g) => g.kind === "url" ? g.u : (g === files[0] ? "upload:0" : urlOfG.get(g) || ""))));
    if (files[0]) fd.append("images", files[0].file);

    // Variant photos ride in the SAME `images` list, numbered after the
    // gallery, and each variant points at its own index. The server keeps the
    // claimed ones out of the gallery, so a shirt in twelve colours does not
    // show a customer twelve pictures when they only asked to see the shirt.
    // A row counts as real if it has a name, attributes, OR a photo. Without
    // the photo clause, someone who picked a picture and had not typed the name
    // yet would watch the row — and the photo they just chose — disappear on
    // save, with nothing said.
    // Variant photos were uploaded above; each variant now carries its URL.
    const kept = kept0;
    fd.append("variants", JSON.stringify(kept.map((v) => ({ ...v, image_url: urlOfV.get(v.id) || v.image_url || "" }))));
    const r = await apiJson(edit ? "/api/products" : "/api/add-product", { method: edit ? "PATCH" : "POST", body: fd });
    setBusy(false);
    // A duplicate is not a failure, it is a question. The message names the
    // product it clashes with, and the owner decides.
    if (r.duplicate) { setErr(r.error); setDup(r.duplicate); setTab("details"); return; }
    if (r.error) { setErr(r.error); return; }

    // The server has always sent analyzeError back and the dashboard has always
    // thrown it away, so a product whose photo could not be read still reported
    // "Product added" — a plain success. That is the failure the owner most
    // needs to know about: the photo is what the bot matches a customer's
    // picture against, so without it that product is invisible to a photo
    // search, silently, possibly for months.
    if (r.analyzeError) {
      onSaved({
        warn: true,
        text: `${edit ? "Saved" : "Product added"}, but the photo could not be analysed, so customers cannot find it by sending a picture. Re-save the product to try again. (${String(r.analyzeError).slice(0, 120)})`,
      });
      return;
    }
    onSaved(edit ? "Product updated" : (r.analyzed ? "Product added and photo analysed" : "Product added"));
  };

  const L = ({ children }) => <label style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{children}</label>;
  const H = ({ icon, children, sub }) => <div style={{ margin: "4px 0 12px" }}><div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><i className={`ti ${icon}`} style={{ color: T.gold, fontSize: 16 }} />{children}</div>{sub && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}</div>;
  const chip = (on) => ({ padding: "5px 11px", borderRadius: 999, border: `1px solid ${on ? T.gold : T.border}`, background: on ? T.goldBg : T.card, color: on ? T.gold : T.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 0 });
  const tabs = [{ value: "details", label: "Details", icon: "ti-forms" }, { value: "photos", label: "Photos", icon: "ti-photo", badge: gallery.length || undefined }, { value: "variants", label: "Variants", icon: "ti-versions", badge: f.variants.length || undefined }, { value: "preview", label: "Preview", icon: "ti-eye" }];
  // A linear "wizard": Details → Photos → Variants → Preview → Add. The tabs
  // above still let the owner jump; these drive the Back/Next buttons in the
  // footer and the final Add on the Preview step.
  const STEPS = ["details", "photos", "variants", "preview"];
  const stepIdx = Math.max(0, STEPS.indexOf(tab));
  const goStep = (d) => setTab(STEPS[Math.min(STEPS.length - 1, Math.max(0, stepIdx + d))]);

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, height: "100dvh", zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "flex-end" }}>
    <div onClick={(e) => e.stopPropagation()} className="inv-drawer" role="dialog" aria-modal="true" aria-label={edit ? "Edit product" : "Add product"}
      style={{ width: isMobile ? "100%" : "min(640px, 100%)", height: "100%", background: T.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px rgba(0,0,0,.25)", animation: "inv-slide .28s cubic-bezier(.16,1,.3,1) both" }}>
      <div style={{ padding: isMobile ? "12px 14px" : "16px 22px", display: "flex", alignItems: "center", gap: 12, background: T.card, boxShadow: T.nmSm, flexShrink: 0, position: "relative", zIndex: 1 }}>
        <Thumb p={{ image_url: gallery[0]?.u || "" }} size={40} radius={12} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{edit ? (f.product_name || "Edit product") : "New product"}</div>
          <div style={{ fontSize: 11.5, color: T.textDim }}>{edit ? `Code ${f.product_code || "—"}` : "Fill what you know — everything can be edited later"}</div>
        </div>
        <button onClick={onClose} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>
      <div style={{ padding: isMobile ? "10px 12px 0" : "12px 22px 0", flexShrink: 0 }}>
        <Segmented size="sm" value={tab} onChange={setTab} items={tabs} style={{ background: T.card, boxShadow: T.nmSm, borderRadius: 13, padding: 4 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px 24px" : "18px 22px 30px", minHeight: 0 }}>
        {tab === "details" && <>
          <Card style={{ marginBottom: 14 }}>
            <H icon="ti-tag">Basics</H>
            <Inp emb label="Product name *" value={f.product_name} onChange={(e) => set("product_name", e.target.value)} placeholder="e.g. Cotton panjabi — navy" autoFocus={!isMobile} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <Inp emb label="Product code / SKU" value={f.product_code} onChange={(e) => set("product_code", e.target.value)} placeholder="Auto if empty" />
              <Inp emb label="Brand" value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Optional" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <L>Category</L>
              <input list="inv-cats" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Men › Panjabi" className="ui-inp"
                style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 16px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              <datalist id="inv-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              {categories.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {categories.slice(0, 12).map((c) => <button key={c} type="button" onClick={() => set("category", c)} style={chip(f.category === c)}>{c}</button>)}
              </div>}
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 6 }}>Use "Parent › Child" for sub-categories, e.g. "Women › Sarees".</div>
            </div>
            <Inp emb label="Tags" value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="comma separated — cotton, summer, gift" style={{ marginBottom: 4 }} />
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <H icon="ti-coin-taka">Price & stock</H>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <Inp emb label="Regular price (৳)" inputMode="decimal" value={f.regular_price} onChange={(e) => set("regular_price", e.target.value)} placeholder="0" />
              <Inp emb label="Sale price (৳)" inputMode="decimal" value={f.sale_price} onChange={(e) => set("sale_price", e.target.value)} placeholder="Optional" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "end" }}>
              <div style={{ marginBottom: 16 }}>
                <L>Availability</L>
                <Segmented size="sm" value={f.stock_status} onChange={(v) => set("stock_status", v)} style={{ background: T.bgAlt, boxShadow: T.nmIn, borderRadius: 12, padding: 3 }}
                  items={[{ value: "instock", label: "In stock", icon: "ti-check" }, { value: "outofstock", label: "Out of stock", icon: "ti-circle-x" }]} />
              </div>
              <Inp emb label="Quantity (optional)" inputMode="numeric" value={f.stock_qty} onChange={(e) => set("stock_qty", e.target.value.replace(/[^\d]/g, ""))} placeholder="Leave empty if not tracked" />
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: -6 }}>With a quantity, {LOW} or fewer shows as low stock and 0 as out of stock.</div>
          </Card>

          <Card>
            <H icon="ti-align-left" sub="What the bot uses to answer questions — material, sizes, care, what's in the box.">Description</H>
            <Inp emb textarea value={f.description} onChange={(e) => set("description", e.target.value)} inputStyle={{ minHeight: 120, lineHeight: 1.6 }} placeholder="Describe the product the way you would to a customer" style={{ marginBottom: 0 }} />
          </Card>
        </>}

        {tab === "photos" && <Card>
          <H icon="ti-photo" sub="The first photo is the one the bot sends to customers and matches their photos against.">Photos</H>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10, marginBottom: 14 }}>
            {gallery.map((g, i) => <div key={g.u} style={{ position: "relative", aspectRatio: "1", borderRadius: 14, overflow: "hidden", background: T.bgAlt, boxShadow: i === 0 ? T.accGlow : T.nmSm, border: `2px solid ${i === 0 ? T.gold : "transparent"}` }}>
              <img src={g.u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {i === 0 && <span style={{ position: "absolute", top: 6, left: 6, background: T.accGrad, color: T.onGold, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Primary</span>}
              {g.kind === "file" && <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(25,28,36,.7)", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 999 }}>New</span>}
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                {i !== 0 && <button type="button" title="Make primary" onClick={() => makePrimary(g)} style={{ width: 26, height: 26, minHeight: 0, borderRadius: 8, border: "none", background: "rgba(255,255,255,.9)", color: T.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-star" style={{ fontSize: 14 }} /></button>}
                <button type="button" title="Remove" onClick={() => removeImg(g)} style={{ width: 26, height: 26, minHeight: 0, borderRadius: 8, border: "none", background: "rgba(255,255,255,.9)", color: T.danger, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
              </div>
            </div>)}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={prepping} className="ui-btn ob-row"
              style={{ aspectRatio: "1", borderRadius: 14, border: `1.5px dashed ${T.borderStrong}`, background: T.bgAlt, color: T.textMuted, cursor: prepping ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", fontSize: 12, minHeight: 0, opacity: prepping ? .6 : 1 }}>
              <i className={`ti ${prepping ? "ti-loader-2" : "ti-cloud-upload"}`} style={{ fontSize: 24, color: T.gold }} />{prepping ? "Preparing…" : "Add photos"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Inp emb value={urlIn} onChange={(e) => setUrlIn(e.target.value)} placeholder="…or paste an image link (https://…)" style={{ flex: 1, marginBottom: 0 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} />
            <Btn onClick={addUrl} style={{ borderRadius: 14 }}>Add</Btn>
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>Drag photos onto the grid, or tap Add photos. Up to 12 per product. Large photos are resized here on your phone before uploading, so it stays fast and uses less data.</div>
        </Card>}

        {tab === "variants" && <>
          <Card style={{ marginBottom: 14 }}>
            <H icon="ti-adjustments" sub="Options are the choices a customer makes — Size, Colour, Model. Generate the variants from them, then set each one's price and stock.">Options</H>
            {f.options.map((o, i) => <div key={i} style={{ padding: 12, borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} placeholder="Option name, e.g. Size" list="inv-optnames" className="ui-inp"
                  style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", color: T.text, fontSize: 13.5, outline: "none", fontFamily: "inherit", fontWeight: 600, minWidth: 0 }} />
                <button type="button" onClick={() => set("options", f.options.filter((_, j) => j !== i))} title="Remove option" className="ui-btn" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 17, minHeight: 0, padding: 6 }}><i className="ti ti-trash" /></button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {o.values.map((v) => <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 6px 4px 10px", borderRadius: 999, background: T.card, boxShadow: T.nmSm, fontSize: 12.5, fontWeight: 500 }}>{v}
                  <button type="button" onClick={() => setOpt(i, { values: o.values.filter((x) => x !== v) })} aria-label={`Remove ${v}`} style={{ width: 18, height: 18, minHeight: 0, borderRadius: "50%", border: "none", background: T.bgAlt, color: T.textMuted, cursor: "pointer", fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}><i className="ti ti-x" /></button></span>)}
                <input placeholder={o.values.length ? "Add more…" : "Type a value and press Enter — S, M, L"} className="ui-inp"
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addOptValue(i, e.currentTarget.value); e.currentTarget.value = ""; } }}
                  onBlur={(e) => { if (e.currentTarget.value.trim()) { addOptValue(i, e.currentTarget.value); e.currentTarget.value = ""; } }}
                  style={{ flex: "1 1 160px", minWidth: 120, background: "transparent", border: "none", borderBottom: `1px dashed ${T.borderStrong}`, padding: "6px 4px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              </div>
            </div>)}
            <datalist id="inv-optnames">{["Size", "Colour", "Material", "Model", "Weight", "Pack"].map((n) => <option key={n} value={n} />)}</datalist>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn onClick={() => set("options", [...f.options, { name: "", values: [] }])} disabled={f.options.length >= 5} style={{ borderRadius: 12 }}><i className="ti ti-plus" style={{ marginRight: 5 }} />Add option</Btn>
              <Btn gold onClick={generate} style={{ borderRadius: 12 }}><i className="ti ti-wand" style={{ marginRight: 5 }} />Generate variants</Btn>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <H icon="ti-versions">Variants {f.variants.length ? <span style={{ color: T.textDim, fontWeight: 500 }}>· {f.variants.length}</span> : null}</H>
              {f.variants.length > 0 && <button type="button" onClick={applyPriceAll} className="ui-btn" style={{ background: "none", border: "none", color: T.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 0, padding: 4 }}>Apply product price to all</button>}
            </div>
            {f.variants.length === 0
              ? <div style={{ padding: "22px 12px", textAlign: "center", color: T.textDim, fontSize: 12.5, borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn }}>No variants yet. Add options above and generate, or <span onClick={addVariant} style={{ color: T.gold, cursor: "pointer", fontWeight: 600 }}>add one by hand</span>.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {!isMobile && <div style={{ display: "grid", gridTemplateColumns: VAR_COLS, gap: 8, padding: "0 6px", fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>
                    <span>Photo</span><span>Variant</span><span>SKU</span><span>Price</span><span>Sale</span><span>Qty</span><span>Status</span><span /></div>}
                  {f.variants.map((v, i) => {
                    const cell = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 0, width: "100%", boxSizing: "border-box" };
                    const out = v.stock_status === "outofstock" || v.stock_qty === 0 || v.stock_qty === "0";
                    const shot = varImg[v.id]?.u || (/^https?:\/\//.test(v.image_url || "") ? v.image_url : "");
                    return <div key={v.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : VAR_COLS, gap: 8, alignItems: "center", padding: isMobile ? 10 : "6px 6px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, opacity: out ? .75 : 1 }}>
                      {/* The picture the bot sends once a customer picks THIS
                          option — the red one when they ask for red. Without it
                          every variant of a product looked the same in chat.
                          On a phone the photo sits beside the name on its own
                          full-width row; on desktop "display: contents" drops
                          both straight into the outer grid as two columns. */}
                      <div style={isMobile
                        ? { gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }
                        : { display: "contents" }}>
                      <button type="button" onClick={() => pickVarImg(v.id)} disabled={prepping}
                        title={shot ? "Change this variant's photo" : "Add a photo for this variant"}
                        aria-label={shot ? `Change photo for ${v.name || "variant"}` : `Add photo for ${v.name || "variant"}`}
                        className="ui-btn" style={{ width: 44, height: 44, minHeight: 0, flexShrink: 0, padding: 0, borderRadius: 10, overflow: "hidden",
                          border: shot ? `1px solid ${T.border}` : `1.5px dashed ${T.borderStrong}`, background: shot ? T.card : "transparent",
                          color: T.textMuted, cursor: prepping ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {shot
                          ? <img src={shot} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <i className="ti ti-camera-plus" style={{ fontSize: 17 }} />}
                      </button>
                      <input value={v.name} onChange={(e) => setVar(i, { name: e.target.value })} placeholder="Name (e.g. M / Red)" className="ui-inp" style={{ ...cell, fontWeight: 600 }} />
                      </div>
                      <input value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} placeholder="SKU" className="ui-inp" style={cell} />
                      <input value={v.regular_price} onChange={(e) => setVar(i, { regular_price: e.target.value })} placeholder="Price" inputMode="decimal" className="ui-inp" style={cell} />
                      <input value={v.sale_price} onChange={(e) => setVar(i, { sale_price: e.target.value })} placeholder="Sale" inputMode="decimal" className="ui-inp" style={cell} />
                      <input value={v.stock_qty ?? ""} onChange={(e) => setVar(i, { stock_qty: e.target.value.replace(/[^\d]/g, "") })} placeholder="Qty" inputMode="numeric" className="ui-inp" style={cell} />
                      <button type="button" onClick={() => setVar(i, { stock_status: out ? "instock" : "outofstock", stock_qty: out && (v.stock_qty === 0 || v.stock_qty === "0") ? "" : v.stock_qty })} className="ui-btn"
                        style={{ ...cell, cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: out ? T.danger : T.success, background: `color-mix(in srgb, ${out ? T.danger : T.success} 9%, transparent)`, border: "none", minHeight: 0, whiteSpace: "nowrap" }}>{out ? "Out" : "In stock"}</button>
                      <button type="button" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))} aria-label="Remove variant" className="ui-btn" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 16, minHeight: 0, padding: 4, justifySelf: isMobile ? "end" : "center" }}><i className="ti ti-trash" /></button>
                    </div>;
                  })}
                  <input ref={varFileRef} type="file" accept="image/*" hidden
                    onChange={(e) => { takeVarImg(e.target.files?.[0]); e.target.value = ""; }} />
                  <div style={{ fontSize: 11, color: T.textDim }}>Give a variant its own photo and the bot sends that one once the customer picks it — the red shirt when they ask for red.</div>
                  <Btn small onClick={addVariant} style={{ alignSelf: "flex-start", borderRadius: 10 }}><i className="ti ti-plus" style={{ marginRight: 5 }} />Add variant</Btn>
                </div>}
          </Card>
        </>}

        {tab === "preview" && <Card>
          <H icon="ti-eye" sub="This is how the bot presents the product in chat. The first photo is sent first; each variant's own photo is sent when the customer picks that option.">Preview</H>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 128, height: 128, borderRadius: 14, overflow: "hidden", background: T.bgAlt, boxShadow: T.nmSm, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {gallery[0]?.u ? <img src={gallery[0].u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="ti ti-photo" style={{ fontSize: 30, color: T.textDim }} />}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{f.product_name || <span style={{ color: T.textDim }}>No name yet</span>}</div>
              {f.product_code && <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace", marginTop: 2 }}>Code: {f.product_code}</div>}
              <div style={{ fontSize: 15, fontWeight: 700, color: T.gold, marginTop: 8 }}>
                {f.sale_price ? <>৳{f.sale_price} <span style={{ fontSize: 12, color: T.textDim, textDecoration: "line-through", fontWeight: 400 }}>৳{f.regular_price}</span></> : (f.regular_price ? `৳${f.regular_price}` : <span style={{ color: T.danger, fontSize: 12 }}>No price yet</span>)}
              </div>
              <div style={{ fontSize: 11.5, marginTop: 6, color: f.stock_status === "outofstock" ? T.danger : T.success }}>{f.stock_status === "outofstock" ? "Out of stock" : "In stock"}{f.stock_qty !== "" && f.stock_qty != null ? ` · ${f.stock_qty} left` : ""}</div>
              {f.category && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 4 }}>{f.category}</div>}
            </div>
          </div>
          {f.description && <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginTop: 14, whiteSpace: "pre-wrap" }}>{f.description}</div>}
          {gallery.length > 1 && <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>{gallery.slice(1).map((g, i) => <img key={i} src={g.u} alt="" style={{ width: 46, height: 46, borderRadius: 9, objectFit: "cover", boxShadow: T.nmSm }} />)}</div>}
          {f.variants.length > 0 && <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Options the customer picks</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {f.variants.map((v) => { const shot = varImg[v.id]?.u || (/^https?:\/\//.test(v.image_url || "") ? v.image_url : ""); const out = v.stock_status === "outofstock" || v.stock_qty === 0 || v.stock_qty === "0"; return <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: T.bgAlt, boxShadow: T.nmIn, opacity: out ? .6 : 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, overflow: "hidden", background: T.card, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: shot ? "none" : `1px dashed ${T.borderStrong}` }}>{shot ? <img src={shot} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="ti ti-photo-off" style={{ fontSize: 14, color: T.textDim }} />}</div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name || "(unnamed)"}</span>
                <span style={{ fontSize: 12.5, color: T.gold, fontWeight: 600 }}>{v.sale_price ? `৳${v.sale_price}` : v.regular_price ? `৳${v.regular_price}` : ""}</span>
                <span style={{ fontSize: 11, color: out ? T.danger : T.success, flexShrink: 0 }}>{out ? "Out" : "In"}</span>
              </div>; })}
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}><i className="ti ti-info-circle" style={{ marginRight: 4 }} />A variant with a dashed box has no photo — add one in the Variants step so the bot can show that colour when a customer asks for it.</div>
          </div>}
        </Card>}
      </div>

      <div style={{ padding: isMobile ? "10px 12px calc(10px + env(safe-area-inset-bottom))" : "14px 22px", background: T.card, boxShadow: "0 -4px 16px rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        {err && <div style={{ width: "100%", fontSize: 12.5, color: T.danger, display: "flex", gap: 6, alignItems: "flex-start" }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}
        {edit && <Btn danger onClick={onDelete} disabled={busy} style={{ borderRadius: 12, background: T.dangerBg, color: T.danger }}><i className="ti ti-trash" style={{ marginRight: 5 }} />Delete</Btn>}
        {/* Step counter, so it reads as a wizard: "Step 2 of 4". */}
        <span style={{ fontSize: 11.5, color: T.textDim, fontWeight: 600 }}>Step {stepIdx + 1} of {STEPS.length}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
          <Btn onClick={onClose} disabled={busy} style={{ borderRadius: 12 }}>Cancel</Btn>
          {/* Offered only after the warning has been shown, never before. */}
          {dup && <Btn onClick={() => save(true)} disabled={busy} style={{ borderRadius: 12, background: T.warnBg, color: T.warn }}>Add anyway</Btn>}
          {stepIdx > 0 && <Btn onClick={() => goStep(-1)} disabled={busy} style={{ borderRadius: 12 }}><i className="ti ti-arrow-left" style={{ marginRight: 5 }} />Back</Btn>}
          {/* Editing an existing product can be saved from any step; adding walks
              the wizard to the Preview step, where the final button appears. */}
          {edit && stepIdx < STEPS.length - 1 && <Btn onClick={() => save()} disabled={busy || prepping} style={{ borderRadius: 12 }}>{busy ? "Saving…" : "Save changes"}</Btn>}
          {stepIdx < STEPS.length - 1
            ? <Btn gold onClick={() => goStep(1)} style={{ borderRadius: 12, padding: "9px 20px" }}>Next<i className="ti ti-arrow-right" style={{ marginLeft: 5 }} /></Btn>
            : <Btn gold onClick={() => save()} disabled={busy || prepping} style={{ borderRadius: 12, padding: "9px 22px" }}>{prepping ? "Preparing photos…" : busy ? (edit ? "Saving…" : "Adding & analysing…") : (edit ? "Save changes" : <><i className="ti ti-check" style={{ marginRight: 5 }} />Add product</>)}</Btn>}
        </div>
      </div>
    </div>
    <style dangerouslySetInnerHTML={{__html:`@keyframes inv-slide { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }
      @media (prefers-reduced-motion: reduce) { .inv-drawer { animation: none !important } }`}}/>
  </div>;
}

// ── Import sheet (CSV / product URL / WooCommerce) ──────────────────────────
// Exported so the AI Assistant can open it as an overlay ON its own tab, rather
// than sending the owner to Inventory — every way of adding products stays where
// the chat is.
export function ImportSheet({ kind, isMobile, onClose, onDone }) {
  const [url, setUrl] = useState("");
  // WooCommerce wants a URL and a key pair; Shopify wants a myshopify address
  // and one token. One state holds both, because a sheet only ever shows one
  // platform's boxes at a time.
  const [imp, setImp] = useState({ siteUrl: "", ck: "", cs: "", shop: "", token: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // The pasted link turned out to be a product the shop already has. Set only
  // after a refusal, so "Add anyway" cannot be pressed before reading why.
  const [urlDup, setUrlDup] = useState(false);
  // A product with no price or no photo is one the bot cannot show, so by
  // default it is not created. An IMPORT is the one place where holding to
  // that blindly would hurt — somebody else's shop export may simply not carry
  // photos, and losing sixty products to a rule is worse than the rule. So the
  // owner can lift it, deliberately, and can see that they have.
  const [incomplete, setIncomplete] = useState(false);
  // CSV: the file is read and mapped in the browser, then each row goes
  // through the same /api/import-one the WooCommerce import already uses —
  // so a spreadsheet product is indexed, embedded and deduplicated exactly
  // like every other product, with no second code path to keep correct.
  const [csv, setCsv] = useState(null);        // { name, headers, rows }
  const [map, setMap] = useState({});
  const csvRef = useRef(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => { const k = (e) => { if (e.key === "Escape" && !busy) onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [busy]);

  const readCsv = async (file) => {
    if (!file) return;
    setMsg("");
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { setMsg("Failed: that is not a .csv file. Save your sheet as CSV first."); return; }
    let rows;
    try { rows = parseCsv(await file.text()); }
    catch { setMsg("Failed: this file could not be read."); return; }
    if (rows.length < 2) { setMsg("Failed: the file needs a header row and at least one product."); return; }
    const [headers, ...body] = rows;
    setCsv({ name: file.name, headers, rows: body });
    setMap(autoMap(headers));
  };

  const runCsv = async () => {
    if (!csv || busy) return;
    const { products, skipped } = toProducts(csv.rows, map);
    if (!products.length) { setMsg("Failed: no rows have a name. Check which column is mapped to Name."); return; }
    setBusy(true);
    let done = 0, fail = 0, unread = 0, dupes = 0, thin = 0;
    for (const prod of products) {
      setMsg(`Importing ${done + fail + dupes + thin + 1}/${products.length}: ${prod.product_name}`);
      const one = await apiJson("/api/import-one", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...prod, allow_incomplete: incomplete }) });
      if (one.error) fail++;
      // Two different reasons a row can be skipped, counted apart because the
      // owner does something different about each: a duplicate they can ignore,
      // a row with no price or photo they can fix in the sheet and re-import.
      else if (one.incomplete) thin++;
      else if (one.skipped) dupes++;
      else { done++; if (one.analyzeError) unread++; }
      await new Promise((r) => setTimeout(r, 300));
    }
    setBusy(false); setMsg("");
    const tail = [
      fail ? `${fail} failed` : "",
      dupes ? `${dupes} already in your catalogue` : "",
      thin ? `${thin} skipped (no price or photo)` : "",
      skipped ? `${skipped} row${skipped > 1 ? "s" : ""} skipped (no name)` : "",
    ].filter(Boolean);
    const line = `Imported ${done}${tail.length ? `, ${tail.join(", ")}` : ""}`;
    // A row that saved but whose photo could not be read is not a failure and
    // must not be counted as one — but it is not a clean success either, and
    // saying so is the whole point of this. Those products will not come back
    // when a customer sends a picture.
    onDone(unread
      ? { warn: true, text: `${line} — but ${unread} photo${unread > 1 ? "s" : ""} could not be analysed, so those products cannot be found by picture.` }
      : line);
    onClose();
  };

  const sample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "autologic-products-sample.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // Shown above both import buttons. Off by default: a product the bot cannot
  // show should not be created, and that is the rule everywhere else too.
  const incompleteBox = <label style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: T.bgAlt, marginBottom: 12, cursor: busy ? "default" : "pointer", minHeight: 44 }}>
    <input type="checkbox" checked={incomplete} disabled={busy} onChange={(e) => setIncomplete(e.target.checked)}
      style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1, accentColor: T.gold }} />
    <span style={{ minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>Bring in products with no price or no photo too</span>
      <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>
        Off by default: the bot cannot answer a price it does not have, and cannot match a picture it was never given. Leave it off and those rows are skipped and counted, so you can fix them and import again.
      </span>
    </span>
  </label>;

  // `force` is the owner having read that this link looks like something they
  // already have, and saying they meant it.
  const scrape = async (force = false) => {
    if (!url || busy) return; setBusy(true); setMsg("Fetching the product…"); if (!force) setUrlDup(false);
    const r = await apiJson("/api/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, allow_duplicate: force || undefined }) });
    setBusy(false);
    // A duplicate is a question, not a failure: the link stays in the box.
    if (r.duplicate) { setMsg(r.error); setUrlDup(true); return; }
    if (r.error) { setMsg("Failed: " + r.error); return; }
    setMsg("");
    onDone(r.analyzeError
      ? { warn: true, text: `Added: ${r.name} — but the photo could not be analysed, so customers cannot find it by sending a picture.` }
      : `Added: ${r.name}`);
    onClose();
  };
  const runImport = async () => {
    // Each platform has its own two or three boxes, and none of them may be
    // empty — the server would only refuse a moment later, having made the
    // owner wait for it.
    const ready = kind === "shopify" ? imp.shop && imp.token : imp.siteUrl && imp.ck && imp.cs;
    if (!ready || busy) return;
    setBusy(true); setMsg("Fetching product list…");
    const r = await apiJson("/api/import-products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...imp, platform: kind }) });
    if (r.error) { setMsg("Failed: " + r.error); setBusy(false); return; }
    const list = r.products || []; let done = 0, fail = 0, unread = 0, dupes = 0, thin = 0;
    for (const prod of list) {
      setMsg(`Importing ${done + fail + dupes + thin + 1}/${list.length}: ${prod.product_name}`);
      const one = await apiJson("/api/import-one", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...prod, allow_incomplete: incomplete }) });
      if (one.error) fail++;
      // Already in the catalogue under a different code — reported, not failed.
      // A shop imported twice through two different routes is the usual way
      // this happens.
      else if (one.incomplete) thin++;
      else if (one.skipped) dupes++;
      else { done++; if (one.analyzeError) unread++; }
      await new Promise((r) => setTimeout(r, 300));
    }
    setBusy(false); setMsg("");
    const tail = [fail ? `${fail} failed` : "", dupes ? `${dupes} already in your catalogue` : "", thin ? `${thin} skipped (no price or photo)` : ""].filter(Boolean);
    const line = `Imported ${done}${tail.length ? `, ${tail.join(", ")}` : ""}`;
    onDone(unread
      ? { warn: true, text: `${line} — but ${unread} photo${unread > 1 ? "s" : ""} could not be analysed, so those products cannot be found by picture.` }
      : line);
    onClose();
  };
  return <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, height: "100dvh", zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
    <div onClick={(e) => e.stopPropagation()} className="ui-page" role="dialog" aria-modal="true" style={{ width: "100%", maxWidth: 520, background: T.card, borderRadius: isMobile ? "22px 22px 0 0" : 22, boxShadow: T.nmOut, border: `1px solid ${T.border}`, padding: "22px 20px calc(20px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${kind === "csv" ? "ti-table" : kind === "url" ? "ti-link" : kind === "shopify" ? "ti-brand-shopee" : "ti-brand-wordpress"}`} style={{ fontSize: 20, color: T.gold }} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 700 }}>{kind === "csv" ? "Import from a spreadsheet" : kind === "url" ? "Import from a product URL" : kind === "shopify" ? "Import from Shopify" : "Import from WooCommerce"}</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>{kind === "csv" ? "A CSV saved from Excel or Google Sheets" : kind === "url" ? "We fetch the name, photo, price and description" : "All published products come into your inventory"}</div></div>
        <button onClick={onClose} disabled={busy} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>
      {kind === "csv"
        ? <>
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { readCsv(e.target.files[0]); e.target.value = ""; }} />
            {!csv
              ? <>
                  {/* Drop target and button in one: dragging a file on is the
                      fastest route on a desktop, tapping is the only route on
                      a phone, and both land in the same place. */}
                  <div onClick={() => !busy && csvRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); readCsv(e.dataTransfer.files?.[0]); }}
                    style={{ cursor: "pointer", textAlign: "center", padding: "30px 18px", borderRadius: 16, marginBottom: 12,
                      background: drag ? T.goldBg : T.bgAlt, boxShadow: T.nmIn,
                      border: `1.5px dashed ${drag ? T.gold : T.border}`, transition: "background .15s, border-color .15s" }}>
                    <i className="ti ti-file-spreadsheet" style={{ fontSize: 30, color: T.gold }} />
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>Choose a CSV file</div>
                    <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>{isMobile ? "Tap to pick from your phone" : "or drag it here"}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.7, padding: "10px 12px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn }}>
                    In Excel or Google Sheets choose <b style={{ color: T.text }}>Save as / Download → CSV</b>. The first row must be the column names.
                    Only <b style={{ color: T.text }}>Name</b> is required; anything else you have is a bonus.
                    <button type="button" onClick={sample} className="ui-btn" style={{ display: "block", marginTop: 8, background: "none", border: "none", padding: 0, color: T.gold, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <i className="ti ti-download" style={{ marginRight: 5 }} />Download a sample file
                    </button>
                  </div>
                </>
              : <>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn }}>
                    <i className="ti ti-file-spreadsheet" style={{ fontSize: 19, color: T.gold, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{csv.name}</div>
                      <div style={{ fontSize: 11.5, color: T.textMuted }}>{csv.rows.length} row{csv.rows.length === 1 ? "" : "s"} · {csv.headers.length} columns</div>
                    </div>
                    {!busy && <button type="button" onClick={() => { setCsv(null); setMap({}); setMsg(""); }} className="ui-btn" style={{ background: "none", border: "none", color: T.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Change</button>}
                  </div>
                  {/* Mapping is shown, not assumed. The guess is usually right,
                      but a wrong guess would quietly import prices into the
                      description — so the owner sees every decision and can
                      correct any of it before a single row is written. */}
                  <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 8 }}>Check the columns matched up. Set anything wrong to the right one.</div>
                  <div style={{ display: "grid", gap: 8, marginBottom: 14, maxHeight: 260, overflowY: "auto" }}>
                    {COLUMNS.map((col) => (
                      <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 104, flexShrink: 0, fontSize: 12.5, color: col.required ? T.text : T.textMuted, fontWeight: col.required ? 600 : 400 }}>
                          {col.label}{col.required && <span style={{ color: T.danger }}> *</span>}
                        </div>
                        <Select wide style={{ flex: 1, minWidth: 0 }}
                          value={map[col.key] == null ? "" : String(map[col.key])}
                          onChange={(v) => setMap((m) => { const n = { ...m }; if (v === "") delete n[col.key]; else n[col.key] = Number(v); return n; })}
                          placeholder="— not in my file —"
                          options={[{ value: "", label: "— not in my file —", icon: "ti-minus" },
                            ...csv.headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}`, icon: "ti-table-column" }))]} />
                      </div>
                    ))}
                  </div>
                  {incompleteBox}
                  <Btn gold onClick={runCsv} disabled={busy || map.product_name == null} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>
                    {busy ? "Importing…" : `Import ${csv.rows.length} product${csv.rows.length === 1 ? "" : "s"}`}
                  </Btn>
                  {map.product_name == null && <div style={{ fontSize: 11.5, color: T.danger, marginTop: 8 }}>Pick which column holds the product name to continue.</div>}
                </>}
          </>
        : kind === "url"
        ? <>
            <Inp emb label="Product page link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourshop.com/product/…" onKeyDown={(e) => { if (e.key === "Enter") scrape(); }} />
            <Btn gold onClick={() => scrape()} disabled={busy || !url} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>{busy ? "Fetching…" : "Fetch product"}</Btn>
            {/* Offered only after the warning has been shown, never before. */}
            {urlDup && <Btn onClick={() => scrape(true)} disabled={busy} style={{ width: "100%", marginTop: 8, padding: "10px 20px", borderRadius: 14, background: T.warnBg, color: T.warn }}>Add anyway</Btn>}
          </>
        : kind === "shopify"
        ? <>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 12, lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn }}>
              Shopify admin › Settings › Apps and sales channels › <b style={{ color: T.text }}>Develop apps</b> › Create an app › Configure Admin API scopes › tick <b style={{ color: T.text }}>read_products</b> › Install › reveal the Admin API access token.
            </div>
            <Inp emb label="Shop address" value={imp.shop} onChange={(e) => setImp({ ...imp, shop: e.target.value })} placeholder="your-shop.myshopify.com" />
            {/* The permanent address, not the one customers see. A shop on its
                own domain still answers on myshopify.com, and the API only
                answers there. */}
            <Inp emb label="Admin API access token" type="password" value={imp.token} onChange={(e) => setImp({ ...imp, token: e.target.value })} placeholder="shpat_…" />
            {incompleteBox}
            <Btn gold onClick={runImport} disabled={busy} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>{busy ? "Importing…" : "Import products"}</Btn>
          </>
        : <>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 12, lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn }}>WooCommerce › Settings › Advanced › REST API › Add key (Read) gives you the Consumer key and secret.</div>
            <Inp emb label="Website URL" value={imp.siteUrl} onChange={(e) => setImp({ ...imp, siteUrl: e.target.value })} placeholder="https://yourshop.com" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <Inp emb label="Consumer key" value={imp.ck} onChange={(e) => setImp({ ...imp, ck: e.target.value })} placeholder="ck_…" />
              <Inp emb label="Consumer secret" type="password" value={imp.cs} onChange={(e) => setImp({ ...imp, cs: e.target.value })} placeholder="cs_…" />
            </div>
            {incompleteBox}
            <Btn gold onClick={runImport} disabled={busy} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>{busy ? "Importing…" : "Import products"}</Btn>
          </>}
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Failed") ? T.danger : T.textMuted, marginTop: 12, display: "flex", gap: 7, alignItems: "center" }}>{busy && <i className="ti ti-loader-2" style={{ fontSize: 15 }} />}{msg}</div>}
    </div>
  </div>;
}
