// Who to write to, where the company is, and who makes it.
//
// These facts used to be typed out by hand wherever they were needed — the
// contact page, the privacy page, the terms page, Facebook's data-deletion
// page, three separate footers. Changing the support address meant finding
// every copy, and one that got missed would sit on a public page for months
// telling customers to write somewhere nobody reads.
//
// Everything here is taken from the registered business details, not from
// memory. The address the site carried before this (Kandirpar, Cumilla) was
// simply wrong.
//
// NOTE: the super admin's login identity is a different thing that happens to
// have been the same address. It lives in src/lib/admin-auth.js and must not be
// pointed here — changing it would lock the owner out of /admin.

export const COMPANY = {
  // The product, and the name on the site.
  name: "Autologic",

  // The company that owns it, as registered, with its own site.
  legalName: "Autolinium",
  parentUrl: "https://www.autolinium.com/",
  parentHost: "autolinium.com",

  // Support and sales. Everything a customer or Meta's reviewers can see.
  email: "office@autolinium.com",

  // Grouped for reading; the bare form is what a tel: link needs, because a
  // dialler will not accept the spaces.
  phone: "+880 1533 633084",
  phoneE164: "+8801533633084",

  street: "Chattogram Software Technology Park, Agrabad",
  city: "Chattogram",
  postalCode: "4200",
  country: "Bangladesh",

  // "an", not "a" — Autolinium opens on a vowel sound. The owner wrote "a
  // autolinium product"; this is the same sentence set correctly, because it
  // appears on every public page.
  madeBy: "An Autolinium product",
};

// The registered address in full, for the contact page and the legal pages.
export const ADDRESS_LINE =
  `${COMPANY.street}, ${COMPANY.city} ${COMPANY.postalCode}, ${COMPANY.country}`;

// The footers sit on one compact line beside the copyright, where the full
// registered address would wrap on a phone and crowd out everything else.
export const ADDRESS_SHORT = `${COMPANY.city}, ${COMPANY.country}`;

// One line for the bottom of every footer, so all three footers say the same
// thing in the same order.
export const COPYRIGHT = `© 2026 ${COMPANY.name} · ${COMPANY.madeBy}`;
