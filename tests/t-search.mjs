// The header search: what matches, in which group, and how many. The module
// has no imports, so it is loaded where it lives.
import { findAll, flatten } from "../src/lib/global-search.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); } };

const convos = [
  { id: "u1", sender: "Tasnim Rahman", platform: "instagram", lastMsg: "Ei design ta ki M size e ache?" },
  { id: "8801712345678", sender: "+8801712345678", platform: "whatsapp", lastMsg: "Delivery charge?" },
  { id: "u3", sender: "Rahim Uddin", platform: "facebook", lastMsg: "Cumilla te delivery hobe?" },
];
const orders = [
  { id: 1, order_code: "A-1042", customer_name: "Tasnim Rahman", phone_number: "01712345678", status: "Pending", total: 1510, items: [{ name: "Cotton panjabi", code: "PJ-NVY-01" }] },
  { id: 2, order_code: "A-1041", customer_name: "Rahim Uddin", phone_number: "01898765432", status: "Shipped", total: 1820, product_names: "Handloom shawl" },
];
const products = [
  { id: "p1", product_name: "Cotton panjabi — navy", product_code: "PJ-NVY-01", brand: "Nokshi", category: "Men › Panjabi", regular_price: 1650, sale_price: 1450 },
  { id: "p2", product_name: "Half-sleeve polo — olive", product_code: "PL-OLV-04", brand: "Nokshi", category: "Men › Polo", regular_price: 850 },
];
const data = { convos, orders, products };

// Nothing typed, nothing listed.
ok("empty query lists nothing", flatten(findAll("", data)).length === 0 && flatten(findAll("   ", data)).length === 0);

// A name finds the customer AND their order; case does not matter.
let r = findAll("tasnim", data);
ok("customer by name", r.customers.length === 1 && r.customers[0].id === "u1" && r.customers[0].platform === "instagram", r.customers);
ok("order by customer name", r.orders.length === 1 && r.orders[0].id === 1 && r.orders[0].title === "A-1042 · Tasnim Rahman", r.orders);
ok("no product called tasnim", r.products.length === 0);

// An order code, a phone number, an item inside the order.
ok("order by code", findAll("a-104", data).orders.length === 2);
ok("order by phone", findAll("01898", data).orders.map((o) => o.id).join() === "2");
ok("order by an item's code", findAll("pj-nvy", data).orders.map((o) => o.id).join() === "1");
ok("order by product_names text", findAll("shawl", data).orders.map((o) => o.id).join() === "2");

// A WhatsApp customer by number (their id is their number).
ok("customer by phone digits", findAll("880171", data).customers.map((c) => c.id).join() === "8801712345678");
// Message text is searched too.
ok("customer by what they wrote", findAll("cumilla", data).customers.map((c) => c.id).join() === "u3");

// Products: name, code, brand, category; the sale price wins when set.
r = findAll("panjabi", data);
ok("product by name", r.products.length === 1 && r.products[0].id === "p1" && r.products[0].price === 1450, r.products);
ok("product by category", findAll("polo", data).products.map((p) => p.id).join() === "p2");
ok("product by brand lists both", findAll("nokshi", data).products.length === 2);
ok("regular price when no sale", findAll("olive", data).products[0].price === 850);

// An agency has no orders or catalogue to search.
r = findAll("tasnim", { ...data, isAgency: true });
ok("agency: customers only", r.customers.length === 1 && r.orders.length === 0 && r.products.length === 0);

// The limit is per group; the flat order is customers, orders, products.
const many = { convos: Array.from({ length: 9 }, (_, i) => ({ id: "x" + i, sender: "Zed " + i })), orders: [], products: [] };
ok("at most five per group", findAll("zed", many).customers.length === 5 && findAll("zed", many, 2).customers.length === 2);
ok("flat order", flatten(findAll("n", data)).map((x) => x.kind).join() === "customer,customer,order,order,product,product" || flatten(findAll("n", data)).every((x, i, a) => i === 0 || ["customer", "order", "product"].indexOf(a[i - 1].kind) <= ["customer", "order", "product"].indexOf(x.kind)));
ok("rows carry a kind and an id", flatten(findAll("a", data)).every((x) => x.kind && x.id !== undefined));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
