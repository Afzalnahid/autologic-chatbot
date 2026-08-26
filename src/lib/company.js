// Who to write to, where the company is, and who makes it.
//
// These facts used to be typed out by hand wherever they were needed — the
// contact page, the privacy page, the terms page, Facebook's data-deletion
// page, three separate footers. Changing the support address meant finding
// every copy, and one that got missed would sit on a public page for months
// telling customers to write somewhere nobody reads.
//
// NOTE: the super admin's login identity is a different thing that happens to
// have been the same address. It lives in src/lib/admin-auth.js and must not be
// pointed here — changing it would lock the owner out of /admin.

export const COMPANY = {
  name: "Autologic",

  // Support and sales. Everything a customer or Meta's reviewers can see.
  email: "office@autolinium.com",

  // Empty until there is a real number to publish. The contact page renders a
  // phone row only when this is filled in, so adding one is a single edit here
  // and nothing has to be wired up. It was described as being in the
  // screenshots the owner sent, but none of them carried a number, and a wrong
  // phone number on a public page sends customers to a stranger.
  phone: "",

  address: "Kandirpar, Cumilla",
  country: "Bangladesh",

  // "an", not "a" — Autolinium opens on a vowel sound. The owner wrote "a
  // autolinium product"; this is the same sentence set correctly, because it
  // appears on every public page.
  madeBy: "An Autolinium product",
};

export const ADDRESS_LINE = `${COMPANY.address}, ${COMPANY.country}`;

// One line for the bottom of every footer, so all three footers say the same
// thing in the same order.
export const COPYRIGHT = `© 2026 ${COMPANY.name} · ${COMPANY.madeBy}`;
