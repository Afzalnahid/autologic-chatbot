import Body from "../page-body.js";
export const metadata = { title: "m1 — Autologic preview", robots: { index: false, follow: false } };
export default function P({ searchParams }) {
  return <Body motion="m1" lang={searchParams?.lang === "bn" ? "bn" : "en"} />;
}
