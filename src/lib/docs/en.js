// English copy for the documentation site.
//
// Layout lives in src/app/docs/. Only words live here, so a sentence can be
// fixed without touching a component — and so en.js and bn.js sit side by side
// where a missing translation is obvious.
//
// A page's `blocks` array is rendered in order. Block shapes:
//   { h, p:[...] }              heading (optional) and paragraphs
//   { steps:[...] }             numbered steps
//   { table:{ head:[], rows:[[]] } }
//   { shot:"file-name", cap }   screenshot from /docs/shots/<file-name>.png
//   { note, kind:"tip"|"warn" } a callout
//   { faq:[{q,a}] }             question and answer pairs
// Any block may carry biz:"ecommerce" | "agency" to show only for that
// business type — every page must still answer for both.
//
// Inside a string, **bold** and `code` are rendered. Nothing else is parsed.

export const UI = {
  brand: "Documentation",
  tagline: "Everything Autologic does, and how to use it",
  search: "Search the docs",
  searchEmpty: "Nothing matches that.",
  onThisPage: "On this page",
  openTab: "Open this tab",
  openTabHint: "Takes you into your dashboard",
  next: "Next",
  prev: "Previous",
  backToDocs: "All documentation",
  writing: "This page is being written",
  writingBody: "We are still writing this one. Everything else in the menu is ready to read, and this page will follow shortly.",
  readTime: "{n} min read",
  forEcom: "For online shops",
  forAgency: "For agencies",
  needHelp: "Still stuck?",
  needHelpBody: "Write to us and a person will answer — not a bot.",
  contact: "Contact us",
  home: "Home",
  login: "Log in",
  langOther: "বাং",
  groups: {
    start: "Start here",
    daily: "Every day",
    outreach: "Reaching customers",
    business: "Your business",
    teach: "Teaching the bot",
    account: "Account",
    help: "Help",
  },
  // Short sidebar / hub names. The page's own <h1> comes from its copy below.
  names: {
    "getting-started": "Getting started",
    "channels": "Channels",
    "website-widget": "Website widget",
    "conversations": "Conversations",
    "comments": "Comments",
    "analytics": "Analytics",
    "broadcast": "Broadcast",
    "inventory": "Inventory & Knowledge Base",
    "orders": "Orders & Bookings",
    "bot-training": "Bot Training",
    "ai-engine": "AI Engine",
    "billing": "Billing",
    "profile": "Profile",
    "faq": "Common questions",
  },
};

