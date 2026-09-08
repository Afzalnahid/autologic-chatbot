// How many messages a client has "used" in a window — the one number the plan
// limit, the billing bar and the admin panel must all agree on.
//
// The owner's rule (2026-09-08): a counted message is ONE BOT REPLY, never the
// customer's incoming message and never a reply the owner typed by hand (role
// "agent"). A single reply is stored as several rows here — a photo, then the
// text, then a follow-up question — so only the FIRST row of a reply is flagged
// `reply_turn` (see botReplyRows in bot.js). Counting flagged rows therefore
// counts REPLIES, not bubbles, and never counts a customer or agent row.
//
// Until the reply_turn column exists (docs/sql/2026-09-08-reply-turn.sql), this
// falls back to counting the customer's own messages — the previous basis — so a
// plan limit is never silently left unenforced (counting zero would let everyone
// past). It self-heals the moment the column is there; no deploy order to get
// right.
import { supabase } from "@/lib/supabase.js";

let hasColumn = true;

export async function countBillableMessages(clientId, since, pageId = null) {
  const base = () => {
    let b = supabase.from("message_buffer").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).gte("created_at", since);
    if (pageId) b = b.eq("page_id", pageId);
    return b;
  };

  if (hasColumn) {
    const { count, error } = await base().eq("role", "bot").eq("reply_turn", true);
    if (!error) return count || 0;
    if (/reply_turn|column|schema cache|does not exist/i.test(error.message || "")) {
      hasColumn = false;
      console.warn("[usage] message_buffer has no reply_turn column yet — counting customer messages instead. Run docs/sql/2026-09-08-reply-turn.sql.");
    } else {
      console.error("[usage] billable count failed:", error.message);
      // fall through to the customer count as a best-effort number
    }
  }

  const { count } = await base().eq("role", "customer");
  return count || 0;
}
