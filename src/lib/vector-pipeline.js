import { analyzeImage, generateEmbedding } from "./gemini.js";
import { upsertProductVector } from "./supabase.js";

export async function ingestProduct(product) {
  const id = String(product.id || Math.floor(100000 + Math.random() * 900000));
  const name = product.name || "";
  const categories = Array.isArray(product.categories)
    ? product.categories.map(c => (typeof c === "string" ? c : c.name)).join(", ")
    : String(product.categories || "Uncategorized");
  const description = (product.description || "").replace(/<[^>]*>/g, "").trim();

  let images = product.images || [];
  if (!Array.isArray(images)) images = [images];
  images = images.filter(
    img => img && ((img.src && String(img.src).startsWith("http")) || (img.file_id && img.file_id !== "null"))
  );

  let imageDescription = "";
  let imageUrl = "N/A";
  let productCode = "N/A";

  if (images.length > 0 && images[0].src && images[0].src.startsWith("http")) {
    imageUrl = images[0].src;
    try {
      const analysis = await analyzeImage(imageUrl, 
        "Analyze this product image. Extract: 1) A product code if visible. 2) A detailed visual description. Format: CODE: [code or N/A]\\nDESCRIPTION: [description]"
      );
      const codeMatch = analysis.match(/CODE:\s*(.+)/i);
      const descMatch = analysis.match(/DESCRIPTION:\s*([\s\S]+)/i);
      productCode = codeMatch?.[1]?.trim() || "N/A";
      imageDescription = descMatch?.[1]?.trim() || analysis;
    } catch (e) {
      console.error("Image analysis failed:", e.message);
      imageDescription = name + ". " + description;
    }
  } else {
    imageDescription = [name, description].filter(Boolean).join(". ") || "No description";
  }

  const vectorContent = `product code:${productCode}\nProduct Description:${imageDescription}`;

  const embedding = await generateEmbedding(vectorContent);

  const metadata = {
    product_id: id,
    product_name: name,
    category: categories,
    regular_price: String(product.regular_price || ""),
    sale_price: String(product.sale_price || ""),
    image_url: imageUrl,
    stock_status: product.stock_status || "instock",
    description: description,
    product_code: productCode,
  };

  await upsertProductVector(vectorContent, metadata, embedding);

  return { id, name, productCode, status: "success" };
}

export async function ingestProducts(products) {
  const results = [];
  for (const product of products) {
    try {
      const result = await ingestProduct(product);
      results.push(result);
    } catch (e) {
      results.push({ id: product.id, name: product.name, status: "error", error: e.message });
    }
  }
  return results;
}
