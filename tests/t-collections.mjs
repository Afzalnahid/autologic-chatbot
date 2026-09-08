// Category overviews: activeCollections turns the owner's saved list into the
// clean set the bot may send on a broad question. A row only counts when it has
// a category AND a real http cover image; the intro is optional; a category set
// twice keeps the last one.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BOT = join(here, "..", "src", "lib", "bot.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const { activeCollections } = await loadPure(BOT, "tmp-collections.mjs");

// Nothing set → nothing sent.
ok("no settings → empty", activeCollections().length === 0);
ok("empty object → empty", activeCollections({}).length === 0);
ok("collections not an array → empty", activeCollections({ collections: "x" }).length === 0);

// A complete row survives, trimmed.
const one = activeCollections({ collections: [{ category: "  Power Bank ", cover_url: "https://x/p.png", intro: "  Solar power banks  " }] });
ok("one valid row kept", one.length === 1);
ok("category trimmed", one[0].category === "Power Bank");
ok("intro trimmed", one[0].intro === "Solar power banks");
ok("cover kept", one[0].cover_url === "https://x/p.png");

// Intro is optional — the image alone is the point.
ok("no intro still valid", activeCollections({ collections: [{ category: "Bags", cover_url: "https://x/b.jpg" }] }).length === 1);

// A row missing the essentials is dropped.
ok("no category → dropped", activeCollections({ collections: [{ cover_url: "https://x/p.png" }] }).length === 0);
ok("no cover → dropped", activeCollections({ collections: [{ category: "Shoes", intro: "nice" }] }).length === 0);
ok("non-http cover → dropped", activeCollections({ collections: [{ category: "Shoes", cover_url: "ftp://x/p.png" }] }).length === 0);
ok("blank cover → dropped", activeCollections({ collections: [{ category: "Shoes", cover_url: "   " }] }).length === 0);

// Same category twice → last one wins (owner edited it), not two cards.
const dup = activeCollections({ collections: [
  { category: "Power Bank", cover_url: "https://x/old.png", intro: "old" },
  { category: "power bank", cover_url: "https://x/new.png", intro: "new" },
] });
ok("duplicate category deduped", dup.length === 1);
ok("last duplicate wins", dup[0].cover_url === "https://x/new.png" && dup[0].intro === "new");

// A mixed list keeps only the good rows, in order.
const mixed = activeCollections({ collections: [
  { category: "A", cover_url: "https://x/a.png" },
  { category: "", cover_url: "https://x/bad.png" },
  { category: "B", cover_url: "https://x/b.png" },
] });
ok("mixed list keeps 2", mixed.length === 2 && mixed[0].category === "A" && mixed[1].category === "B");

// Never throws on junk.
ok("null entries don't throw", activeCollections({ collections: [null, undefined, 5] }).length === 0);

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
