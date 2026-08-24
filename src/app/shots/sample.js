// Invented data for documentation screenshots. Nothing here is real.
//
// Every name, number and message is made up on purpose: the manual is a public
// page, and a screenshot of the live dashboard would put real customers'
// names and messages on the open internet.
//
// Keyed by the API path each tab calls, so the studio can answer a tab's own
// requests without touching Supabase.

const mins = (n) => new Date(Date.now() - n * 60000).toISOString();

export const SAMPLE = {
  // The Comments tab. Two rows chosen to show the tab at its most informative:
  // one that worked end to end, and one where the private reply was blocked —
  // which is what the red panel at the top of the tab explains.
  "/api/comments": [
    {
      id: "c1", platform: "instagram", page_id: "17841400000000000", post_id: "18000000000000000",
      commenter_name: "tasnim.rahman", created_at: mins(12),
      comment_text: "i want to know more details, please",
      reply_text: "Of course — I've sent you the full details in a message. Have a look and tell me what you think.",
      replied: true, dm_sent: true,
    },
    {
      id: "c2", platform: "facebook", page_id: "102000000000000", post_id: "102000000000000_5550000",
      commenter_name: "Rahim Uddin", created_at: mins(96),
      comment_text: "Delivery ki Cumilla te ache? Price koto?",
      reply_text: "Yes, we deliver to Cumilla — usually within 2 days. The price is 1,450 BDT including delivery.",
      replied: true, dm_sent: false,
      dm_error: "This person cannot be messaged privately.",
    },
  ],
};
