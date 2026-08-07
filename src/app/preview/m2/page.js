import Body from "../page-body.js";
export const metadata = { title: "m2 — Autologic preview", robots: { index: false, follow: false } };
export default function P({ searchParams }) {
  return <Body motion="m2" lang={searchParams?.lang === "bn" ? "bn" : "en"} />;
}
