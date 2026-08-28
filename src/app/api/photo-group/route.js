export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { getClientAI } from "@/lib/ai.js";

// Which of these photographs are the same product?
//
// A shop photographs fifteen t-shirts and gets forty pictures: a front, a back
// and a detail shot of each. Treated as one photo per product that is forty
// products, thirty-nine of them wrong. Asked to sort them by hand it is forty
// drag-and-drops. So the descriptions the AI has already written are read back
// to it, all at once, and it says which ones belong together.
//
// No photos are sent here and no AI vision runs: /api/photo-draft has already
// described every picture and the browser is holding those descriptions. This
// is one cheap text call for a whole batch, however many chunks the photos went
// up in — which is the point, because photos are read six at a time and nothing
// can be grouped against a photo it never saw.
//
// It is told to be CAUTIOUS on purpose. Leaving two pictures of one shirt apart
// costs the owner one merge. Putting two different shirts together loses a
// product from the catalogue, and they may not notice for weeks.
export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const rl = rateLimit(`photo-group:${client.id}`, 60, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are grouping photos very quickly. Please wait a moment.");

    const body = await request.json().catch(() => ({}));
    const visuals = (Array.isArray(body.visuals) ? body.visuals : [])
      .map((v) => String(v || "").slice(0, 700));
    // Fewer than two descriptions cannot be grouped, and nothing worth an AI
    // call. Everything stands alone.
    const alone = visuals.map((_, i) => i + 1);
    if (visuals.filter(Boolean).length < 2) return NextResponse.json({ ok: true, groups: alone });

    const thing = client.item_label || (client.business_type === "agency" ? "service" : "product");
    const hint = String(body.hint || "").trim().slice(0, 80);

    // Seconds between each photograph and the one before it, in the order the
    // owner chose them. This is the strongest evidence there is and the model
    // had none of it: a front and a back shot of the same shirt are taken
    // seconds apart, and the next shirt goes on the hanger a minute later.
    // Given as evidence, not as a rule — someone who picks files out of order,
    // or whose phone rewrote the timestamps, must not have their catalogue
    // wrongly merged because of it.
    const gaps = (Array.isArray(body.gaps) ? body.gaps : []).map((g) => (Number.isFinite(Number(g)) ? Math.round(Number(g)) : null));

    const system = `You are sorting photographs for a shop in Bangladesh. Each numbered description below is ONE photograph. Several photographs may show the SAME ${thing} — a front view, a back view, a close-up of a print, the same garment on a hanger and on a model.

Put each photograph in a group. Photographs of the same ${thing} share a group number.

BE CAUTIOUS. If you are not sure two photographs are the same ${thing}, put them in DIFFERENT groups. Leaving them apart costs the owner one click to join them. Merging two different ${thing}s loses one from their catalogue and they may never notice.

Two photographs are the same ${thing} only when the item itself matches — same type, same colour, same print or pattern, same details. A different colour is a different ${thing} here, not a variation. Similar style is not enough.

${gaps.some((g) => g !== null) ? `WHEN EACH ONE WAS TAKEN is given below as the seconds since the previous photograph, and it is strong evidence. A shop photographs one ${thing} from the front and the back within a few seconds, then takes the next one off the rail — so a gap of a few seconds usually means the same ${thing} and a long gap usually means a new one. Weigh it together with what you see. It is evidence, not a rule: someone may have picked the files in any order.

` : ""}${hint ? `The owner calls these "${hint}", which tells you the kind of thing they are, NOT that they are all one ${thing}.\n\n` : ""}Answer with JSON only, one entry per photograph, in order:
{"groups":[{"n":1,"g":1},{"n":2,"g":1},{"n":3,"g":2}]}`;

    const ask = visuals.map((v, i) => {
      const g = gaps[i];
      const when = i === 0 ? "first" : g === null ? "time unknown" : g < 60 ? `${g}s after the previous` : `${Math.round(g / 60)} min after the previous`;
      return `Photograph ${i + 1} (${when}): ${v || "(could not be read)"}`;
    }).join("\n\n");

    const ai = await getClientAI(client.id, "product.group");
    const raw = await ai.chat(system, [{ role: "user", content: ask }]);
    const parsed = parse(raw);

    // Rebuilt rather than trusted. A photograph the model forgot, numbered
    // twice, or given a nonsense group must not silently take another
    // photograph with it — anything not clearly assigned stands alone.
    const groups = alone.slice();
    const used = new Set();
    for (const it of parsed) {
      const n = Number(it?.n), g = Number(it?.g);
      if (!Number.isFinite(n) || n < 1 || n > visuals.length) continue;
      if (!Number.isFinite(g) || used.has(`${n}`)) continue;
      used.add(`${n}`);
      // Group numbers are re-mapped into a space of their own so they can never
      // collide with the stand-alone numbers given above.
      groups[n - 1] = 1000 + g;
    }
    // A photograph that could not be read has no description to group on, so it
    // is always left by itself.
    visuals.forEach((v, i) => { if (!v) groups[i] = alone[i]; });

    return NextResponse.json({ ok: true, groups });
  } catch (e) {
    // Grouping is a convenience. If it fails the owner still has every photo as
    // its own product, which is exactly where they were before.
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function parse(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const j = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(j?.groups) ? j.groups : [];
  } catch { return []; }
}
