export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { analyzeImage, generateEmbedding } from "@/lib/gemini.js";

const VISION_PROMPT = `You are an elite Master Jeweler and a Senior Product Cataloger. Your ONLY objective is to extract the microscopic physical characteristics of the jewelry item in the image to ensure a 100% perfect database match.

STRICT RULES:
1. BLIND SPOT: COMPLETELY IGNORE the background, the hand, the glove, the ring box (any color), logos on the box, background plants, and any text or watermarks.
2. SOLE FOCUS: Analyze ONLY the physical jewelry piece itself, as if under a jeweler's loupe.
3. NO GUESSWORK: Do not guess price, inventory status, or target audience. Technical descriptions only.

EXTRACT WITH 100% PRECISION:
* Category: exact item type (e.g., Women's Single Ring, Couple Ring Set, Men's Band).
* Metal Color & Finish.
* Primary Motif/Architecture (e.g., Criss-cross bypass, Butterfly, Floral Cluster, Geometric, Minimalist Solitaire).
* Gemstone Anatomy: exact cuts, arrangement and setting.
* Band/Shank details: width, plain or stone-set, twists or splits.

Output a single dense technical paragraph.`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const p = await request.json();
    if (!p?.product_name) return NextResponse.json({ error: "missing product" }, { status: 400 });

    let visual = "";
    if (p.image_url) {
      try { visual = await analyzeImage(p.image_url, VISION_PROMPT); } catch {}
    }
    const content = `Product Code: ${p.product_code}\nName: ${p.product_name}\n${visual || p.description || ""}`;
    const embedding = await generateEmbedding(content);

    const metadata = {
      client_id: String(client.id),
      product_id: p.product_id,
      product_code: p.product_code,
      product_name: p.product_name,
      category: p.category || "",
      regular_price: p.regular_price || "",
      sale_price: p.sale_price || "",
      stock_status: p.stock_status || "instock",
      image_url: p.image_url || "",
      description: p.description || "",
    };

    const { data: existing } = await supabase.from("products").select("id,metadata,client_id").limit(1000);
    const dupIds = (existing || []).filter(r => r.client_id === client.id && r.metadata?.product_code === p.product_code).map(r => r.id);
    for (const id of dupIds) await supabase.from("products").delete().eq("id", id);
    const { error } = await supabase.from("products").insert({ content, metadata, embedding, client_id: client.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, analyzed: !!visual });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
