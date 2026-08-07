import Body from "../page-body.js";
export const metadata = { title: "m3 — Autologic preview", robots: { index: false, follow: false } };
export default function P({ searchParams }) {
  return <Body motion="m3" lang={searchParams?.lang === "bn" ? "bn" : "en"} />;
}
