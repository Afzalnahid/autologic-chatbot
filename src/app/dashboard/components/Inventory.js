"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { T, Card, Btn, Inp, Badge, Select, Segmented, useIsMobile, taka } from "./ui.js";
import { api } from "./session.js";

// The Inventory tab: the shop's catalogue, organised. Products carry a
// category, a brand, tags, a photo gallery and — for things that come in
// sizes/colours — options and variants. Everything is edited in one drawer;
// the list is filtered by category rail, stock, search and sort.

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

export default function Inventory({ products, refresh }) {
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
  const [busyBulk, setBusyBulk] = useState(false);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { try { const v = localStorage.getItem("al-inv-view"); if (v === "grid" || v === "list") setView(v); } catch {} }, []);
  const pickView = (v) => { setView(v); try { localStorage.setItem("al-inv-view", v); } catch {} };

  const cats = useMemo(() => {
    const m = new Map();
    for (const p of products) { const c = catOf(p); m.set(c, (m.get(c) || 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0] === "Uncategorized" ? 1 : b[0] === "Uncategorized" ? -1 : a[0].localeCompare(b[0]));
  }, [products]);
  const catNames = cats.map(([c]) => c).filter((c) => c !== "Uncategorized");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let l = products.filter((p) => {
      if (cat !== "all" && catOf(p) !== cat) return false;
      const s = stockOf(p);
      if (stock === "instock" && s === "out") return false;
      if (stock === "outofstock" && s !== "out") return false;
      if (stock === "low" && s !== "low") return false;
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
    const r = await api("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel] }) }).then((r) => r.json()).catch(() => ({ error: "network" }));
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
    const r = await api("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }).then((r) => r.json()).catch(() => ({ error: "network" }));
    if (r.error) { setToast("Delete failed: " + r.error); return; }
    setToast("Product deleted"); refresh();
  };

  const stockItems = [{ value: "all", label: "All" }, { value: "instock", label: "In stock" }, { value: "low", label: "Low", badge: stats.low || undefined }, { value: "outofstock", label: "Out", badge: stats.out || undefined }];
  const catItems = [{ value: "all", label: "All products", icon: "ti-layout-grid", badge: products.length }, ...cats.map(([c, n]) => ({ value: c, label: c, icon: c === "Uncategorized" ? "ti-folder-question" : "ti-folder", badge: n }))];
  const wide = !isMobile;

  const empty = products.length === 0;

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
        {[["grid", "ti-layout-grid"], ["list", "ti-list"]].map(([v, ic]) => <button key={v} onClick={() => pickView(v)} aria-label={v} aria-pressed={view === v} className="ui-btn"
          style={{ width: 34, height: 34, minHeight: 0, borderRadius: 9, border: "none", cursor: "pointer", background: view === v ? T.accGrad : "transparent", color: view === v ? "#fff" : T.textMuted, boxShadow: view === v ? T.accGlow : "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${ic}`} style={{ fontSize: 16 }} /></button>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <Select value="" placeholder="Import" options={[{ value: "url", label: "From a product URL", icon: "ti-link" }, { value: "woo", label: "From WooCommerce", icon: "ti-brand-wordpress" }]} onChange={(v) => setImporter(v)} />
        <Btn gold onClick={() => setEditor({ mode: "add" })} style={{ padding: "9px 16px", borderRadius: 12, whiteSpace: "nowrap" }}><i className="ti ti-plus" style={{ marginRight: 6 }} />Add product</Btn>
      </div>
    </Card>

    {/* Body: category rail + products */}
    {empty
      ? <Card style={{ padding: "clamp(24px,5vw,44px) 20px", textAlign: "center" }}>
          <div style={{ width: 66, height: 66, borderRadius: 20, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><i className="ti ti-package" style={{ fontSize: 30, color: T.gold }} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Your catalogue is empty</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, maxWidth: 440, margin: "6px auto 22px", lineHeight: 1.6 }}>Add products with photos, prices, categories and sizes or colours. The bot shows them to customers, matches photos and takes orders.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, maxWidth: 640, margin: "0 auto" }}>
            {[["ti-plus", "Add a product", "Name, photos, price, variants", () => setEditor({ mode: "add" })], ["ti-link", "Paste a product URL", "We fetch name, photo and price", () => setImporter("url")], ["ti-brand-wordpress", "Import WooCommerce", "Bring your whole shop over", () => setImporter("woo")]].map(([ic, t, s, fn]) =>
              <button key={t} type="button" onClick={fn} className="ui-btn ob-row" style={{ padding: "16px 14px", borderRadius: 16, background: T.card, boxShadow: T.nmSm, border: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: T.text }}>
                <i className={`ti ${ic}`} style={{ fontSize: 22, color: T.gold }} /><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>{t}</div><div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{s}</div>
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

    {toast && <div style={{ position: "fixed", left: "50%", top: 14, transform: "translateX(-50%)", zIndex: 90, background: T.text, color: T.bg, borderRadius: 12, padding: "9px 14px", fontSize: 13, fontWeight: 500, boxShadow: T.nmOut, maxWidth: "calc(100vw - 24px)" }} className="ui-page">{toast}</div>}

    {editor && <ProductEditor key={editor.p?.id || "new"} mode={editor.mode} p={editor.p} categories={catNames} isMobile={isMobile}
      onClose={() => setEditor(null)}
      onSaved={(msg) => { setEditor(null); setToast(msg); refresh(); }}
      onDelete={async () => { const p = editor.p; setEditor(null); await del(p); }} />}

    {importer && <ImportSheet kind={importer} isMobile={isMobile} onClose={() => setImporter(null)} onDone={(msg) => { setToast(msg); refresh(); }} />}
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
    <span className="inv-edit" style={{ position: "absolute", right: 10, bottom: 10, width: 30, height: 30, borderRadius: 10, background: T.accGrad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: T.accGlow, opacity: 0, transition: "opacity .18s ease-out" }}><i className="ti ti-pencil" style={{ fontSize: 14 }} /></span>
    <style>{`
      @media (hover:hover) and (pointer:fine) {
        .inv-card:hover .inv-img { transform: scale(1.04) }
        .inv-card:hover .inv-edit { opacity: 1 }
        .inv-card .inv-check { opacity: 0; transition: opacity .15s }
        .inv-card:hover .inv-check { opacity: 1 }
      }
    `}</style>
  </div>;
}

// ── Editor drawer ────────────────────────────────────────────────────────────
const cartesian = (opts) => opts.reduce((acc, o) => acc.flatMap((row) => o.values.map((v) => ({ ...row, [o.name]: v }))), [{}]);
const attrsKey = (a) => Object.entries(a || {}).map(([k, v]) => `${k}=${v}`).sort().join("|");

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
  const [urlIn, setUrlIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("details");
  const fileRef = useRef(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, []);
  useEffect(() => () => gallery.forEach((g) => g.kind === "file" && URL.revokeObjectURL(g.u)), []);

  const addFiles = (list) => { const arr = [...list].filter((x) => x.type.startsWith("image/")).slice(0, 8); setGallery((s) => [...s, ...arr.map((file) => ({ kind: "file", file, u: URL.createObjectURL(file) }))].slice(0, 12)); };
  const makePrimary = (g) => setGallery((s) => [g, ...s.filter((x) => x !== g)]);
  const removeImg = (g) => setGallery((s) => s.filter((x) => x !== g));
  const addUrl = () => { const u = urlIn.trim(); if (!/^https?:\/\//.test(u)) { setErr("Paste a full image link starting with http"); return; } setGallery((s) => [...s, { kind: "url", u }].slice(0, 12)); setUrlIn(""); setErr(""); };

  // Options → variants
  const setOpt = (i, patch) => set("options", f.options.map((o, j) => j === i ? { ...o, ...patch } : o));
  const addOptValue = (i, raw) => { const vals = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean); if (!vals.length) return; setOpt(i, { values: [...new Set([...f.options[i].values, ...vals])] }); };
  const generate = () => {
    const opts = f.options.filter((o) => o.name.trim() && o.values.length);
    if (!opts.length) { setErr("Add an option (e.g. Size) with some values first"); return; }
    const combos = cartesian(opts);
    const byKey = new Map(f.variants.map((v) => [attrsKey(v.attrs), v]));
    const next = combos.map((attrs) => byKey.get(attrsKey(attrs)) || ({ id: `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: Object.values(attrs).join(" / "), sku: "", attrs, regular_price: f.regular_price, sale_price: f.sale_price, stock_qty: "", stock_status: "instock", image_url: "" }));
    set("variants", next); setErr("");
  };
  const setVar = (i, patch) => set("variants", f.variants.map((v, j) => j === i ? { ...v, ...patch } : v));
  const addVariant = () => set("variants", [...f.variants, { id: `v${Date.now().toString(36)}`, name: "", sku: "", attrs: {}, regular_price: f.regular_price, sale_price: f.sale_price, stock_qty: "", stock_status: "instock", image_url: "" }]);
  const applyPriceAll = () => set("variants", f.variants.map((v) => ({ ...v, regular_price: f.regular_price, sale_price: f.sale_price })));

  const save = async () => {
    if (!f.product_name.trim()) { setErr("Product name is required"); setTab("details"); return; }
    if (busy) return;
    setBusy(true); setErr("");
    const fd = new FormData();
    if (edit) fd.append("id", p.id);
    for (const k of ["product_name", "product_code", "category", "brand", "tags", "regular_price", "sale_price", "stock_status", "description"]) fd.append(k, f[k] ?? "");
    fd.append("stock_qty", f.stock_qty === "" || f.stock_qty === null ? "" : String(f.stock_qty));
    fd.append("options", JSON.stringify(f.options.filter((o) => o.name.trim() && o.values.length)));
    fd.append("variants", JSON.stringify(f.variants.filter((v) => (v.name || "").trim() || Object.keys(v.attrs || {}).length)));
    // Order is the owner's; each new file becomes "upload:N" in that order.
    const files = gallery.filter((g) => g.kind === "file");
    fd.append("image_urls", JSON.stringify(gallery.map((g) => g.kind === "url" ? g.u : `upload:${files.indexOf(g)}`)));
    for (const g of files) fd.append("images", g.file);
    const r = await api(edit ? "/api/products" : "/api/add-product", { method: edit ? "PATCH" : "POST", body: fd }).then((r) => r.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    onSaved(edit ? "Product updated" : (r.analyzed ? "Product added and photo analysed" : "Product added"));
  };

  const L = ({ children }) => <label style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{children}</label>;
  const H = ({ icon, children, sub }) => <div style={{ margin: "4px 0 12px" }}><div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><i className={`ti ${icon}`} style={{ color: T.gold, fontSize: 16 }} />{children}</div>{sub && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}</div>;
  const chip = (on) => ({ padding: "5px 11px", borderRadius: 999, border: `1px solid ${on ? T.gold : T.border}`, background: on ? T.goldBg : T.card, color: on ? T.gold : T.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 0 });
  const tabs = [{ value: "details", label: "Details", icon: "ti-forms" }, { value: "photos", label: "Photos", icon: "ti-photo", badge: gallery.length || undefined }, { value: "variants", label: "Variants", icon: "ti-versions", badge: f.variants.length || undefined }];

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "flex-end" }}>
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
              {i === 0 && <span style={{ position: "absolute", top: 6, left: 6, background: T.accGrad, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Primary</span>}
              {g.kind === "file" && <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(25,28,36,.7)", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 999 }}>New</span>}
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                {i !== 0 && <button type="button" title="Make primary" onClick={() => makePrimary(g)} style={{ width: 26, height: 26, minHeight: 0, borderRadius: 8, border: "none", background: "rgba(255,255,255,.9)", color: T.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-star" style={{ fontSize: 14 }} /></button>}
                <button type="button" title="Remove" onClick={() => removeImg(g)} style={{ width: 26, height: 26, minHeight: 0, borderRadius: 8, border: "none", background: "rgba(255,255,255,.9)", color: T.danger, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
              </div>
            </div>)}
            <button type="button" onClick={() => fileRef.current?.click()} className="ui-btn ob-row"
              style={{ aspectRatio: "1", borderRadius: 14, border: `1.5px dashed ${T.borderStrong}`, background: T.bgAlt, color: T.textMuted, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", fontSize: 12, minHeight: 0 }}>
              <i className="ti ti-cloud-upload" style={{ fontSize: 24, color: T.gold }} />Add photos
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Inp emb value={urlIn} onChange={(e) => setUrlIn(e.target.value)} placeholder="…or paste an image link (https://…)" style={{ flex: 1, marginBottom: 0 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} />
            <Btn onClick={addUrl} style={{ borderRadius: 14 }}>Add</Btn>
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>Drag photos onto the grid, or tap Add photos. Up to 12 per product.</div>
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
                  {!isMobile && <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 84px 84px 70px 92px 30px", gap: 8, padding: "0 6px", fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>
                    <span>Variant</span><span>SKU</span><span>Price</span><span>Sale</span><span>Qty</span><span>Status</span><span /></div>}
                  {f.variants.map((v, i) => {
                    const cell = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 0, width: "100%", boxSizing: "border-box" };
                    const out = v.stock_status === "outofstock" || v.stock_qty === 0 || v.stock_qty === "0";
                    return <div key={v.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "minmax(0,1.6fr) minmax(0,1fr) 84px 84px 70px 92px 30px", gap: 8, alignItems: "center", padding: isMobile ? 10 : "6px 6px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, opacity: out ? .75 : 1 }}>
                      <input value={v.name} onChange={(e) => setVar(i, { name: e.target.value })} placeholder="Name (e.g. M / Red)" className="ui-inp" style={{ ...cell, fontWeight: 600, gridColumn: isMobile ? "1 / -1" : undefined }} />
                      <input value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} placeholder="SKU" className="ui-inp" style={cell} />
                      <input value={v.regular_price} onChange={(e) => setVar(i, { regular_price: e.target.value })} placeholder="Price" inputMode="decimal" className="ui-inp" style={cell} />
                      <input value={v.sale_price} onChange={(e) => setVar(i, { sale_price: e.target.value })} placeholder="Sale" inputMode="decimal" className="ui-inp" style={cell} />
                      <input value={v.stock_qty ?? ""} onChange={(e) => setVar(i, { stock_qty: e.target.value.replace(/[^\d]/g, "") })} placeholder="Qty" inputMode="numeric" className="ui-inp" style={cell} />
                      <button type="button" onClick={() => setVar(i, { stock_status: out ? "instock" : "outofstock", stock_qty: out && (v.stock_qty === 0 || v.stock_qty === "0") ? "" : v.stock_qty })} className="ui-btn"
                        style={{ ...cell, cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: out ? T.danger : T.success, background: `color-mix(in srgb, ${out ? T.danger : T.success} 9%, transparent)`, border: "none", minHeight: 0, whiteSpace: "nowrap" }}>{out ? "Out" : "In stock"}</button>
                      <button type="button" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))} aria-label="Remove variant" className="ui-btn" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 16, minHeight: 0, padding: 4, justifySelf: isMobile ? "end" : "center" }}><i className="ti ti-trash" /></button>
                    </div>;
                  })}
                  <Btn small onClick={addVariant} style={{ alignSelf: "flex-start", borderRadius: 10 }}><i className="ti ti-plus" style={{ marginRight: 5 }} />Add variant</Btn>
                </div>}
          </Card>
        </>}
      </div>

      <div style={{ padding: isMobile ? "10px 12px calc(10px + env(safe-area-inset-bottom))" : "14px 22px", background: T.card, boxShadow: "0 -4px 16px rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        {err && <div style={{ width: "100%", fontSize: 12.5, color: T.danger, display: "flex", gap: 6, alignItems: "flex-start" }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}
        {edit && <Btn danger onClick={onDelete} disabled={busy} style={{ borderRadius: 12, background: T.dangerBg, color: T.danger }}><i className="ti ti-trash" style={{ marginRight: 5 }} />Delete</Btn>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn onClick={onClose} disabled={busy} style={{ borderRadius: 12 }}>Cancel</Btn>
          <Btn gold onClick={save} disabled={busy} style={{ borderRadius: 12, padding: "9px 22px" }}>{busy ? (edit ? "Saving…" : "Adding & analysing…") : (edit ? "Save changes" : "Add product")}</Btn>
        </div>
      </div>
    </div>
    <style>{`@keyframes inv-slide { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }
      @media (prefers-reduced-motion: reduce) { .inv-drawer { animation: none !important } }`}</style>
  </div>;
}

// ── Import sheet (product URL / WooCommerce) ────────────────────────────────
function ImportSheet({ kind, isMobile, onClose, onDone }) {
  const [url, setUrl] = useState("");
  const [imp, setImp] = useState({ siteUrl: "", ck: "", cs: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { const k = (e) => { if (e.key === "Escape" && !busy) onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [busy]);
  const scrape = async () => {
    if (!url || busy) return; setBusy(true); setMsg("Fetching the product…");
    const r = await api("/api/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).then((r) => r.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setMsg("Failed: " + r.error); return; }
    setMsg(""); onDone(`Added: ${r.name}`); onClose();
  };
  const runImport = async () => {
    if (!imp.siteUrl || !imp.ck || !imp.cs || busy) return;
    setBusy(true); setMsg("Fetching product list…");
    const r = await api("/api/import-products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(imp) }).then((r) => r.json()).catch(() => ({ error: "network" }));
    if (r.error) { setMsg("Failed: " + r.error); setBusy(false); return; }
    const list = r.products || []; let done = 0, fail = 0;
    for (const prod of list) {
      setMsg(`Importing ${done + fail + 1}/${list.length}: ${prod.product_name}`);
      const one = await api("/api/import-one", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prod) }).then((r) => r.json()).catch(() => ({ error: 1 }));
      if (one.error) fail++; else done++;
      await new Promise((r) => setTimeout(r, 300));
    }
    setBusy(false); setMsg("");
    onDone(`Imported ${done}${fail ? `, ${fail} failed` : ""}`); onClose();
  };
  return <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
    <div onClick={(e) => e.stopPropagation()} className="ui-page" role="dialog" aria-modal="true" style={{ width: "100%", maxWidth: 520, background: T.card, borderRadius: isMobile ? "22px 22px 0 0" : 22, boxShadow: T.nmOut, border: `1px solid ${T.border}`, padding: "22px 20px calc(20px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${kind === "url" ? "ti-link" : "ti-brand-wordpress"}`} style={{ fontSize: 20, color: T.gold }} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 700 }}>{kind === "url" ? "Import from a product URL" : "Import from WooCommerce"}</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>{kind === "url" ? "We fetch the name, photo, price and description" : "All published products come into your inventory"}</div></div>
        <button onClick={onClose} disabled={busy} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>
      {kind === "url"
        ? <>
            <Inp emb label="Product page link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourshop.com/product/…" onKeyDown={(e) => { if (e.key === "Enter") scrape(); }} />
            <Btn gold onClick={scrape} disabled={busy || !url} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>{busy ? "Fetching…" : "Fetch product"}</Btn>
          </>
        : <>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 12, lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn }}>WooCommerce › Settings › Advanced › REST API › Add key (Read) gives you the Consumer key and secret.</div>
            <Inp emb label="Website URL" value={imp.siteUrl} onChange={(e) => setImp({ ...imp, siteUrl: e.target.value })} placeholder="https://yourshop.com" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <Inp emb label="Consumer key" value={imp.ck} onChange={(e) => setImp({ ...imp, ck: e.target.value })} placeholder="ck_…" />
              <Inp emb label="Consumer secret" type="password" value={imp.cs} onChange={(e) => setImp({ ...imp, cs: e.target.value })} placeholder="cs_…" />
            </div>
            <Btn gold onClick={runImport} disabled={busy} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>{busy ? "Importing…" : "Import products"}</Btn>
          </>}
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Failed") ? T.danger : T.textMuted, marginTop: 12, display: "flex", gap: 7, alignItems: "center" }}>{busy && <i className="ti ti-loader-2" style={{ fontSize: 15 }} />}{msg}</div>}
    </div>
  </div>;
}
