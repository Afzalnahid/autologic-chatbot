// Which orders count as money taken. A cancelled order was never paid and a
// returned one was paid back, so neither is a sale. Overview already left them
// out of "Revenue today" while Analytics added every order, cancelled ones
// included, so the two screens disagreed (owner, 2026-10-02). Both read this.
export const NOT_A_SALE = ["Cancelled", "Returned"];

export function countsAsSale(order) {
  return !NOT_A_SALE.includes(String(order?.status || "Pending"));
}
