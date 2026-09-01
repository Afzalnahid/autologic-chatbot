import { pageMeta } from "@/lib/seo.js";
import { COMPANY, ADDRESS_LINE } from "@/lib/company.js";
import SiteShell, { Section } from "../site-shell.js";

export const metadata = pageMeta({
  title: "Terms of Service — getvoicium",
  description: "The terms that govern the use of getvoicium, an AI customer service chatbot platform for businesses in Bangladesh.",
  path: "/terms",
});

// As with the privacy page: the wording is unchanged apart from the contact
// address, and the "Last updated" date is left alone on purpose.
export default function Terms() {
  return (
    <SiteShell
      eyebrow="Legal"
      title="Terms of Service"
      lead={`These Terms of Service ("Terms") govern your use of getvoicium ("we", "our", "us"), an AI-powered customer service chatbot platform operated at getvoicium.com. By creating an account or using the platform, you agree to these Terms.`}
      updated="July 18, 2026"
    >
      <Section title="1. The Service">
        <p>getvoicium provides an AI-powered chatbot platform that businesses ("clients") connect to their messaging channels (Facebook, Instagram, WhatsApp) and optionally their Google Calendar to automate customer service, meeting scheduling, and order management.</p>
      </Section>

      <Section title="2. Account Registration">
        <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your login credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized access at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
      </Section>

      <Section title="3. Acceptable Use">
        <p>You may only connect messaging channels and Google accounts that you own or are legally authorized to manage. You agree not to use the platform to send spam, harassing messages, illegal content, or content that violates Meta Platform Terms, WhatsApp Business Policy, or Google API Terms of Service. Violations may result in immediate account termination.</p>
      </Section>

      <Section title="4. Google Calendar Integration">
        <p>When you connect your Google Calendar, you authorize getvoicium to check your calendar availability and create meeting events with Google Meet links on your behalf. This access is used solely to automate meeting scheduling for your customers. You may disconnect your Google Calendar at any time from your profile settings, which will immediately revoke our access and delete your stored tokens.</p>
      </Section>

      <Section title="5. Trial and Paid Plans">
        <p>Free trials are provided with message and feature limits as described at signup. Paid plans are billed as agreed at the time of purchase. We reserve the right to modify plan features or pricing with reasonable advance notice. No refunds are provided for partial billing periods unless required by applicable law.</p>
      </Section>

      <Section title="6. Data and Privacy">
        <p>Data handling is described in detail in our <a href="/privacy">Privacy Policy</a>. You retain ownership of your business data, including uploaded files, product catalogues, and customer conversations. We may permanently delete data associated with terminated or inactive accounts after 30 days notice.</p>
      </Section>

      <Section title="7. Intellectual Property">
        <p>getvoicium and its underlying technology remain our intellectual property. You are granted a limited, non-exclusive, non-transferable license to use the platform for your business purposes. You may not copy, reverse-engineer, or resell any part of the platform without written permission.</p>
      </Section>

      <Section title="8. Service Availability">
        <p>We strive to maintain high availability but do not guarantee uninterrupted service. The platform is provided "as is" without warranties of any kind. We are not liable for any downtime caused by third-party services (Meta, Google, Supabase, Vercel) or circumstances beyond our control.</p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>To the maximum extent permitted by applicable law, our total liability to you for any claim arising from your use of the platform is limited to the fees you paid in the three months preceding the claim. We are not liable for indirect, incidental, or consequential damages.</p>
      </Section>

      <Section title="10. Termination">
        <p>You may terminate your account at any time by contacting us. We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice depending on the severity of the violation.</p>
      </Section>

      <Section title="11. Changes to Terms">
        <p>We may update these Terms from time to time. The "Last updated" date reflects the most recent revision. Continued use of the platform after changes constitutes your acceptance of the updated Terms.</p>
      </Section>

      <Section title="12. Governing Law">
        <p>These Terms are governed by the laws of Bangladesh. Any disputes shall be resolved in the courts of Dhaka, Bangladesh.</p>
      </Section>

      <Section title="13. Contact">
        <p>{COMPANY.name} is operated by <strong>{COMPANY.legalName}</strong>, our registered business.</p>
        <p>
          {ADDRESS_LINE}<br />
          Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a><br />
          Phone: <a href={`tel:${COMPANY.phoneE164}`}>{COMPANY.phone}</a><br />
          Web: <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer">{COMPANY.parentHost}</a>
        </p>
      </Section>
    </SiteShell>
  );
}
