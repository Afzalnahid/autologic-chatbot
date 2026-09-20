import PricingClient from "./pricing-client.js";
import { pageMeta, productJsonLd, jsonLdProps, breadcrumbJsonLd } from "@/lib/seo.js";
import { PLANS, PAID_PLANS, TRIAL_DAYS, lowestMonthly, formatMoney } from "@/lib/plans.js";

// Not marked bilingual: this page has no Bangla copy, unlike the home page.
export const metadata = pageMeta({
  title: "Pricing — TellMore AI AI Chatbot for Facebook, Instagram & WhatsApp",
  // Built from the price list: this sentence is the snippet Google prints under
  // the result, and a typed-in figure went stale there once.
  description: `Simple BDT pricing for Bangladeshi businesses. Start with a free ${TRIAL_DAYS}-day trial, then from ${formatMoney(lowestMonthly())}/month. Pay with bKash, Nagad or Rocket.`,
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
