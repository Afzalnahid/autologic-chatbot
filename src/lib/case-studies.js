// Case studies shown on the landing page. Adding one is a new object here —
// never a new page or a new component.
//
// HOW TO PUBLISH ONE
// Replace every TODO_ value below with a real, verified figure. Any entry that
// still contains a TODO_ token is filtered out of the production site
// automatically (see `publishedCaseStudies`), so an unfinished case study can
// never ship by accident. On preview deployments they stay visible, marked, so
// the layout can be reviewed.

export const PLACEHOLDER = "TODO_";

export const CASE_STUDIES = [
  {
    id: "ecom-1",
    business: "TODO_BUSINESS_NAME",
    businessType: "ecommerce",
    // Shown under the name, e.g. "Online fashion store · Dhaka"
    subtitle: "TODO_CATEGORY_AND_CITY",
    channels: "Facebook & Instagram",
    metrics: [
      { label: "Customer messages answered by the bot", value: "TODO_METRIC" },
      { label: "Average first reply time", value: "TODO_METRIC" },
      { label: "Orders captured through chat", value: "TODO_METRIC" },
    ],
    story:
      "TODO_STORY — one paragraph, in the owner's words where possible: what the " +
      "shop was doing before Autologic (who answered messages, and when), what " +
      "changed after the bot went live, and the single result that mattered most " +
      "to them. Keep every number identical to the metrics above.",
  },
  {
    id: "agency-1",
    business: "TODO_BUSINESS_NAME",
    businessType: "agency",
    subtitle: "TODO_SERVICE_AND_CITY",
    channels: "Facebook & WhatsApp",
    metrics: [
      { label: "Enquiries handled without staff", value: "TODO_METRIC" },
      { label: "Meetings booked straight to Calendar", value: "TODO_METRIC" },
      { label: "Time saved each week", value: "TODO_METRIC" },
    ],
    story:
      "TODO_STORY — one paragraph: how enquiries and appointments were handled " +
      "before, what the bot now does end to end (answering service questions, " +
      "checking availability, booking the meeting), and the result the owner " +
      "cares about. Keep every number identical to the metrics above.",
  },
];

export const TYPE_LABEL = {
  ecommerce: "Online shop",
  agency: "Service business",
};

// True when any field still carries a placeholder token.
export function isPlaceholder(cs) {
  return JSON.stringify(cs || {}).includes(PLACEHOLDER);
}

// What the public site is allowed to show.
export function publishedCaseStudies() {
  return CASE_STUDIES.filter((cs) => !isPlaceholder(cs));
}
