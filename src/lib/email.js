// Lightweight Resend email helper. Never throws — email failures must not
// break the signup/approval flow. Returns { ok, error }.

import { formatDhakaDate } from "@/lib/time.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Autologic <onboarding@resend.dev>";
const SUPER_ADMIN = "nahidafzal97@gmail.com";

async function send({ to, subject, html }) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html }),
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
    <div style="font-size:20px;font-weight:700;margin-bottom:4px">Autologic <span style="color:#f0c040">Admin</span></div>
    <div style="height:1px;background:#1a2744;margin:16px 0"></div>
    <div style="font-size:17px;font-weight:600;margin-bottom:12px">${title}</div>
    <div style="font-size:14px;line-height:1.7;color:#c9d3e6">${body}</div>
    <div style="height:1px;background:#1a2744;margin:20px 0"></div>
    <div style="font-size:12px;color:#8b9cbd">This is an automated message from the Autologic admin system.</div>
  </div>`;
}

// New admin signed up → notify the super admin.
export async function notifyNewAdminSignup(newEmail) {
  return send({
    to: SUPER_ADMIN,
    subject: "New admin access request — Autologic",
    html: wrap(
      "New admin access request",
      `<strong style="color:#f0c040">${newEmail}</strong> has signed up and is awaiting approval.
       <br/><br/>Open the <a href="https://www.getvoicium.com/admin" style="color:#f0c040">Admin panel</a>,
       enter your secret key, and assign them a role (Viewer, Editor, or Full Access) to approve — or leave them pending to deny.`
    ),
  });
}

// Super admin approved an admin → congratulate the new admin.
export async function notifyAdminApproved(adminEmail, role) {
  const labels = { full: "Full Access", editor: "Editor", viewer: "Viewer" };
  return send({
    to: adminEmail,
    subject: "You've been approved as an admin — Autologic",
    html: wrap(
      "🎉 Welcome to the Autologic admin team",
      `Your admin access has been approved with the role
       <strong style="color:#22c55e">${labels[role] || role}</strong>.
       <br/><br/>You can now sign in at the
       <a href="https://www.getvoicium.com/admin" style="color:#f0c040">Admin panel</a>
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
      `<strong style="color:#f0c040">${business}</strong> (${email}) submitted a payment.
       <br/><br/>
       Plan: <strong>${plan}</strong> (${cycle})<br/>
       Amount: <strong>৳${Number(amount).toLocaleString("en-IN")}</strong><br/>
       Method: <strong>${method}</strong><br/>
       Transaction ID: <strong>${txnId}</strong>
       <br/><br/>Verify the transaction, then approve it in the
       <a href="https://www.getvoicium.com/admin" style="color:#f0c040">Admin panel</a>.`
    ),
  });
}

// Payment verified — tell the client their plan is live.
export async function notifyPaymentApproved(clientEmail, planName, expiresAt) {
  const until = expiresAt ? formatDhakaDate(new Date(expiresAt)) : null;
  return send({
    to: clientEmail,
    subject: `Your ${planName} plan is active — Autologic`,
    html: wrap(
      "\u{1F389} Payment confirmed",
      `Your payment has been verified and your <strong style="color:#22c55e">${planName}</strong> plan is now active.
       ${until ? `<br/><br/>Valid until <strong>${until}</strong>.` : ""}
       <br/><br/>Open your <a href="https://www.getvoicium.com/dashboard" style="color:#f0c040">dashboard</a> to keep going.`
    ),
  });
}

// Payment could not be verified.
export async function notifyPaymentRejected(clientEmail, reason) {
  return send({
    to: clientEmail,
    subject: "We could not verify your payment — Autologic",
    html: wrap(
      "Payment not verified",
      `We could not verify your recent payment.${reason ? `<br/><br/>Reason: <strong>${reason}</strong>` : ""}
       <br/><br/>Please check the transaction ID and submit it again from your dashboard,
       or reply to this email and we'll help you sort it out.`
    ),
  });
}

const PLAN_LABEL = { trial: "Free Trial", starter: "Starter", pro: "Pro", agency: "Agency" };

// The bot has stopped answering customers for a billing reason.
export async function notifyBotBlocked(clientEmail, { business, reason, used, limit, plan }) {
  const detail = {
    trial_expired: {
      title: "Your free trial has ended",
      body: "Your 3-day trial is over, so your bot has stopped replying to customers.",
    },
    plan_expired: {
      title: "Your plan has expired",
      body: `Your ${PLAN_LABEL[plan] || plan} plan has expired, so your bot has stopped replying to customers.`,
    },
    quota_daily: {
      title: "Daily message limit reached",
      body: `You have used all ${limit} messages for today${used ? ` (${used} received)` : ""}. Your bot will resume tomorrow, or immediately on a paid plan.`,
    },
    quota_monthly: {
      title: "Monthly message limit reached",
      body: `You have used all ${limit ? limit.toLocaleString("en-IN") : ""} messages included in your ${PLAN_LABEL[plan] || plan} plan this month${used ? ` (${used.toLocaleString("en-IN")} received)` : ""}.`,
    },
    no_plan: {
      title: "No active plan",
      body: "There is no active plan on your account, so your bot is not replying to customers.",
    },
  }[reason] || { title: "Your bot has stopped replying", body: "Your bot is currently unable to reply to customers." };

  return send({
    to: clientEmail,
    subject: `Action needed: ${detail.title} — ${business}`,
    html: wrap(
      detail.title,
      `${detail.body}
       <br/><br/>
       <strong style="color:#f0c040">Customers messaging you right now are not getting answers.</strong>
       We are replying to them with a short holding message so they are not left waiting, but that is not a substitute for your bot.
       <br/><br/>
       <a href="https://www.getvoicium.com/dashboard#billing" style="display:inline-block;background:#f0c040;color:#0a0a0a;padding:11px 22px;border-radius:8px;font-weight:700;text-decoration:none">Upgrade now</a>
       <br/><br/>
       <span style="font-size:12px;color:#8b9cbd">You will get this reminder at most once a day.</span>`
    ),
  });
}

// Sent a few days before a trial or paid plan runs out.
export async function notifyExpiringSoon(clientEmail, { business, plan, daysLeft, expiresAt }) {
  const when = expiresAt ? formatDhakaDate(new Date(expiresAt)) : null;
  const isTrial = plan === "trial";
  return send({
    to: clientEmail,
    subject: `${isTrial ? "Your trial" : "Your plan"} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — ${business}`,
    html: wrap(
      `${isTrial ? "Trial" : PLAN_LABEL[plan] || plan} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      `Your ${isTrial ? "free trial" : `${PLAN_LABEL[plan] || plan} plan`} ends${when ? ` on <strong>${when}</strong>` : " soon"}.
       When it does, your bot will stop replying to customers.
       <br/><br/>
       ${isTrial
         ? "Pick a plan to keep everything running — your products, knowledge base and conversations all stay exactly as they are."
         : "Renew to keep your bot answering without a break."}
       <br/><br/>
       <a href="https://www.getvoicium.com/dashboard#billing" style="display:inline-block;background:#f0c040;color:#0a0a0a;padding:11px 22px;border-radius:8px;font-weight:700;text-decoration:none">${isTrial ? "Choose a plan" : "Renew now"}</a>`
    ),
  });
}
