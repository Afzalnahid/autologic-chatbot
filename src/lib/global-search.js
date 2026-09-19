// The header's search box, the pure half: which chats, orders and products
// match what was typed. No imports, so the dashboard component and the test
// suite run the same code. The component (GlobalSearch.js) draws the list
// and jumps to the pick.
//
// Everything searched is already loaded by the dashboard shell — the chat
// list, the orders and the catalogue — so this never fetches. An agency has
// no orders or catalogue to search; its customers are enough.

const norm = (s) => String(s ?? "").toLowerCase().trim();
const has = (hay, q) => norm(hay).includes(q);

export function findAll(query, { convos = [], orders = [], products = [], isAgency = false } = {}, limit = 5) {
  const q = norm(query);
  if (q.length < 1) return { customers: [], orders: [], products: [] };

  const customers = convos
    .filter((c) => has(c.sender, q) || has(c.id, q) || has(c.lastMsg, q))
    .slice(0, limit)
    .map((c) => ({ kind: "customer", id: c.id, title: c.sender || String(c.id), sub: c.lastMsg || "", platform: c.platform || "facebook" }));

  const ords = isAgency ? [] : orders
    .filter((o) => has(o.order_code, q) || has(o.customer_name, q) || has(o.phone_number, q) || has(o.product_names, q)
      || (o.items || []).some((i) => has(i.name, q) || has(i.code, q)))
    .slice(0, limit)
    .map((o) => ({ kind: "order", id: o.id, title: [o.order_code, o.customer_name].filter(Boolean).join(" · "), sub: o.status || "Pending", total: o.total }));

  const prods = isAgency ? [] : products
    .filter((p) => has(p.product_name, q) || has(p.product_code, q) || has(p.brand, q) || has(p.category, q))
    .slice(0, limit)
    .map((p) => ({ kind: "product", id: p.id, title: p.product_name || "", sub: p.product_code || p.category || "", price: Number(p.sale_price) > 0 ? p.sale_price : p.regular_price }));

  return { customers, orders: ords, products: prods };
}

// The rows in the order the list shows them, so the keyboard can walk them.
export function flatten(groups) {
  return [...groups.customers, ...groups.orders, ...groups.products];
}
