// Lightweight Resend email helper. Never throws — email failures must not
// break the signup/approval flow. Returns { ok, error }.

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
       <br/><br/>Open the <a href="https://autologic-chatbot.vercel.app/admin" style="color:#f0c040">Admin panel</a>,
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
       <a href="https://autologic-chatbot.vercel.app/admin" style="color:#f0c040">Admin panel</a>
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
       <a href="https://autologic-chatbot.vercel.app/admin" style="color:#f0c040">Admin panel</a>.`
    ),
  });
}

// Payment verified — tell the client their plan is live.
export async function notifyPaymentApproved(clientEmail, planName, expiresAt) {
  const until = expiresAt ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  return send({
    to: clientEmail,
    subject: `Your ${planName} plan is active — Autologic`,
    html: wrap(
      "\u{1F389} Payment confirmed",
      `Your payment has been verified and your <strong style="color:#22c55e">${planName}</strong> plan is now active.
       ${until ? `<br/><br/>Valid until <strong>${until}</strong>.` : ""}
       <br/><br/>Open your <a href="https://autologic-chatbot.vercel.app/dashboard" style="color:#f0c040">dashboard</a> to keep going.`
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
