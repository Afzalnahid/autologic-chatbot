import { COMPANY, ADDRESS_LINE } from "@/lib/company.js";
import { rebrand } from "@/lib/white-label.js";

// The bottom line of every public footer: "© 2026 TellMore AI · An Autolinium
// product", with Autolinium linking to its own site, and the full registered
// address (owner, 2026-10-04: the word should open autolinium.com, and the
// footer should carry the whole address, not just "Chattogram, Bangladesh").
// One component, so the four footers cannot drift apart again.
//
// `brand` is a partner's white-label brand on their address (lib/white-label.js);
// the product name follows it, the maker does not change.

export function Copyright({ brand, linkStyle }) {
  const name = rebrand(COMPANY.name, brand);
  return <span>
    © 2026 {name} · An{" "}
    <a href={COMPANY.parentUrl} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3, ...linkStyle }}>{COMPANY.legalName}</a>
    {" "}product
  </span>;
}

export function FullAddress() {
  return <span>{ADDRESS_LINE}</span>;
}
