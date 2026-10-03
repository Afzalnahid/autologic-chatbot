import { COMPANY, ADDRESS_LINE, SOCIAL } from "@/lib/company.js";
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

// TellMore AI on Facebook and Instagram. Not shown on a partner's white-label
// address (the caller decides): those are TellMore's own profiles.
export function SocialIcons({ size = 18, color = "inherit", gap = 12 }) {
  const a = { color, display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 14, height: size + 14, borderRadius: 9, textDecoration: "none" };
  return <span style={{ display: "inline-flex", gap }}>
    <a href={SOCIAL.facebook} target="_blank" rel="noopener" aria-label="TellMore AI on Facebook" title="Facebook" style={a}><i className="ti ti-brand-facebook" style={{ fontSize: size }} /></a>
    <a href={SOCIAL.instagram} target="_blank" rel="noopener" aria-label="TellMore AI on Instagram" title="Instagram" style={a}><i className="ti ti-brand-instagram" style={{ fontSize: size }} /></a>
    <a href={SOCIAL.messenger} target="_blank" rel="noopener" aria-label="Chat with TellMore AI on Messenger" title="Messenger" style={a}><i className="ti ti-brand-messenger" style={{ fontSize: size }} /></a>
  </span>;
}
