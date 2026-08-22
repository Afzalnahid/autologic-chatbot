export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { loadPlans } from "@/lib/plan-limits.js";

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
      name: p.name,
      tagline: p.tagline || "",
      monthly: Number(p.monthly) || 0,
      yearly: Number(p.yearly) || 0,
      highlight: !!p.highlight,
      features: Array.isArray(p.feature_list) && p.feature_list.length
        ? p.feature_list
        : (Array.isArray(p.features) ? p.features : []),
    }));
  // Name/colour lookup for badges (every plan, including hidden/trial).
  const meta = {};
  for (const p of Object.values(all)) meta[p.id] = { name: p.name };
  return NextResponse.json({ plans: list, meta }, { headers: { "Cache-Control": "public, max-age=30" } });
}
