import PricingClient from "./pricing-client.js";
import { pageMeta } from "@/lib/seo.js";

// Not marked bilingual: this page has no Bangla copy, unlike the home page.
export const metadata = pageMeta({
  title: "Pricing — TellMore AI AI Chatbot for Facebook, Instagram & WhatsApp",
  description: "Simple BDT pricing for Bangladeshi businesses. Start with a free 3-day trial, then from ৳1,500/month. Pay with bKash, Nagad or Rocket.",
  path: "/pricing",
});

export default function PricingPage() {
  return <PricingClient />;
}
