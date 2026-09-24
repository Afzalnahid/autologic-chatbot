// Lightweight Resend email helper. Never throws — email failures must not
// break the signup/approval flow. Returns { ok, error }.

import { formatDhakaDate } from "@/lib/time.js";
import { COMPANY } from "@/lib/company.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "TellMore AI <onboarding@resend.dev>";
const SUPER_ADMIN = "nahidafzal97@gmail.com";

// The product name as it appears at the top of an email, with the second word
// in the brand red — derived from COMPANY.name so a future rename carries here
// too. "TellMore AI" → "Tell" + "More AI" in red.
const BRAND_HTML = (() => {
  const m = COMPANY.name.match(/^(\w+?)(More\b.*|\s.*)$/i);
  return m ? `${m[1]}<span style="color:#7B1C3E">${m[2]}</span>` : COMPANY.name;
})();

async function send({ to, subject, html }) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      // reply_to: the footer says "just reply", so a reply must reach a real mailbox
      // whatever address RESEND_FROM sends from.
      body: JSON.stringify({ from: FROM, reply_to: COMPANY.email, to: Array.isArray(to) ? to : [to], subject, html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${t}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function wrap(title, body) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1529;border-radius:12px;padding:28px;color:#e8e8ec">
    <div style="font-size:20px;font-weight:700;margin-bottom:4px">TellMore AI <span style="color:#7B1C3E">Admin</span></div>
    <div style="height:1px;background:#1a2744;margin:16px 0"></div>
    <div style="font-size:17px;font-weight:600;margin-bottom:12px">${title}</div>
    <div style="font-size:14px;line-height:1.7;color:#c9d3e6">${body}</div>
    <div style="height:1px;background:#1a2744;margin:20px 0"></div>
    <div style="font-size:12px;color:#8b9cbd">This is an automated message from the TellMore AI admin system.</div>
  </div>`;
}

// The customer-facing wrapper. Same polished dark card, but branded "TellMore AI"
// (never "Admin") with a footer that speaks to a business owner, not an operator —
// a real reply-to and support address, and why they're getting the email. Client
// notifications (payment, trial/plan expiry, key/bot problems) use this; the
// internal admin ones above keep wrap().
function clientWrap(title, body) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1529;border-radius:12px;padding:28px;color:#e8e8ec">
    <!-- The name comes from COMPANY.name and is never typed here. The old brand
         survived a day past the rename in this one spot because it was written
         as two tags — a plain half and a coloured half — so searching for the
         name found nothing while clients kept receiving it (owner, 2026-09-18).
         tests/t-brand-name.mjs now fails on any surviving mention. -->
    <div style="font-size:22px;font-weight:800;margin-bottom:4px;color:#ffffff">${BRAND_HTML}</div>
    <div style="height:1px;background:#1a2744;margin:16px 0"></div>
    <div style="font-size:17px;font-weight:600;margin-bottom:12px">${title}</div>
    <div style="font-size:14px;line-height:1.7;color:#c9d3e6">${body}</div>
    <div style="height:1px;background:#1a2744;margin:22px 0"></div>
    <div style="font-size:12px;color:#8b9cbd;line-height:1.7">You're receiving this because you use TellMore AI at <a href="https://www.tellmoreai.com" style="color:#7B1C3E;text-decoration:none">tellmoreai.com</a>.<br/>Questions? Just reply to this email, or write to <a href="mailto:${COMPANY.email}" style="color:#7B1C3E;text-decoration:none">${COMPANY.email}</a>.</div>
  </div>`;
}

// New admin signed up → notify the super admin.
export async function notifyNewAdminSignup(newEmail) {
  return send({
    to: SUPER_ADMIN,
    subject: "New admin access request — TellMore AI",
    html: wrap(
      "New admin access request",
      `<strong style="color:#7B1C3E">${newEmail}</strong> has signed up and is awaiting approval.
       <br/><br/>Open the <a href="https://www.tellmoreai.com/admin" style="color:#7B1C3E">Admin panel</a>,
       enter your secret key, and assign them a role (Viewer, Editor, or Full Access) to approve — or leave them pending to deny.`
    ),
  });
}

// Super admin approved an admin → congratulate the new admin.
export async function notifyAdminApproved(adminEmail, role) {
  const labels = { full: "Full Access", editor: "Editor", viewer: "Viewer" };
  return send({
    to: adminEmail,
    subject: "You've been approved as an admin — TellMore AI",
    html: wrap(
      "🎉 Welcome to the TellMore AI admin team",
      `Your admin access has been approved with the role
       <strong style="color:#22c55e">${labels[role] || role}</strong>.
       <br/><br/>You can now sign in at the
       <a href="https://www.tellmoreai.com/admin" style="color:#7B1C3E">Admin panel</a>
       using the email and password you registered with.`
    ),
  });
}

// A client submitted a payment for review.
export async function notifyPaymentRequest({ business, email, plan, cycle, amount, method, txnId }) {
  return send({
    to: SUPER_ADMIN,
    subject: `Payment submitted: ${business} — ${plan}`,
    html: wrap(
      "New payment awaiting verification",
      `<strong style="color:#7B1C3E">${business}</strong> (${email}) submitted a payment.
       <br/><br/>
       Plan: <strong>${plan}</strong> (${cycle})<br/>
       Amount: <strong>৳${Number(amount).toLocaleString("en-IN")}</strong><br/>
       Method: <strong>${method}</strong><br/>
       Transaction ID: <strong>${txnId}</strong>
       <br/><br/>Verify the transaction, then approve it in the
       <a href="https://www.tellmoreai.com/admin" style="color:#7B1C3E">Admin panel</a>.`
    ),
  });
}

// Payment verified — tell the client their plan is live.
export async function notifyPaymentApproved(clientEmail, planName, expiresAt) {
  const until = expiresAt ? formatDhakaDate(new Date(expiresAt)) : null;
  return send({
    to: clientEmail,
    subject: `Your ${planName} plan is active — TellMore AI`,
    html: clientWrap(
      "\u{1F389} Payment confirmed",
      `Your payment has been verified and your <strong style="color:#22c55e">${planName}</strong> plan is now active.
       ${until ? `<br/><br/>Valid until <strong>${until}</strong>.` : ""}
       <br/><br/>Open your <a href="https://www.tellmoreai.com/dashboard" style="color:#7B1C3E">dashboard</a> to keep going.`
    ),
  });
}

// ── Business events, to the owner ───────────────────────────────────────────
// An order and a booking are money; a customer waiting for a person is a
// customer about to leave. One email each, on the event — no throttling, because
// missing one costs more than reading one. Push goes out too (push.js notify).
const dash = (tab) => `<a href="https://www.tellmoreai.com/dashboard#${tab}" style="color:#7B1C3E">dashboard</a>`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function notifyNewOrder(clientEmail, { customer, products, total, orderCode, platform }) {
  return send({
    to: clientEmail,
    subject: `New order${customer ? ` from ${customer}` : ""}${total ? ` — ৳${Number(total).toLocaleString("en-IN")}` : ""}`,
    html: clientWrap(
      "\u{1F6D2} New order",
      `<strong>${esc(customer || "A customer")}</strong> just ordered${platform ? ` on ${esc(platform)}` : ""}.
       <br/><br/>
       ${products ? `Items: <strong>${esc(products)}</strong><br/>` : ""}
       ${total ? `Total: <strong>৳${Number(total).toLocaleString("en-IN")}</strong><br/>` : ""}
       ${orderCode ? `Order: <strong>${esc(orderCode)}</strong><br/>` : ""}
       <br/>Open your ${dash("orders")} to confirm it.`
    ),
  });
}

export async function notifyNewBooking(clientEmail, { customer, service, date, time, platform }) {
  return send({
    to: clientEmail,
    subject: `New booking${customer ? ` — ${customer}` : ""}${date ? ` · ${date}${time ? " " + time : ""}` : ""}`,
    html: clientWrap(
      "\u{1F4C5} New booking",
      `<strong>${esc(customer || "A customer")}</strong> booked${service ? ` <strong>${esc(service)}</strong>` : ""}${platform ? ` via ${esc(platform)}` : ""}.
       <br/><br/>
       ${date ? `When: <strong>${esc(date)}${time ? " " + esc(time) : ""}</strong><br/>` : ""}
       <br/>See it in your ${dash("orders")}.`
    ),
  });
}

// A customer asked for a person (or the bot handed off). Sent once per
// hand-off — the flag flips false→true only once until the owner replies.
// Two different situations, and the difference matters to whoever reads it.
// Asking for a person: the bot has already reassured that customer. botFailed:
// the bot produced nothing, so NOTHING was sent — they are waiting in silence
// and do not know that anybody has seen their message.
export async function notifyNeedsHuman(clientEmail, { customer, preview, platform, botFailed }) {
  const who = esc(customer || "A customer");
  const where = platform ? ` on ${esc(platform)}` : "";
  const quote = preview ? `<br/><br/><em style="color:#c9d3e6">\u201C${esc(preview)}\u201D</em>` : "";
  return send({
    to: clientEmail,
    subject: botFailed
      ? `${customer || "A customer"} is waiting \u2014 your bot could not answer \u2014 TellMore AI`
      : `${customer || "A customer"} is waiting for you \u2014 TellMore AI`,
    html: botFailed
      ? clientWrap(
          "\u26A0\uFE0F Your bot could not answer",
          `<strong>${who}</strong>${where} wrote to you and the bot could not produce a reply, so <strong>nothing was sent to them</strong> \u2014 they were not told that anything is wrong.
           ${quote}
           <br/><br/>Please answer them yourself from your ${dash("conversations")}. Their message is saved and waiting there.
           <br/><br/>If this keeps happening, check your AI key and the replies left in your plan.`
        )
      : clientWrap(
          "\u{1F64B} A customer needs a person",
          `<strong>${who}</strong>${where} asked to talk to someone, and the bot has told them a team member will help.
           ${quote}
           <br/><br/>Please reply from your ${dash("conversations")} \u2014 they are waiting.`
        ),
  });
}

// Something the platform owner has to know about, by email as well as on the
// console's bell — the ones that cost money or block a client if they sit
// unread (src/lib/platform-events.js decides which).
export async function notifyPlatformEvent(adminEmail, { icon, label, title, body, client_name, kind }) {
  return send({
    to: adminEmail,
    subject: `${title}${client_name ? " — " + client_name : ""} — TellMore AI admin`,
    html: clientWrap(
      `${icon || ""} ${esc(label || title)}`,
      `<strong>${esc(title)}</strong>
       ${client_name ? `<br/><span style="color:#c9d3e6">${esc(client_name)}</span>` : ""}
       ${body ? `<br/><br/>${esc(body)}` : ""}
       <br/><br/>Open the <a href="https://www.tellmoreai.com/admin" style="color:#7B1C3E;text-decoration:none">admin console</a> to act on it.
       <br/><br/><span style="font-size:12px;color:#8b9cbd">Event: ${esc(kind || "")}</span>`
    ),
  });
}

// A connected channel's token stopped working: the bot can no longer see or
// answer messages there until the owner reconnects it.
export async function notifyChannelExpired(clientEmail, { business, platform, name }) {
  const label = { facebook: "Facebook Page", instagram: "Instagram account", whatsapp: "WhatsApp number" }[platform] || platform;
  return send({
    to: clientEmail,
    subject: `Your ${label} needs reconnecting — TellMore AI`,
    html: clientWrap(
      "⚠️ A channel disconnected",
      `The connection to your ${label}${name ? ` <strong>${esc(name)}</strong>` : ""} for <strong>${esc(business || "your business")}</strong> has expired, so the bot cannot answer customers there right now.
       <br/><br/>This happens when Facebook renews its permissions. Open your ${dash("channels")} and press <strong>Reconnect</strong> — it takes a few seconds and nothing else changes.`
    ),
  });
}

// Payment could not be verified.
export async function notifyPaymentRejected(clientEmail, reason) {
  return send({
    to: clientEmail,
    subject: "We could not verify your payment — TellMore AI",
    html: clientWrap(
      "Payment not verified",
      `We could not verify your recent payment.${reason ? `<br/><br/>Reason: <strong>${reason}</strong>` : ""}
       <br/><br/>Please check the transaction ID and submit it again from your dashboard,
       or reply to this email and we'll help you sort it out.`
    ),
  });
}

// A client's own AI key just stopped working, so their bot paused. Sent once
// when the key flips from working to failing (not for every message) — see
// markFailing in src/lib/ai.js.
export async function notifyKeyFailing(clientEmail, { business, provider, model, error }) {
  const prov = "Google AI";
  const safeErr = String(error || "").slice(0, 240).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  return send({
    to: clientEmail,
    subject: `Action needed: your AI key stopped working — ${business}`,
    html: clientWrap(
      "Your AI key stopped working",
      `Your bot runs on your own <strong>${prov}</strong> key${model ? ` (<strong>${model}</strong>)` : ""}, and it just failed —
       so your bot has <strong style="color:#7B1C3E">paused replying to customers</strong>.
       <br/><br/>Most often this means the key ran out of quota or credit, or its billing needs attention.
       ${safeErr ? `<br/><br/>What the provider returned:<br/><span style="font-size:12px;color:#8b9cbd">${safeErr}</span>` : ""}
       <br/><br/>Top up or fix billing with your provider, or paste a new key — your bot resumes automatically once the key works again.
       <br/><br/>
       <a href="https://www.tellmoreai.com/dashboard#ai" style="display:inline-block;background:#7B1C3E;color:#ffffff;padding:11px 22px;border-radius:8px;font-weight:700;text-decoration:none">Open AI Engine</a>
       <br/><br/><span style="font-size:12px;color:#8b9cbd">You'll get this once per outage, not for every message.</span>`
    ),
  });
}

// A readable name for a plan id, for the sentences these emails put in front of
// a customer. Every use is `PLAN_LABEL[plan] || plan`, so a package missing from
// here reaches them as its raw id — "your shop_growth plan has expired". This
// list held the three ids that were retired on 2026-08-31 and none of the seven
// that replaced them.
//
// Titled from the id rather than extended by hand, so a package the owner
// creates in the panel is never the one that reads like a database row. The
// named entries stay for the two whose title case is not what we call them.
const PLAN_LABEL = {
  trial: "Free Trial",
  shop_starter: "Shop Starter", shop_growth: "Shop Growth", shop_scale: "Shop Scale",
  svc_starter: "Service Starter", svc_growth: "Service Growth", svc_scale: "Service Scale",
  starter: "Starter", pro: "Pro", agency: "Agency",
};

const planLabel = (id) => PLAN_LABEL[id]
  || String(id || "").replace(/^svc_/, "service_").split(/[_-]/).filter(Boolean)
       .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
  || "plan";

// The bot has stopped answering customers for a billing reason.
export async function notifyBotBlocked(clientEmail, { business, reason, used, limit, plan }) {
  const detail = {
    trial_expired: {
      title: "Your free trial has ended",
      body: "Your 3-day trial is over, so your bot has stopped replying to customers.",
    },
    plan_expired: {
      title: "Your plan has expired",
      body: `Your ${planLabel(plan)} plan has expired, so your bot has stopped replying to customers.`,
    },
    quota_daily: {
      title: "Daily message limit reached",
      body: `You have used all ${limit} messages for today${used ? ` (${used} received)` : ""}. Your bot will resume tomorrow, or immediately on a paid plan.`,
    },
    quota_channel: {
      title: "One channel reached its message limit",
      body: `This channel has used all ${limit ? Number(limit).toLocaleString("en-IN") : ""} messages allowed on it this month${used ? ` (${Number(used).toLocaleString("en-IN")} received)` : ""}. Your other channels keep working.`,
    },
    quota_monthly: {
      title: "Monthly message limit reached",
      body: `You have used all ${limit ? limit.toLocaleString("en-IN") : ""} messages included in your ${planLabel(plan)} plan this month${used ? ` (${used.toLocaleString("en-IN")} received)` : ""}.`,
    },
    no_plan: {
      title: "No active plan",
      body: "There is no active plan on your account, so your bot is not replying to customers.",
    },
  }[reason] || { title: "Your bot has stopped replying", body: "Your bot is currently unable to reply to customers." };

  return send({
    to: clientEmail,
    subject: `Action needed: ${detail.title} — ${business}`,
    html: clientWrap(
      detail.title,
      `${detail.body}
       <br/><br/>
       <strong style="color:#7B1C3E">Customers messaging you right now are not getting answers.</strong>
       They are not told why — your bot simply stays silent, so nothing tells a customer that a subscription has lapsed.
       Every message they send is still saved, and it will be waiting in your inbox the moment you renew.
       <br/><br/>
       <a href="https://www.tellmoreai.com/dashboard#billing" style="display:inline-block;background:#7B1C3E;color:#ffffff;padding:11px 22px;border-radius:8px;font-weight:700;text-decoration:none">Upgrade now</a>
       <br/><br/>
       <span style="font-size:12px;color:#8b9cbd">You will get this reminder at most once a day.</span>`
    ),
  });
}

// Sent twice before a trial or paid plan runs out: once on entering the last few
// days, and again on the final day. `final` picks the second wording — the same
// email counting down to "0 days" reads like a broken template at the exact
// moment it most needs to be taken seriously.
export async function notifyExpiringSoon(clientEmail, { business, plan, daysLeft, expiresAt, final }) {
  const when = expiresAt ? formatDhakaDate(new Date(expiresAt)) : null;
  const isTrial = plan === "trial";
  const thing = isTrial ? "trial" : "plan";
  const label = isTrial ? "Trial" : planLabel(plan);
  const inWords = final || daysLeft <= 0
    ? "ends today"
    : daysLeft === 1 ? "ends tomorrow" : `ends in ${daysLeft} days`;

  return send({
    to: clientEmail,
    subject: final || daysLeft <= 0
      ? `Last day — your ${thing} ends today, ${business}`
      : `Your ${thing} ${inWords} — ${business}`,
    html: clientWrap(
      `${label} ${inWords}`,
      `${final || daysLeft <= 0
        ? `Today is the last day of your ${isTrial ? "free trial" : `${label} plan`}${when ? ` (${when})` : ""}. <strong style="color:#7B1C3E">After today your bot stops replying to customers.</strong>`
        : `Your ${isTrial ? "free trial" : `${label} plan`} ends${when ? ` on <strong>${when}</strong>` : " soon"}. When it does, your bot will stop replying to customers.`}
       <br/><br/>
       ${isTrial
         ? "Pick a plan to keep everything running — your products, knowledge base and conversations all stay exactly as they are."
         : "Renew to keep your bot answering without a break."}
       <br/><br/>
       <a href="https://www.tellmoreai.com/dashboard#billing" style="display:inline-block;background:#7B1C3E;color:#ffffff;padding:11px 22px;border-radius:8px;font-weight:700;text-decoration:none">${isTrial ? "Choose a plan" : "Renew now"}</a>`
    ),
  });
}
