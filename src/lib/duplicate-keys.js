// How two products are judged to be the same thing.
//
// Split out of duplicates.js because that file reaches for supabase and
// node:crypto and so can only run on the server, while the dashboard needs the
// same rules to point at the twins a catalogue is already carrying. One copy of
// the rule, two places that ask it — the alternative is a browser that
// disagrees with the server about what a duplicate is.

// Case, punctuation and spacing carry no meaning in a product name typed twice
// by the same person on two different days.
export function nameKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const codeKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
