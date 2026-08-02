import { supabase } from "@/lib/supabase.js";
import { chatWithGemini } from "@/lib/gemini.js";

// Two separate vocabularies. They are never merged: an online shop does not have
// bookings and a service business does not have deliveries.
export const TAGS = {
  ecommerce: ["Order", "Product Inquiry", "Delivery", "Complaint", "Other"],
  agency: ["Booking", "Service Inquiry", "Complaint", "Follow-up", "Other"],
};

export const COMPLAINT = "Complaint";
export const OTHER = "Other";

export function tagsFor(businessType) {
  return TAGS[businessType === "agency" ? "agency" : "ecommerce"];
}

// Rules run first and settle most messages without an AI call. Bangla and English
// are both listed because customers mix them freely.
const RULES = {
  Complaint: [
    "ফেরত", "রিফান্ড", "refund", "টাকা ফেরত", "প্রতারণা", "ঠকা", "ভুয়া", "fraud", "scam",
    "নষ্ট", "ভাঙা", "ছেঁড়া", "damaged", "broken", "defective", "খারাপ", "worst", "bad service",
    "অভিযোগ", "complain", "complaint", "হয়রানি", "ধরে না", "রিপ্লাই দেন না", "কেউ ধরে না",
    "দেরি হচ্ছে", "এখনো পাইনি", "পাই নাই", "still not received", "not received", "ভুল পণ্য",
    "wrong item", "wrong product", "cancel করব", "বাতিল করব", "disappointed", "হতাশ",
  ],
  Delivery: [
    "ডেলিভারি", "delivery", "কুরিয়ার", "courier", "পাঠিয়েছেন", "কবে পাব", "কোথায় আছে",
    "ট্র্যাকিং", "tracking", "শিপিং", "shipping", "পৌঁছাবে", "কত দিন লাগবে", "অর্ডার কোথায়",
    "অর্ডারটা কোথায়", "অর্ডার টা কোথায়", "অর্ডার কই", "মাল কোথায়", "পার্সেল",
    "where is my order", "pathao", "steadfast", "redx", "সুন্দরবন",
  ],
  Order: [
    "অর্ডার করতে চাই", "অর্ডার দিব", "অর্ডার দিতে চাই", "নিতে চাই", "কিনতে চাই",
    "i want to order", "place an order", "confirm করেন", "কনফার্ম", "ঠিকানা দিচ্ছি",
    "ক্যাশ অন ডেলিভারি", "cash on delivery", "cod",
  ],
  "Product Inquiry": [
    "দাম", "price", "কত টাকা", "কত দাম", "স্টক", "stock", "আছে কি", "available",
    "সাইজ", "size", "কালার", "color", "রঙ", "ছবি দেন", "ডিটেইলস", "details", "কোয়ালিটি",
    "quality", "কি কি আছে",
  ],
  Booking: [
    "বুকিং", "booking", "book করতে", "অ্যাপয়েন্টমেন্ট", "appointment", "মিটিং", "meeting",
    "শিডিউল", "schedule", "সময় দিতে পারবেন", "কবে বসতে", "slot", "কনসালটেশন", "consultation",
    "call করতে চাই",
  ],
  "Service Inquiry": [
    "সার্ভিস", "service", "প্যাকেজ", "package", "কত খরচ", "চার্জ", "charge", "fee",
    "কী কী করেন", "what do you offer", "পোর্টফোলিও", "portfolio", "কাজ করেন কি",
    "quotation", "কোটেশন",
  ],
  "Follow-up": [
    "আপডেট", "update", "কী অবস্থা", "কতদূর", "any update", "খবর কী", "জানানোর কথা",
    "আগে বলেছিলাম", "গতকাল বলেছিলাম", "আবার বলছি",
  ],
};

function normalise(text) {
  return String(text || "").toLowerCase();
}

// Deterministic pass. Complaint is checked first — an angry message about a late
// delivery is a complaint, not a delivery question.
export function ruleTag(text, businessType) {
  const t = normalise(text);
  if (!t.trim()) return null;
  const allowed = tagsFor(businessType);
  const order = [COMPLAINT, ...allowed.filter((x) => x !== COMPLAINT && x !== OTHER)];

  for (const tag of order) {
    const words = RULES[tag];
    if (!words) continue;
    if (words.some((w) => t.includes(normalise(w)))) return tag;
  }
  return null;
}

// Only called when the rules find nothing. Always resolves to a valid tag.
export async function aiTag(text, businessType) {
  const allowed = tagsFor(businessType);
  const system =
    `Classify the customer message into exactly one label from this list: ${allowed.join(", ")}. ` +
    `The message may be in Bangla, English or a mix. Answer with the label only — no punctuation, ` +
    `no explanation. If it does not clearly fit any label, answer Other.`;

  try {
    const raw = await chatWithGemini(system, [{ role: "user", content: String(text).slice(0, 800) }]);
    const answer = String(raw || "").trim().replace(/[."']/g, "");
    const hit = allowed.find((a) => a.toLowerCase() === answer.toLowerCase());
    if (hit) return hit;
    const loose = allowed.find((a) => answer.toLowerCase().includes(a.toLowerCase()));
    return loose || OTHER;
  } catch (e) {
    // Never leave a conversation untagged because the AI was unavailable.
    console.error("[tags] ai classify failed:", e.message);
    return OTHER;
  }
}

export async function classify(text, businessType) {
  const rule = ruleTag(text, businessType);
  if (rule) return { tag: rule, by: "rule" };
  const tag = await aiTag(text, businessType);
  return { tag, by: "ai" };
}

// Manual tags always win: an automatic pass never overwrites or removes one.
export async function applyAutoTag(clientId, senderId, text, businessType) {
  try {
    const { data: existing } = await supabase
      .from("conversation_tags").select("tag, source")
      .eq("client_id", clientId).eq("sender_id", senderId);

    if ((existing || []).some((r) => r.source === "manual")) return null;

    const { tag, by } = await classify(text, businessType);
    if (!tag) return null;
    if ((existing || []).some((r) => r.tag === tag)) return tag;

    // Auto tagging keeps one tag per conversation, replacing the previous guess.
    await supabase.from("conversation_tags")
      .delete().eq("client_id", clientId).eq("sender_id", senderId).eq("source", "auto");

    const { error } = await supabase.from("conversation_tags")
      .insert({ client_id: clientId, sender_id: senderId, tag, source: "auto" });
    if (error && error.code !== "23505") console.error("[tags] insert:", error.message);

    console.log("[tags]", by, "→", tag, { clientId, senderId });
    return tag;
  } catch (e) {
    console.error("[tags] applyAutoTag:", e.message);
    return null;
  }
}
