import { pageMeta } from "@/lib/seo.js";
import { COMPANY, ADDRESS_LINE } from "@/lib/company.js";
import SiteShell, { Section, Note } from "../site-shell.js";

export const metadata = pageMeta({
  title: "Privacy Policy — TellMore AI",
  description: "How TellMore AI collects, uses, stores and protects the data of the businesses on the platform and the customers who message them.",
  path: "/privacy",
});

// The wording below is unchanged from the previous version of this page except
// for the contact address. It is a legal document; this pass moved it onto the
// site's design, not into new language. The "Last updated" date is deliberately
// left where it was — moving it is the owner's decision, not a side effect of
// restyling.
export default function Privacy() {
  return (
    <SiteShell
      eyebrow="Legal"
      title="Privacy Policy"
      lead={`TellMore AI ("we", "our", "us") operates an AI-powered chatbot platform at tellmoreai.com. This Privacy Policy explains how we collect, use, store, and protect data.`}
      updated="September 3, 2026"
    >
      <Section title="1. Information We Collect">
        <p><strong>From clients (business owners):</strong> Email and business name at registration. Facebook, Instagram, and WhatsApp access tokens and account IDs when channels are connected. Google Calendar OAuth tokens (access token and refresh token) when a client connects their Google Calendar — used exclusively to check availability and create meeting events on that client's own calendar. Business logo, product catalogue, and knowledge base documents uploaded by the client.</p>
        <p><strong>From end users (customers):</strong> Messages sent through connected channels. Sender ID and public profile name as provided by the respective platform. Order or booking information provided during a conversation.</p>
      </Section>

      <Section title="2. Google Calendar Data — Limited Use Disclosure">
        <p>TellMore AI's use of data obtained from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>
        <p>When a client connects Google Calendar, we use that access only to:</p>
        <ul>
          <li>Check the client's calendar availability (free/busy) when a customer requests a meeting.</li>
          <li>Create calendar events with a Google Meet link on the client's behalf when a booking is confirmed.</li>
          <li>Send the Google Meet link to the customer via the connected messaging channel.</li>
        </ul>
        <p>We do <strong>not</strong> read, store, share, or use Google Calendar data for any purpose beyond the above. We do not use it for advertising, profiling, or any secondary purpose. When a client disconnects Google Calendar, all stored OAuth tokens are immediately deleted.</p>
        <p><strong>No Google user data is sent to any AI/ML model.</strong> Our AI features are powered by the Google Gemini API and operate only on the end-user chat messages sent through the connected channels. Google Workspace data obtained from the Google Calendar API — including calendar events and availability — is <strong>never</strong> transmitted to Gemini or to any other artificial intelligence or machine learning service, and is never used to develop, train, or improve any AI/ML model, whether our own or a third party's. Availability lookups are reduced to a simple free/busy result before any reply is generated, and events are written to the calendar one-directionally; at no point does calendar content enter an AI prompt.</p>
      </Section>

      <Section title="3. How We Use Data">
        <p>To deliver AI-generated replies to customer messages on behalf of connected businesses. To display conversations and analytics in the client dashboard. To store orders and bookings created during customer conversations. We do not sell personal data. We do not use customer messages or calendar data for advertising.</p>
      </Section>

      <Section title="4. Data Storage and Security">
        <p>All data is stored in Supabase (PostgreSQL) on AWS ap-southeast-2. Row-Level Security (RLS) policies ensure each client's data is fully isolated. Access tokens and OAuth credentials are stored server-side only and never exposed to browsers or other clients. HTTPS is enforced for all connections.</p>
      </Section>

      <Section title="5. Data Sharing">
        <p>Customer messages are processed by the Google Gemini API to generate AI replies, subject to Google's own terms for that API. Meta Graph API (Facebook, Instagram, WhatsApp) is used to send and receive messages. Google Calendar API is used to create events and check availability — its data is never sent to any AI/ML service (see Section 2). Supabase is used for database and file storage. No other third parties receive personal data.</p>
      </Section>

      <Section title="6. Data Retention and Deletion">
        <p>Clients can delete conversations and files from the dashboard at any time. Disconnecting a channel immediately stops all data processing for that channel. To request full deletion of your account and all associated data, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. All requests are honored within 30 days.</p>
      </Section>

      <Section title="7. Facebook and Instagram Data Deletion">
        <p>If you remove our app from Facebook or Instagram settings, we receive an automated deletion callback and delete all associated data automatically within 24 hours.</p>
      </Section>

      <Section title="8. Children's Privacy">
        <p>Our platform is intended for business use only and is not directed at children under 13. We do not knowingly collect personal data from children.</p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. The date at the top reflects the most recent revision. Continued use after changes constitutes acceptance.</p>
      </Section>

      <Section title="10. Contact">
        <p>{COMPANY.name} is operated by <strong>{COMPANY.legalName}</strong>, our registered business.</p>
        <p>
          {ADDRESS_LINE}<br />
          Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a><br />
          Phone: <a href={`tel:${COMPANY.phoneE164}`}>{COMPANY.phone}</a><br />
          Web: <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer">{COMPANY.parentHost}</a>
        </p>
      </Section>

      <Note>
        TellMore AI's use of information received from Google APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer"
          style={{ color: "var(--lp-acc)" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
      </Note>
    </SiteShell>
  );
}
