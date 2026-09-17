import PricingClient from "./pricing-client.js";
import { pageMeta, productJsonLd, jsonLdProps, breadcrumbJsonLd } from "@/lib/seo.js";
import { PLANS, PAID_PLANS, TRIAL_DAYS } from "@/lib/plans.js";

// Not marked bilingual: this page has no Bangla copy, unlike the home page.
export const metadata = pageMeta({
  title: "Pricing — TellMore AI AI Chatbot for Facebook, Instagram & WhatsApp",
  description: "Simple BDT pricing for Bangladeshi businesses. Start with a free 3-day trial, then from ৳1,500/month. Pay with bKash, Nagad or Rocket.",
  path: "/pricing",
});

export default function PricingPage() {
  // The price list Google is shown is the same object the page renders from,
  // so a price can never be right on the page and stale in the results.
  const plans = PAID_PLANS.map((id) => PLANS[id]).filter(Boolean);
  return (
    <>
      <script {...jsonLdProps(productJsonLd({ plans, trialDays: TRIAL_DAYS }))} />
      <script {...jsonLdProps(breadcrumbJsonLd([{ name: "TellMore AI", path: "/" }, { name: "Pricing", path: "/pricing" }]))} />
      <PricingClient />
    </>
  );
}
