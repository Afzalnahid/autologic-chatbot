import PricingClient from "./pricing-client.js";

export const metadata = {
  title: "Pricing — Autologic AI Chatbot for Facebook, Instagram & WhatsApp",
  description: "Simple BDT pricing for Bangladeshi businesses. Start with a free 3-day trial, then from ৳1,500/month. Pay with bKash, Nagad or Rocket.",
};

export default function PricingPage() {
  return <PricingClient />;
}
