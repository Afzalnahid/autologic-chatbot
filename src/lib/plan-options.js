// Which packages a client may be moved onto, for the admin console's dropdown.
//
// This list used to be four ids written into admin-client.js — trial, starter,
// pro, agency. It meant a package the owner created in their own panel could
// never be assigned to anybody from it, and when the seven replaced those four
// the dropdown went on offering the old ones. Nothing failed; the new packages
// simply were not there.
//
// Three rules, and the first is the one that is easy to get wrong:
//
//   The client's CURRENT plan is always offered, whatever it is. A retired
//   package, or one belonging to the other business type, still has to appear
//   or the dropdown cannot show the value it is set to — and a select whose
//   value is not among its options renders blank, which reads as "no plan".
//
//   Retired packages are otherwise left out. They are kept in the table so an
//   account already on one keeps working, not so somebody can be moved onto
//   something withdrawn.
//
//   The other business type is left out for the reason the billing tab leaves
//   it out: a shop has no calendar to book into, a service has no catalogue to
//   match a photo against. A package with no type at all belongs to both.

export function planOptions(plans, current, biz = "ecommerce") {
  const all = Array.isArray(plans) ? plans : [];
  const list = all.filter((p) => p && (
    p.id === current
    || (p.active !== false && (!p.biz || p.biz === "both" || p.biz === biz))
  ));
  // Before the catalogue has loaded there is nothing to offer but what the
  // client is already on. An empty dropdown is worse than a short one.
  if (!list.length) return current ? [{ id: current, name: null, current: true }] : [];
  // Current first is deliberate: it is the one the reader is looking for.
  return list
    .map((p) => ({ id: p.id, name: p.name || null, current: p.id === current }))
    .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0));
}
