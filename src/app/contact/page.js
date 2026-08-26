import { pageMeta } from "@/lib/seo.js";
import { COMPANY } from "@/lib/company.js";
import SiteShell, { InfoCard } from "../site-shell.js";

export const metadata = pageMeta({
  title: "Contact — Autologic",
  description: "Reach the Autologic team for support, sales or general questions about the chatbot platform. We usually reply within 24 hours.",
  path: "/contact",
});

export default function Contact() {
  return (
    <SiteShell
      eyebrow="Contact"
      title="Get in touch"
      lead="Have a question about Autologic, need help setting up, or want to talk about your business? We're here to help."
    >
      <div style={{ marginTop: 34 }}>
        <InfoCard
          icon="ti-mail"
          label="Email"
          note="For support, sales and general questions. We usually reply within 24 hours."
        >
          <a href={`mailto:${COMPANY.email}`} style={{ color: "var(--lp-acc)", textDecoration: "none" }}>
            {COMPANY.email}
          </a>
        </InfoCard>

        {/* Rendered only once there is a real number in company.js. An empty
            phone row is worse than none — it invites a call that goes nowhere. */}
        {COMPANY.phone && (
          <InfoCard icon="ti-phone" label="Phone" note="During support hours. Email reaches us fastest outside them.">
            <a href={`tel:${COMPANY.phone.replace(/[^\d+]/g, "")}`} style={{ color: "var(--lp-acc)", textDecoration: "none" }}>
              {COMPANY.phone}
            </a>
          </InfoCard>
        )}

        <InfoCard icon="ti-map-pin" label="Address" note={COMPANY.country}>
          {COMPANY.address}
        </InfoCard>

        <InfoCard
          icon="ti-clock-hour-4"
          label="Support hours"
          note="The AI chatbot itself runs 24/7 — these are our human support hours."
        >
          Saturday – Thursday, 10:00 AM – 7:00 PM (GMT+6)
        </InfoCard>

        <InfoCard
          icon="ti-message-2"
          label="Existing customer?"
          note={
            <>
              Manage your channels, knowledge base and bookings anytime from your{" "}
              <a href="/dashboard" style={{ color: "var(--lp-acc)", textDecoration: "none" }}>Autologic dashboard</a>.
            </>
          }
        >
          Sign in to your dashboard
        </InfoCard>
      </div>
    </SiteShell>
  );
}
