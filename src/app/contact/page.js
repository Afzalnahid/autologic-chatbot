import { pageMeta } from "@/lib/seo.js";
import { COMPANY } from "@/lib/company.js";
import SiteShell, { InfoCard } from "../site-shell.js";

export const metadata = pageMeta({
  title: "Contact — Autologic",
  description: "Reach the Autologic team for support, sales or general questions about the chatbot platform. We usually reply within 24 hours.",
  path: "/contact",
});

const link = { color: "var(--lp-acc)", textDecoration: "none" };

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
          <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a>
        </InfoCard>

        <InfoCard
          icon="ti-phone"
          label="Phone"
          note="During support hours. Outside them, email reaches us fastest."
        >
          {/* The dialler needs the number with nothing in it but digits; the
              spaced form is only for reading. */}
          <a href={`tel:${COMPANY.phoneE164}`} style={link}>{COMPANY.phone}</a>
        </InfoCard>

        <InfoCard icon="ti-map-pin" label="Address" note={COMPANY.country}>
          {COMPANY.street}, {COMPANY.city} {COMPANY.postalCode}
        </InfoCard>

        <InfoCard
          icon="ti-clock-hour-4"
          label="Support hours"
          note="The AI chatbot itself runs 24/7 — these are our human support hours."
        >
          Saturday – Thursday, 10:00 AM – 7:00 PM (GMT+6)
        </InfoCard>

        <InfoCard
          icon="ti-building"
          label="Company"
          note={
            <>
              Autologic is a product of {COMPANY.legalName}, our registered business.{" "}
              <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer" style={link}>
                {COMPANY.parentHost}
              </a>
            </>
          }
        >
          {COMPANY.legalName}
        </InfoCard>

        <InfoCard
          icon="ti-message-2"
          label="Existing customer?"
          note={
            <>
              Manage your channels, knowledge base and bookings anytime from your{" "}
              <a href="/dashboard" style={link}>Autologic dashboard</a>.
            </>
          }
        >
          Sign in to your dashboard
        </InfoCard>
      </div>
    </SiteShell>
  );
}
