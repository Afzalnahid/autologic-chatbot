// SSLCommerz gateway. Configuration lives in env only; when it is absent the
// platform silently falls back to the manual bKash/Nagad/Rocket flow.

const LIVE = {
  init: "https://securepay.sslcommerz.com/gwprocess/v4/api.php",
  validate: "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php",
};
const SANDBOX = {
  init: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
  validate: "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php",
};

export function sslConfig() {
  const storeId = process.env.SSLCZ_STORE_ID || "";
  const storePasswd = process.env.SSLCZ_STORE_PASSWORD || "";
  const live = String(process.env.SSLCZ_MODE || "sandbox").toLowerCase() === "live";
  return { storeId, storePasswd, live, urls: live ? LIVE : SANDBOX };
}

export function sslEnabled() {
  const { storeId, storePasswd } = sslConfig();
  return !!(storeId && storePasswd);
}

export function baseUrl(request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = request?.headers;
  const host = h?.get("x-forwarded-host") || h?.get("host");
  const proto = h?.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "";
}

// Our own transaction id. It is what SSLCommerz echoes back and what we store
// in payment_requests.txn_id, so it must be unique per attempt.
export function newTranId(clientId) {
  const short = String(clientId || "").replace(/-/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AL${Date.now().toString(36).toUpperCase()}${short.toUpperCase()}${rand}`;
}

function form(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  }
  return p;
}

// Creates a hosted checkout session. Returns { ok, url, reason }.
export async function initiateSession({ tranId, amount, planName, cycle, origin, customer }) {
  const { storeId, storePasswd, urls } = sslConfig();
  if (!storeId || !storePasswd) return { ok: false, reason: "gateway_not_configured" };

  const body = form({
    store_id: storeId,
    store_passwd: storePasswd,
    total_amount: Number(amount).toFixed(2),
    currency: "BDT",
    tran_id: tranId,
    success_url: `${origin}/api/billing/callback?r=success`,
    fail_url: `${origin}/api/billing/callback?r=fail`,
    cancel_url: `${origin}/api/billing/callback?r=cancel`,
    ipn_url: `${origin}/api/billing/ipn`,
    product_name: `Autologic ${planName} (${cycle})`,
    product_category: "SaaS Subscription",
    product_profile: "non-physical-goods",
    shipping_method: "NO",
    num_of_item: 1,
    cus_name: customer?.name || "Autologic Customer",
    cus_email: customer?.email || "billing@autologic.app",
    cus_phone: customer?.phone || "01700000000",
    cus_add1: customer?.address || "Dhaka",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    value_a: customer?.clientId || "",
  });

  let json;
  try {
    const res = await fetch(urls.init, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    json = await res.json();
  } catch (e) {
    console.error("[sslcz] init failed:", e.message);
    return { ok: false, reason: "gateway_unreachable" };
  }

  if (json?.status === "SUCCESS" && json?.GatewayPageURL) {
    return { ok: true, url: json.GatewayPageURL, sessionkey: json.sessionkey || null };
  }
  console.error("[sslcz] init rejected:", json?.failedreason || json?.status);
  return { ok: false, reason: json?.failedreason || "gateway_rejected" };
}

// Server-side validation. The browser redirect and the raw IPN body are never
// trusted; only this response decides whether a plan is extended.
export async function validateTransaction(valId) {
  const { storeId, storePasswd, urls } = sslConfig();
  if (!storeId || !storePasswd) return { ok: false, reason: "gateway_not_configured" };
  if (!valId) return { ok: false, reason: "missing_val_id" };

  const q = new URLSearchParams({
    val_id: valId,
    store_id: storeId,
    store_passwd: storePasswd,
    format: "json",
    v: "1",
  });

  let json;
  try {
    const res = await fetch(`${urls.validate}?${q.toString()}`, { cache: "no-store" });
    json = await res.json();
  } catch (e) {
    console.error("[sslcz] validate failed:", e.message);
    return { ok: false, reason: "validator_unreachable" };
  }

  const status = json?.status;
  const paid = status === "VALID" || status === "VALIDATED";
  return {
    ok: paid,
    reason: paid ? null : status || "invalid",
    status: status || null,
    tranId: json?.tran_id || null,
    amount: Number(json?.amount || 0),
    currency: json?.currency || null,
    bankTranId: json?.bank_tran_id || null,
    cardType: json?.card_type || null,
    tranDate: json?.tran_date || null,
    riskLevel: json?.risk_level ?? null,
    raw: json || null,
  };
}

// Amount tolerance guards against gateway-side rounding, nothing more.
export function amountMatches(expected, got) {
  return Math.abs(Number(expected || 0) - Number(got || 0)) < 0.5;
}