export const DOCS = {
  "getting-started": {
    title: "Getting started",
    lead: "From signing up to your bot answering its first real customer. About fifteen minutes, and you never need to find an ID or paste a token.",
    time: 6,
    blocks: [
      { h: "What Autologic actually does",
        p: [
          "Autologic is one AI assistant that answers your customers on **Facebook Messenger**, **Instagram**, **WhatsApp** and **your own website** — in the language the customer wrote in.",
          "It learns your business from what you tell it, then replies on its own. You watch every conversation from one dashboard, and you can take over from the bot at any moment.",
        ] },

      { h: "The four steps",
        steps: [
          "**Create your account.** Email and a password, then the name of your business.",
          "**Pick your business type.** An online shop sells products; an agency sells services. This one choice changes several tabs later, so it is worth getting right.",
          "**Teach the bot.** It asks you questions about your business and writes its own training from your answers. Write in whichever language you like.",
          "**Connect a channel.** One click. You log in with your own Facebook or Instagram account and the connection is made for you.",
        ] },

      { note: "Your business type is not a label — it changes the dashboard. Online shops get **Inventory** and **Orders**; agencies get a **Knowledge Base** and **Bookings** instead. You can change it later in Profile, but it is smoother to choose correctly now.",
        kind: "tip" },

      { h: "Choosing your business type",
        table: { head: ["", "Online shop", "Agency"],
          rows: [
            ["You sell", "Products with prices and stock", "Services, time, or expertise"],
            ["The bot is taught with", "Your product catalogue", "Your documents and Q&A"],
            ["Two tabs become", "Inventory · Orders", "Knowledge Base · Bookings"],
            ["The bot can", "Take an order in chat", "Book a meeting on your Google Calendar"],
          ] } },

      { h: "After the bot is trained",
        p: ["Three things are worth doing on your first day, in this order:"],
        steps: [
          "Open **Channels** and connect at least one — Facebook, Instagram, WhatsApp or your website.",
          "Message your own page from another account and watch the reply arrive in **Conversations**.",
          "If the reply was not quite right, open **Bot Training** and correct it. The bot changes immediately — there is nothing to redeploy.",
        ] },

      { note: "Nothing you connect is permanent. Every channel has an on/off switch and a **Disconnect** button, and turning a channel off simply means messages wait for you instead of being answered.",
        kind: "tip" },
    ],
  },

  "comments": {
    title: "Comments",
    lead: "Every comment left on your Facebook Page and Instagram posts, what the bot replied publicly, and whether it also reached the person privately.",
    time: 5,
    blocks: [
      { h: "What this tab is for",
        p: [
          "A comment on a post is a customer raising their hand in public. Autologic answers it twice: a **public reply** underneath the comment so everyone reading the post sees an answer, and a **private message** to that person so a real conversation can start in your inbox.",
          "This tab is the record of both. It does not send anything itself — it shows you what already happened, and tells you plainly when something did not work.",
        ] },

      { shot: "comments-overview", cap: "The Comments tab with one Instagram and one Facebook comment." },

      { h: "Turn it on first",
        p: ["Comment automation is a **per-channel** setting, not a global one — so you can let the bot answer comments on one Page and stay quiet on another."],
        steps: [
          "Go to **Channels**.",
          "Tap the connected account to open it.",
          "Under **Comment automation** you will find two switches.",
        ],
        },

      { table: { head: ["Switch", "What it does", "Default"],
        rows: [
          ["Auto-reply to comments", "Publicly replies underneath the comment, where everyone can see it", "On"],
          ["Send to inbox", "Also messages the commenter privately, to move the conversation to your inbox", "On"],
        ] } },

      { note: "Want the bot to answer privately but never post in public? Turn **Auto-reply to comments** off and leave **Send to inbox** on. Some businesses prefer this.",
        kind: "tip" },

      { h: "Reading one comment card",
        table: { head: ["What you see", "What it means"],
          rows: [
            ["The name at the top", "Who wrote the comment"],
            ["Facebook / Instagram badge", "Which account the post is on"],
            ["“2h ago”", "When the comment was written"],
            ["Open the post", "Opens the original post"],
            ["**Replied publicly**", "The bot posted its answer under the comment"],
            ["**Not replied**", "No public reply — the switch is off, or it failed"],
            ["**Sent to Messenger** / **Sent to Instagram DM**", "The private message reached them"],
            ["**Inbox failed**", "The private message could not be delivered — the reason is printed below the card"],
            ["**No inbox msg**", "No private message was attempted"],
            ["The trash icon", "Removes the record from your dashboard only"],
            ["**Their comment**", "Exactly what the customer wrote"],
            ["**Bot reply**", "Exactly what your bot answered"],
          ] } },

      { note: "The trash icon clears the row from this dashboard. **The comment itself stays on Facebook or Instagram**, and so does the bot's public reply. To remove those, delete them on the post.",
        kind: "warn" },

      // TEMPORARY — delete this block once the "Open the post" link is fixed for
      // Instagram (Comments.js hard-codes a facebook.com URL for every row).
      { note: "**Known issue:** on an Instagram row, **Open the post** currently opens Facebook instead of Instagram. A fix is on the way. Until then, open the post from the Instagram app.",
        kind: "warn" },

      { h: "Finding one comment among many",
        p: ["Two filters sit above the list, and they work together."],
        table: { head: ["Filter", "Use it to"],
          rows: [
            ["Channel dropdown", "Show only Facebook, or only Instagram. It only lists channels that actually have comments"],
            ["All", "Everything, newest first"],
            ["Replied", "Only comments the bot answered in public"],
            ["Sent to inbox", "Only the ones where a private message got through"],
            ["**Needs attention**", "Anything that failed — the first place to look each morning"],
          ] } },

      { h: "When the private message fails",
        p: [
          "A red panel appears at the top of the tab counting how many could not be delivered, and each affected card prints its own reason underneath.",
          "This is normal and it is not a fault in your setup. A private reply is blocked when:",
        ],
        steps: [
          "The comment came from a **Page or business account** rather than a personal profile — those cannot receive a private reply at all.",
          "The person's **privacy settings** do not allow messages from businesses.",
          "One was **already sent** for that same comment.",
          "The comment is **too old** — both platforms close the window after a while.",
        ] },

      { note: "When the private message fails, the **public reply still happened**. The customer was answered where everyone can see it — only the follow-up to their inbox was blocked.",
        kind: "tip" },

      { h: "If something goes wrong",
        faq: [
          { q: "The tab is empty even though people are commenting.",
            a: "Check three things in order. First, the channel is connected and its main switch is on (**Channels** tab). Second, **Auto-reply to comments** is on for that account. Third — and this catches most people — only comments written **after** you connected the channel appear here. Older comments are not imported." },
          { q: "The bot's public reply was wrong or off-topic.",
            a: "The comment reply is written by the same bot that answers your messages, so it is fixed in the same place: the **Bot Training** tab. Correct what it knows there and the next reply improves. There is nothing to redeploy." },
          { q: "I do not want the bot replying in public at all.",
            a: "Turn off **Auto-reply to comments** for that channel and leave **Send to inbox** on. The bot will quietly message anyone who comments without posting anything publicly." },
          { q: "I deleted a comment here — why is it still on Facebook?",
            a: "Because deleting here only tidies your dashboard. Autologic never deletes anything from your Page or your Instagram account. Delete it on the post itself if you want it gone from public view." },
          { q: "One comment got two replies.",
            a: "That happens if someone edits their comment, which both platforms report as new activity. It is rare. If you see it repeatedly, contact us with the post link." },
        ] },
    ],
  },
};
