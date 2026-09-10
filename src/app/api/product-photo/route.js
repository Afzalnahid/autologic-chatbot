export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { uploadProductImage } from "@/lib/products.js";
import { withErrors } from "@/lib/route-errors.js";

// Upload ONE product photo and hand back its public URL.
//
// Why this exists: the add-product routes used to receive every photo of a
// product in one request, and the platform refuses any request over ~4.5 MB at
// the edge — before our code runs, so the dashboard could only say "network".
// Twelve phone photos are far more than that. Sending each photo here on its
// own keeps every request small, and add-product then receives plain URLs,
// which it already accepts.
//
// The file lands exactly where uploadProductImage puts every product photo
// (`<clientId>/<file>` in product-images), so the delete-cleanup guard in
// products.js recognises it and removes it with the product.
const MAX_BYTES = 3_500_000;

export const POST = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!file || typeof file === "string" || !file.size) {
    return NextResponse.json({ error: "No photo was attached." }, { status: 400 });
  }
  if (!String(file.type || "").startsWith("image/")) {
    return NextResponse.json({ error: "Only image files can be product photos." }, { status: 400 });
  }
  // A photo this large means the browser could not shrink it. Say so rather
  // than let the platform refuse the request with no explanation.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "This photo is too large to upload. Please re-attach it so it can be shrunk, or pick a smaller one." }, { status: 413 });
  }

  const url = await uploadProductImage(client.id, file);
  if (!url) return NextResponse.json({ error: "The photo could not be saved. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, url });
}, "product-photo");
