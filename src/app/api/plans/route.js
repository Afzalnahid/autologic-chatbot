export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { loadPlans, loadUnits } from "@/lib/plan-limits.js";

// Public plan catalogue for the pricing page and the in-app upgrade tab. Reads
// the packages an admin manages in the database (falling back to the code
// catalogue when the table is empty or unreachable), so a package created or
// re-priced in the admin panel shows up for buyers without a deploy. Only
// active, public plans are returned. No auth: prices are public.
export async function GET() {
  const all = await loadPlans();
  const list = Object.values(all)
    .filter((p) => p.active !== false && p.public !== false)
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
    .map((p) => ({
      id: p.id,
      // Which business may buy this. A row written before the biz migration has
      // none, and everything downstream reads a missing value as "both" — a
      // package shown to everybody is a smaller mistake than one hidden from
      // the people it was written for.
      biz: p.biz || "both",
      name: p.name,
      tagline: p.tagline || "",
      monthly: Number(p.monthly) || 0,
      yearly: Number(p.yearly) || 0,
      // The lower price for a client running on their own AI key, when the
      // package sets one (null otherwise). Public: the pricing page shows it as
      // a "with your own AI key" figure, and the billing screen uses it once the
      // client actually has a key.
      byok_monthly: p.byok_monthly ?? null,
      byok_yearly: p.byok_yearly ?? null,
      highlight: !!p.highlight,
      // The countable allowances. The purchase screen's sliders run from one
      // package's numbers to the next (lib/pricing.js slidersFor), so the
      // screen needs them to draw the same range the server will check.
      messages_per_month: p.messages_per_month ?? null,
      max_products: p.max_products ?? null,
      max_kb_files: p.max_kb_files ?? null,
      max_assistant_per_month: p.max_assistant_per_month ?? null,
      features: Array.isArray(p.feature_list) && p.feature_list.length
        ? p.feature_list
        : (Array.isArray(p.features) ? p.features : []),
    }));
  // Name/colour lookup for badges (every plan, including hidden/trial).
  const meta = {};
  for (const p of Object.values(all)) meta[p.id] = { name: p.name };
  // The step prices for moving a package's numbers up or down. Public like
  // the packages; only those in use.
  const units = (await loadUnits())
    .filter((u) => u.active !== false)
    .map((u) => ({ kind: u.kind, name: u.name, step: Number(u.step) || 0, price: Number(u.price) || 0, biz: u.biz, sort: u.sort }));
  return NextResponse.json({ plans: list, meta, units }, { headers: { "Cache-Control": "public, max-age=30" } });
}
