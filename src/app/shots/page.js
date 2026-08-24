import { notFound } from "next/navigation";
import Studio from "./studio.js";

// Local-only route for taking documentation screenshots. See studio.js.
//
// The guard is deliberately the strictest one available: anything that is not
// a local `next dev` returns 404, so this never appears on a Vercel preview
// deployment either — not only on the live site. Screenshots are taken on the
// machine, and this page has no reason to exist anywhere else.
export const metadata = { title: "Screenshot studio", robots: { index: false, follow: false } };

export default function Shots({ searchParams }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Studio tab={searchParams?.tab || ""} theme={searchParams?.theme || ""} />;
}
