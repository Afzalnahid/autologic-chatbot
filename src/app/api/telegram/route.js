import { NextResponse } from "next/server";
import { parseTelegramUpdate, sendTelegramMessage, sendChatAction, getFileUrl, PRODUCT_TEMPLATE } from "@/lib/telegram.js";
import { ingestProduct } from "@/lib/vector-pipeline.js";
import { scrapeProducts } from "@/lib/web-scraper.js";
import { analyzeImageFromTelegram } from "@/lib/gemini.js";

function parseManualEntry(text) {
  const lines = text.split("\n");
  const get = (key) => {
    const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase()));
    return line ? line.split(":").slice(1).join(":").trim() : "";
  };
  return {
    name: get("name"),
    categories: [{ name: get("category") || "Uncategorized" }],
    regular_price: Number(get("regular price")) || 0,
    sale_price: Number(get("sale price")) || 0,
    stock_status: get("stock status") || "instock",
    description: get("description") || "",
  };
}

function isManualEntry(text) {
  const lower = text.toLowerCase();
  return lower.includes("name:") && (lower.includes("price:") || lower.includes("category:"));
}

function isUrl(text) {
  return /https?:\/\/[^\s]+/.test(text);
}

export async function POST(request) {
  const body = await request.json();
  const update = parseTelegramUpdate(body);
  if (!update) return NextResponse.json({ status: "ignored" });

  const { chatId, text, fileId } = update;

  try {
    if (text.trim() === "/addproduct") {
      await sendTelegramMessage(chatId, PRODUCT_TEMPLATE);
      return NextResponse.json({ status: "template_sent" });
    }

    if (text.trim() === "/start") {
      await sendTelegramMessage(chatId,
        "Welcome to the Inventory Manager!\n\n" +
        "/addproduct - Add a product manually\n" +
        "Send a product URL to scrape it\n" +
        "Or send a photo with product details in the caption."
      );
      return NextResponse.json({ status: "welcome_sent" });
    }

    if (isUrl(text)) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      const url = urlMatch[0];
      await sendChatAction(chatId);
      await sendTelegramMessage(chatId, "Product link detected. Starting scraper...");

      try {
        const products = await scrapeProducts(url);
        await sendTelegramMessage(chatId, `Found ${products.length} product(s). Saving to database...`);

        let saved = 0;
        for (const product of products) {
          try {
            await ingestProduct(product);
            saved++;
          } catch (e) {
            console.error("Failed to ingest product:", product.name, e.message);
          }
        }
        await sendTelegramMessage(chatId, `Done! ${saved}/${products.length} products saved to Supabase.`);
      } catch (e) {
        console.error("Scraping failed:", e);
        await sendTelegramMessage(chatId, "Scraping failed: " + e.message);
      }
      return NextResponse.json({ status: "scrape_done" });
    }

    if (isManualEntry(text)) {
      await sendChatAction(chatId);
      await sendTelegramMessage(chatId, "Manual entry detected. Extracting details...");

      const product = parseManualEntry(text);

      if (fileId) {
        try {
          const fileUrl = await getFileUrl(fileId);
          product.images = [{ src: fileUrl }];
        } catch (e) {
          console.error("Failed to get Telegram file:", e.message);
          product.images = [];
        }
      } else {
        product.images = [];
      }

      try {
        await sendTelegramMessage(chatId, "Saving to Supabase...");
        const result = await ingestProduct(product);
        await sendTelegramMessage(chatId,
          `Product saved!\n\nName: ${product.name}\nID: ${result.id}\nCode: ${result.productCode}\nStatus: ${result.status}`
        );
      } catch (e) {
        console.error("Ingest failed:", e);
        await sendTelegramMessage(chatId, "Failed to save: " + e.message);
      }
      return NextResponse.json({ status: "manual_done" });
    }

    await sendTelegramMessage(chatId,
      "I didn't understand that. Try:\n/addproduct - Manual entry\nSend a URL to scrape\nOr send a photo with caption details."
    );
  } catch (e) {
    console.error("Telegram handler error:", e);
    await sendTelegramMessage(chatId, "Error: " + e.message);
  }

  return NextResponse.json({ status: "ok" });
}
