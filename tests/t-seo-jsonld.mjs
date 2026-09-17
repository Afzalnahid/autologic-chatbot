// Structured data is what turns a plain blue link into a result with a price
// range, a breadcrumb trail and questions that open in place. Google drops the
// whole block on one malformed field, and nobody would notice — so the shapes
// are checked here, against the real plan catalogue.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { productJsonLd, faqJsonLd, breadcrumbJsonLd, jsonLdProps, SITE } =
  await loadPure(join(here, "..", "src", "lib", "seo.js"), "tmp-seo.mjs");
const { PLANS, PAID_PLANS, TRIAL_DAYS } =
  await import(pathToFileURL(join(here, "..", "src", "lib", "plans.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const plans = PAID_PLANS.map((id) => PLANS[id]).filter(Boolean);
const product = productJsonLd({ plans, trialDays: TRIAL_DAYS });
const offers = product.offers;

ok("the product is a SoftwareApplication with the site's organisation as publisher",
  product["@type"] === "SoftwareApplication" && product.publisher["@id"].includes("#organization"));
ok("every price is in BDT", offers.priceCurrency === "BDT" && offers.offers.every((o) => o.priceCurrency === "BDT"));
ok("the low price is the cheapest real plan", offers.lowPrice === Math.min(...plans.map((p) => p.monthly)));
ok("the high price is the dearest", offers.highPrice === Math.max(...plans.map((p) => p.monthly)));
ok("no free or zero-price offer slips into the list", offers.offers.every((o) => o.price > 0));
ok("offerCount matches the offers actually listed", offers.offerCount === offers.offers.length);
ok("each offer says it is a monthly price",
  offers.offers.every((o) => o.priceSpecification.unitText === "MONTH" && o.priceSpecification.price === o.price));
ok("each offer carries the plan's own name", offers.offers.some((o) => o.name === PLANS.shop_starter.name));
ok("the offers point at the pricing page", offers.offers.every((o) => o.url === `${SITE}/pricing`));

const faq = faqJsonLd([
  { q: "Does it work in Bangla?", a: "Yes." },
  { q: "", a: "dropped" },
  { q: "no answer" },
]);
ok("only complete question/answer pairs are published", faq.mainEntity.length === 1);
ok("the FAQ shape is what Google documents",
  faq["@type"] === "FAQPage" && faq.mainEntity[0]["@type"] === "Question" && faq.mainEntity[0].acceptedAnswer.text === "Yes.");
ok("a page with no questions gets no FAQ block", faqJsonLd([]) === null && faqJsonLd(undefined) === null);
ok("at most 20 questions are sent",
  faqJsonLd(Array.from({ length: 30 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }))).mainEntity.length === 20);

const crumbs = breadcrumbJsonLd([{ name: "TellMore AI", path: "/" }, { name: "Manual", path: "/docs" }]);
ok("breadcrumb positions start at 1 and are absolute URLs",
  crumbs.itemListElement[0].position === 1 && crumbs.itemListElement[1].item === `${SITE}/docs`);

const props = jsonLdProps({ a: "</script><script>alert(1)</script>" });
ok("a closing tag inside the data cannot break out of the script",
  !props.dangerouslySetInnerHTML.__html.includes("</script>") && props.type === "application/ld+json");
ok("the payload is still valid JSON after escaping",
  JSON.parse(props.dangerouslySetInnerHTML.__html.replace(/\\u003c/g, "<")).a.includes("alert(1)"));

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
