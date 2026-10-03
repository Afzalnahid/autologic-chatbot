// The package a visitor chose with a "Buy" button on the home or pricing page
// (/dashboard?upgrade=shop_pro&cycle=monthly&byok=1), kept on this device until
// they have an account and have paid (owner, 2026-10-04).
//
// It used to live only in React state, so it was lost the moment signing up
// sent a confirmation email: the link opened a fresh /dashboard, the choice was
// gone, and the new customer was walked into a free trial instead of the
// package they came to buy. localStorage survives that round trip on the same
// device. It is a convenience only — every read is guarded, and with storage
// blocked the visitor simply chooses the package again in Billing.

const KEY = "al_buy_intent";
const MAX_AGE = 7 * 86400000;

// "replies.500,products.100" (the public card's Buy link) → { replies: 500, products: 100 }.
// Only the shape is checked here; the server prices and checks every number.
export function parseCustom(param) {
  const out = {};
  for (const part of String(param || "").split(",")) {
    const [k, v] = part.split(".");
    const n = Number(v);
    if (/^(replies|products|docs|assistant)$/.test(k) && Number.isInteger(n) && n > 0 && n < 1e6) out[k] = n;
  }
  return out;
}

export function saveBuyIntent({ plan, cycle, byok, custom }) {
  if (!plan || !/^[a-z0-9_-]{2,40}$/i.test(plan)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ plan, cycle: cycle === "yearly" ? "yearly" : "monthly", byok: !!byok, custom: custom || {}, at: Date.now() })); } catch {}
}

export function readBuyIntent() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!v || !v.plan || !(Date.now() - Number(v.at) < MAX_AGE)) return null;
    return { plan: String(v.plan), cycle: v.cycle === "yearly" ? "yearly" : "monthly", byok: !!v.byok, custom: parseCustom(Object.entries(v.custom || {}).map(([k, n]) => `${k}.${n}`).join(",")) };
  } catch { return null; }
}

export function clearBuyIntent() {
  try { localStorage.removeItem(KEY); } catch {}
}
