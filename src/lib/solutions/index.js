// The marketing pages that answer one search each.
//
// Someone looking for this product does not type "TellMore AI" — they type
// "chatbot for facebook page", "whatsapp business auto reply", "ইনস্টাগ্রাম
// অটো রিপ্লাই". The home page cannot rank for all of those at once: a page
// ranks for what it is ABOUT, and the home page is about the product as a
// whole. So each of these is one page about one channel or one job, in both
// languages, linking back to pricing and the manual.
//
// Declared once here; the words live in ./en.js and ./bn.js (the same split the
// manual uses). A page with no copy in a language falls back to English, and
// only the languages that exist are offered to Google.

export const SOLUTIONS = [
  { slug: "facebook-messenger-chatbot", icon: "ti-brand-messenger", channel: "facebook" },
  { slug: "whatsapp-chatbot", icon: "ti-brand-whatsapp", channel: "whatsapp" },
  { slug: "instagram-dm-automation", icon: "ti-brand-instagram", channel: "instagram" },
  { slug: "website-chatbot", icon: "ti-world", channel: "website" },
  { slug: "ecommerce-chatbot", icon: "ti-shopping-cart", channel: "all" },
  { slug: "bangla-chatbot", icon: "ti-language", channel: "all" },
];

export const bySlug = (slug) => SOLUTIONS.find((s) => s.slug === slug) || null;

/** A page counts as written when it has a title and at least one section. */
export const isWritten = (page) => !!(page && page.title && page.sections?.length);
