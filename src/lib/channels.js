import { supabase } from "@/lib/supabase.js";

// One Page / IG account / WhatsApp number powers exactly one Autologic
// account. The channels_platform_page_uniq index enforces it in the
// database; this check runs first so the owner gets a plain sentence
// instead of a raw constraint error.
export async function ownedByAnotherClient(platform, pageId, clientId) {
  const { data } = await supabase.from("channels").select("client_id")
    .eq("platform", platform).eq("page_id", String(pageId))
    .neq("client_id", clientId).limit(1);
  return !!(data && data.length);
}

// The sentence shown on the failed-connect page. One wording per platform so
// the owner knows exactly which thing is taken.
export const ALREADY_CONNECTED = {
  facebook: "This Facebook Page is already connected to another Autologic account. A Page can only power one account at a time — disconnect it from the other account first, or contact support.",
  instagram: "This Instagram account is already connected to another Autologic account. An account can only power one Autologic account at a time — disconnect it from the other one first, or contact support.",
  whatsapp: "This WhatsApp number is already connected to another Autologic account. A number can only power one account at a time — disconnect it from the other account first, or contact support.",
};
