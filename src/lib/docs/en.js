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
  tagline: "Everything TellMore AI does, and how to use it",
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
  zoom: "Tap to open it full size",
  forEcom: "For online shops",
  forAgency: "For agencies",
  needHelp: "Still stuck?",
  needHelpBody: "Write to us and a person will answer — not a bot.",
  contact: "Contact us",
  home: "Home",
  login: "Log in",
  dashboard: "Open dashboard",   // shown instead of Log in to a signed-in client
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
    "ai-assistant": "AI Assistant",
    "channels": "Channels",
    "website-widget": "Website widget",
    "inbox": "Inbox",
    "comments": "Comments",
    "notifications": "Notifications",
    "analytics": "Analytics",
    "broadcast": "Broadcast",
    "inventory": "Inventory & Knowledge Base",
    "orders": "Orders & Bookings",
    "bot-training": "Bot Training",
    "ai-engine": "AI Engine",
    "billing": "Billing",
  "packages": "Packages",
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
      { h: "What TellMore AI actually does",
        p: [
          "TellMore AI is one AI assistant that answers your customers on **Facebook Messenger**, **Instagram**, **WhatsApp** and **your own website** — in the language the customer wrote in.",
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
          "Message your own page from another account and watch the reply arrive in **Inbox**.",
          "If the reply was not quite right, open **Bot Training** and correct it. The bot changes immediately — there is nothing to redeploy.",
        ] },

      { note: "Nothing you connect is permanent. Every channel has an on/off switch and a **Disconnect** button, and turning a channel off simply means messages wait for you instead of being answered.",
        kind: "tip" },
    ],
  },

  "ai-assistant": {
    title: "AI Assistant",
    lead: "The one place you talk to your dashboard. Teach the bot, add products and set up offers by answering questions — and nothing is saved until you press the button.",
    time: 7,
    blocks: [
      { h: "What this tab is for",
        p: [
          "Every other tab is a form you fill in. This one asks you questions instead, and fills the forms in for you.",
          "It can do three jobs, and it can reach the rest of the dashboard: ask it about your catalogue, tell it to change a price, or say **show me the orders** and it takes you there.",
        ] },

      { shot: "assistant", cap: "The tab as it opens: the three jobs in order with a tick on the ones already done, a few things you can just say, and every other tab one tap away." },

      { note: "It never changes anything on its own. Every change appears as a card showing what would move and what it would move from — *Price: 900 → 1200* — with a button underneath. Untick anything wrong. Nothing happens until you press it.",
        kind: "tip" },

      { h: "The three jobs, in order",
        p: ["The numbers are not decoration. A bot that has not been told what your business is answers badly about products it does have, and an offer needs a catalogue behind it. A tick appears on each one as you finish it."],
        table: { head: ["", "What it does"],
          rows: [
            ["**1 · Teach the bot**", "It asks what your business is, how you deliver, how people pay, your returns policy, your hours — one question at a time. Skip anything, and stop whenever you like"],
            ["**2 · Add products**", "One product, or your whole shop at once. See below"],
            ["**3 · Set up an offer**", "Three questions: what the offer is called, what the customer gets, when it ends"],
          ] } },

      { h: "Adding one product",
        p: ["It starts with the picture, because that is the thing you certainly have when you are standing over the product with your phone."],
        steps: [
          "Press **Add products**, then **Just one**, then **Take a photo of it**.",
          "Attach the photos with the camera button beside the message box — front, back, close-ups, all at once. The first one is what customers see.",
          "The AI reads them and proposes a name, a category and a description, so the questions that follow are corrections rather than blank boxes.",
          "It then asks for the name, the category, the price, the details and any sizes or colours. Every question shows you what an answer looks like.",
          "Press **Save** at the end.",
        ] },

      { note: "At the category question your existing categories appear as buttons — tap one instead of typing. That is what stops a shop ending up with *T-shirt*, *T shirt* and *tshirt* as three categories the bot cannot tell apart.",
        kind: "tip" },

      { h: "Adding many at once",
        p: ["Press **Add products**, then **Several at once**, and pick where they are coming from."],
        table: { head: ["Where from", "What happens"],
          rows: [
            ["**All the photos at once**", "Three questions about what they share, then you attach every photo. Front, back and close-ups of the same thing are gathered into one product automatically, and each is named by what makes it different"],
            ["**A spreadsheet**", "A CSV saved from Excel or Google Sheets. Hundreds at a time"],
            ["**WooCommerce**", "Your site address and a read-only key pair from WooCommerce › Settings › Advanced › REST API"],
            ["**Shopify**", "Your `myshopify.com` address and an Admin API token with `read_products`"],
          ] } },

      { note: "An import never changes your Shopify or WooCommerce shop. It only reads.",
        kind: "tip" },

      { h: "Getting back to the start",
        p: [
          "When a job finishes, the three choices come back on their own — so *I have added the shirt, now let me set the offer* is one tap, not a page reload.",
          "There is also a **Main menu** button at the top of the tab, and on a phone the back button lands there too.",
        ] },

      { h: "Just talking to it",
        p: ["You do not have to use the buttons. Say what you want in your own words and it proposes the change:"],
        table: { head: ["You say", "It proposes"],
          rows: [
            ["*the winter jackets are 1200 now*", "A price change on the matching products"],
            ["*we are out of the black polo*", "That product marked out of stock"],
            ["*make an Eid offer, 20% off everything*", "A new offer, worded the way a customer reads it"],
            ["*tell the bot we are closed on Fridays*", "That fact added to what the bot knows"],
            ["*show me the orders*", "It opens the Orders tab"],
          ] } },

      { h: "What it deliberately cannot do",
        p: ["Two things are kept out of its hands on purpose."],
        table: { head: ["Not this", "Why, and where instead" ],
          rows: [
            ["Choose which products an offer covers", "That means picking real rows out of your catalogue, and a machine naming them from memory would attach the offer to the wrong shirt. Pick them on **Bot Training › Offers**, where the real list is"],
            ["Send anything to a customer", "Broadcasts and replies go to real people. **Broadcast** and **Inbox** do that, where you can see exactly who receives it"],
          ] } },

      { h: "The language it speaks",
        p: ["Everything here — the questions, the examples, the buttons and the confirmation cards — follows the **EN / বাং** switch at the top of the dashboard. Change it mid-conversation and what is already on screen changes with it."] },

      { faq: [
        { q: "Does it save anything without asking?",
          a: "No. Every change is a card with a button. Until you press it, nothing has happened." },
        { q: "I started adding a product and changed my mind.",
          a: "Press **Cancel** on the product card, the **Main menu** button at the top, or the back button on your phone. Nothing is saved." },
        { q: "Can I still add products the old way?",
          a: "Yes. The **Inventory** tab has the full form and all four imports, and it always will. This tab is another door to the same place, not a replacement." },
        { q: "It says a product with that name already exists.",
          a: "That is information, not a refusal. Fifteen box t-shirts are all called box t-shirts — tell it what makes this one different, such as the print or the colour, and it adds that to the name so customers can be matched to the right one." },
      ] },
    ],
  },

  "channels": {
    title: "Channels",
    lead: "Where your bot answers. Connect as many Facebook Pages, Instagram accounts and WhatsApp numbers as you need — each one takes a single click and its own on/off switch.",
    time: 6,
    blocks: [
      { h: "What a channel is",
        p: [
          "A channel is one place customers can write to you: a Facebook Page, an Instagram Business account, a WhatsApp Business number, or your own website.",
          "You can connect as many as you like. **Each Page, account or number can belong to only one TellMore AI account** — so if a Page is already connected somewhere else, disconnect it there first.",
        ] },

      { shot: "channels", cap: "Two Facebook Pages, an Instagram account, a WhatsApp number and a website widget — one of the Pages paused." },

      { h: "Connecting one",
        steps: [
          "Press **Connect new channel**.",
          "Pick Facebook, Instagram or WhatsApp.",
          "A window opens and you log in **with your own account** — the same one you use every day.",
          "Choose which Page or account to connect, and approve.",
          "The window closes and a green card confirms it. The bot is answering from that moment.",
        ] },

      { note: "The list shows **every** Page you can reach — Pages you manage yourself and Pages in your Business Portfolio. A Page missing from it was not ticked when Facebook asked which Pages to share: press **Connect again** under the list, edit that choice and tick every Page. A greyed-out Page is one your role cannot send messages from; ask its admin for full control.",
        kind: "tip" },

      { note: "You never have to find an ID or copy a token. If a page ever asks you for one, something has gone wrong — write to us rather than hunting for it.",
        kind: "tip" },

      { h: "Reading the list",
        p: [
          "Connected channels are grouped by platform, with a count beside each name. Each row also says how many customers wrote to that Page, account or number **today**, so a paused Page with chats waiting is visible as exactly that.",
          "At the bottom, **Add another** offers a card for each platform — the quickest way to connect a second Page or your first WhatsApp number.",
        ],
        table: { head: ["Section", "What it covers"],
          rows: [
            ["**Facebook**", "Messenger replies and comment automation"],
            ["**Instagram**", "DM replies and comment automation"],
            ["**WhatsApp**", "Replies on your business numbers"],
            ["**Website**", "The same bot on your own site — see the Website widget page"],
          ] } },

      { p: ["Each connected account is one row. The small dot on its icon is the quickest signal in the tab:"],
        table: { head: ["What you see", "What it means"],
          rows: [
            ["A **green dot** and “Live — the bot is answering”", "Working normally"],
            ["A **grey dot** and “Paused — messages wait for you”", "The bot is off here; nothing is lost, messages simply sit in Conversations"],
            ["A **red row** saying “Disconnected” with a **Reconnect** button", "Facebook stopped accepting our access — usually a changed password or a removed admin. The bot is silent on this Page until you press Reconnect (one click). You are told on the bell, on your phone and by email the day it happens"],
            ["The switch on the right", "Turns this one channel on or off"],
            ["The arrow at the end", "Opens the row's details"],
          ] } },

      { h: "Inside a row",
        p: ["Tap a row to open it. Three things live there:"],
        steps: [
          "**The platform ID and the date it was connected** — useful only if you ever need to tell them apart or quote one to support.",
          "**Comment automation** — two switches, on Facebook and Instagram rows only. Covered in full on the Comments page.",
          "**Disconnect** — the red button at the bottom.",
        ] },

      { note: "**Pausing is not disconnecting.** The switch stops the bot replying but keeps everything connected, so one tap brings it back. **Disconnect** cuts the link — you have to go through the whole connect flow again to undo it.",
        kind: "warn" },

      { h: "One business, several Pages",
        p: [
          "Many owners run a main Page plus a second one for a different product line, or an English Page and a Bangla one. Connect them all. Every conversation lands in the same inbox, and the **Inbox** tab can filter down to a single Page when you want to look at just one.",
          "Each Page keeps its own on/off switch and its own comment settings, so the bot can be busy on one and silent on another.",
        ] },

      { h: "If something goes wrong",
        faq: [
          { q: "The connect window opened and closed without doing anything.",
            a: "Almost always a pop-up blocker, or a browser that closed the window before it finished. Allow pop-ups for this site and try again. On a phone, do not switch apps while the window is open." },
          { q: "My Page is not in the list I get to choose from.",
            a: "You must be an **admin** of that Page on Facebook, not an editor or moderator. Check your role in Facebook's Page settings, then connect again." },
          { q: "It says the Page is already connected.",
            a: "A Page can power only one TellMore AI account. If you connected it under a different email, log in there and disconnect it first. If that account is not yours, write to us." },
          { q: "The bot answers on one Page but not the other.",
            a: "Open the quiet Page's row and check its switch. Each channel has its own — turning the bot off in Inbox is a separate control again, covering every channel at once." },
          { q: "I disconnected by accident.",
            a: "Nothing is lost. Connect it again the same way; your conversations, orders and training all stay exactly as they were." },
          { q: "I still answer some customers from the Messenger app, Business Suite or my phone's WhatsApp. Is that a problem?",
            a: "No — those replies show up in the Inbox here as **You**, the customer counts as answered, and the bot remembers what you said. See the Inbox page." },
        ] },
    ],
  },

  "website-widget": {
    title: "Website widget",
    lead: "The same bot, in a chat bubble on your own website. One line of code, and you decide which addresses are allowed to use it.",
    time: 4,
    blocks: [
      { h: "What it is",
        p: [
          "A small chat button that sits in the corner of your website. A visitor clicks it and talks to the **same bot** that answers your Messenger, Instagram and WhatsApp — it already knows your products, prices and policies, so there is nothing extra to teach it.",
          "Those chats appear in **Inbox** alongside everything else, and you can take over from the bot exactly the same way.",
        ] },

      { shot: "website-widget", cap: "The widget once it is created: your line of code, the websites allowed to use it, and the New key button." },

      { h: "Setting it up",
        p: ["The widget lives at the bottom of the **Channels** tab, in the Website section."],
        steps: [
          "Type your website address — for example `yourshop.com` — and press **Create widget**.",
          "Press **Copy code**. You now have one line on your clipboard.",
          "Paste it into your website, **just before the `</body>` tag**, on every page where the chat should appear.",
          "Save and reload your site. The chat button appears in the corner.",
        ] },

      { note: "If someone else built your website, send them the copied line and tell them: *paste this before the closing body tag*. That sentence is all a web developer needs — there is nothing else to configure.",
        kind: "tip" },

      { h: "Which websites are allowed",
        p: [
          "The chat only loads on addresses you have listed. This is what stops someone copying your code onto their own site and using your bot at your expense.",
          "Under **Websites allowed to use this chat** you can add more addresses — a second domain, or a subdomain like `shop.yourbrand.com` — and remove any you no longer use.",
        ] },

      { note: "You cannot remove the last address. With none listed, the chat could not load anywhere, so the dashboard refuses and tells you so.",
        kind: "warn" },

      { h: "The New key button",
        p: [
          "Every widget has its own key, baked into the line of code you pasted. **New key** throws the old one away and issues a fresh one.",
          "Only do this if you think someone has copied your code and is using your bot. The chat stops working on your website the moment you press it, and stays broken until you paste the new line in.",
        ] },

      { h: "Turning it off",
        p: ["The widget row in the Channels tab has the same switch as every other channel. Off, the chat button disappears from your site and the code you pasted simply does nothing — you do not need to edit your website to hide it."] },

      { h: "If something goes wrong",
        faq: [
          { q: "I pasted the code but no chat button appears.",
            a: "Three things to check. First, the address in **Websites allowed to use this chat** must match where you pasted it — `yourshop.com` will not cover `shop.yourshop.com`; add that separately. Second, the widget's switch in Channels must be on. Third, some site builders strip code pasted into a normal page — it usually has to go in a Settings area named something like *custom code*, *footer code* or *body script*." },
          { q: "It works on my computer but not on my phone.",
            a: "Usually the phone is showing an older cached copy. Reload the page fully, or open it in a private window. If your site sits behind Cloudflare or a caching plugin, clear that cache too." },
          { q: "Can I put it on more than one website?",
            a: "Yes. Add each address to the allowed list and paste the same line into each site. All the chats arrive in the same inbox." },
          { q: "Does it work on WordPress, Shopify or Wix?",
            a: "Yes — anywhere you can add one line of HTML. Every one of those has a place for it; look for *custom code*, *footer scripts* or *body script* in its settings." },
          { q: "I pressed New key and the chat stopped working.",
            a: "That is what it does. Press **Copy code** to get the new line and paste it into your website again, replacing the old one." },
        ] },
    ],
  },

  "overview": {
    title: "Overview",
    lead: "The tab the dashboard opens on: the last seven days at a glance, who is waiting for you right now, your newest orders or next meetings, and whether every channel is live.",
    time: 3,
    blocks: [
      { h: "What this tab is for",
        p: [
          "One look in the morning. It answers four questions without opening anything else: how busy was the week, is anyone waiting for **me**, what came in, and is the bot actually on everywhere.",
          "Every number is real and current. The week's figures are the same ones **Analytics** shows for 7 days; the lists are the same chats, orders and channels you find in their own tabs.",
        ] },

      { h: "Around every tab",
        p: [
          "Every page opens the same way: the date, a greeting with your business name, the **bell** and one button, **Train your bot**, which opens Bot Training. On a phone the tab's name takes the greeting's place.",
          "The menu on the left is one plain list. **Inbox** carries the number of unread chats and **Orders** the number still waiting to be confirmed. At the bottom, your package and how much of this month's bot replies it has used so far — tap it to see the full picture on Billing. Language, refresh and the light/dark switch sit just under it.",
        ] },

      { shot: "overview", cap: "The week's four numbers, messages per day with the AI's share, the people who need you, the newest orders and every channel's state." },

      { h: "The four cards",
        table: { head: ["Card", "What it shows"],
          rows: [
            ["**Messages**", "Every message in and out over the last 7 days, with today's count, and a small line showing the day-by-day shape"],
            ["**Customers**", "How many different people wrote, and how many of them were new"],
            ["**Answered by AI**", "The share of conversations the bot finished on its own, and how many needed you"],
            ["**Revenue**", "Money from orders this week and the order count"],
          ] },
        biz: "ecommerce" },
      { table: { head: ["Card", "What it shows"],
          rows: [["**Bookings**", "Meetings booked this week, and what share of your customers booked"]] },
        biz: "agency" },
      { p: ["The arrow beside each number compares this week with the week before. The **Analytics** tab has the longer view and the reasons behind it."] },

      { h: "Messages this week",
        p: ["One bar per day. The full bar is every message that day; the filled part is how many the bot answered. A bar that is mostly filled means the bot is carrying the load; a bar that is mostly empty means people were writing while the bot was paused, or you were answering by hand."] },

      { h: "Needs you",
        p: ["Chats that want a person, in the order that matters: someone who **asked for a person** (or got upset), a chat tagged as a **complaint**, then anything you have not read yet. Tap a row to open that chat in the Inbox. When the list is empty, the bot has everything covered."],
        note: "**Unread** is per device, the same as the bold rows in the Inbox: reading a chat on your phone does not mark it read on your laptop.", kind: "tip" },

      { h: "Recent orders", p: ["The five newest orders with their status and total. Tap one to open it in **Orders**."], biz: "ecommerce" },
      { h: "Next meetings", p: ["Your upcoming bookings in time order, with a **Join** button when a Meet link exists. The **Bookings** tab has the full calendar."], biz: "agency" },

      { h: "Channels",
        p: ["One line per connected Page, account or number: **Live** (green dot) means the bot is answering there, **Paused** means messages wait for you, **Expired** means the platform dropped the connection and you need to reconnect. The pill at the top of the page says the same thing in one line, and a red bar appears when any connection has expired."] },
    ] },

  "inbox": {
    title: "Inbox",
    lead: "Every chat from every channel in one inbox — with a switch that lets you take over from the bot whenever you want to answer someone yourself.",
    time: 7,
    blocks: [
      { h: "What this tab is for",
        p: [
          "Facebook, Instagram, WhatsApp and your website all arrive here. You watch the bot work, and step in whenever you want to.",
          "It refreshes on its own — a new message appears without you pressing anything.",
        ] },

      { shot: "inbox", cap: "The week's four numbers, the chat list with a channel dot on every avatar, the open conversation with its Bot replying / Take over control, and the customer panel." },

      { h: "The four numbers",
        table: { head: ["Card", "What it shows"],
          rows: [
            ["**Conversations today**", "How many different people wrote to you today, and the change against yesterday"],
            ["**Answered by the bot**", "The share of the last 7 days' conversations the bot finished on its own — the same figure Analytics shows"],
            ["**Orders value** (shops) · **Bookings** (agencies)", "The last 7 days, against the week before"],
            ["**Avg. first reply**", "How long a customer typically waited for the bot's first reply this week, measured from their message to the bot's bubble. Lower is better, so a fall shows green"],
          ] } },

      { h: "The two Bot switches",
        p: ["This is the most important thing on the tab, and there are **two** of them. They do different jobs:"],
        table: { head: ["Switch", "Where", "What it does"],
          rows: [
            ["**Bot ON / Bot OFF**", "Top of the chat list", "The whole account. Off, the bot stops replying on **every** channel and every conversation"],
            ["**Bot replying · Take over**", "Top of an open chat", "This one person only. Press **Take over** and you answer; **Hand back to bot** and it resumes. Everyone else is untouched"],
          ] } },

      { note: "The everyday move is the second one. A customer asks something delicate, you turn the bot off **for that chat**, answer yourself, and turn it back on when you are done. Nobody else is affected.",
        kind: "tip" },

      { p: ["Both switches show **Loading…** for a moment after the tab opens. That is deliberate — showing a guess and then correcting it would look like your setting had changed by itself."] },

      { h: "Finding a conversation",
        table: { head: ["Tool", "Use it to"],
          rows: [
            ["**Search**", "Look inside names and message text at once"],
            ["**Channel dropdown**", "Show only one platform — and if you have several Pages, only one Page"],
            ["**Tag dropdown**", "Show only conversations carrying a tag, with a count beside each"],
            ["**All · Needs you · Manual**", "The three buttons under the search box. **Needs you** shows the chats waiting on a person: someone asked for one, a complaint was tagged, or the customer wrote and you have not opened it since; **Manual** shows only the chats you have taken over from the bot. The small number on each is how many there are"],
          ] } },

      { p: ["When a filter matches nothing you get **Clear filters**, so you never have to remember which one you left on."] },

      { h: "The customer panel",
        p: [
          "On a wide screen — a laptop or a desktop monitor — a third column opens on the right of the chat. It shows who you are talking to without leaving the conversation: their name and channel, whether the bot or you is answering, when they first wrote, and how many messages they have sent.",
          "For an online shop it also shows their **orders**: how many, how much they have spent (cancelled and returned orders are not counted), and their last order with its status. For an agency it shows their **bookings**, and the next meeting with its Google Meet link if one is coming up.",
          "On a smaller screen or on a phone the panel is hidden so the chat keeps its room. Nothing in it is guessed — it is read from the orders and bookings already in your dashboard.",
        ] },

      { h: "Reading the list",
        table: { head: ["What you see", "What it means"],
          rows: [
            ["The coloured dot on the avatar", "Which channel this chat came in on — blue Messenger, pink Instagram, green WhatsApp, grey website"],
            ["**Bold name, bold preview, a red dot**", "Unread — a customer wrote and you have not looked yet, the way Messenger shows it. Open the chat and it goes back to normal; the next message makes it bold again. A bot reply does not clear it — you have not seen it"],
            ["“2m”, “3h”, “5d”", "How long since the last message"],
            ["An amber **Manual** chip", "You have taken over this chat; everything else is the bot's"],
            ["A grey pill with a name", "Which of your Pages this landed on (only shown when you have several)"],
            ["A **red tag**", "Your complaint tag — worth opening first"],
          ] } },

      { h: "Answering someone yourself",
        steps: [
          "Open the chat.",
          "Press **Take over** so the bot does not talk over you.",
          "Type in the box at the bottom and press Enter, or the send button.",
          "When you are finished, press **Hand back to bot** and it resumes.",
        ] },

      { p: [
          "Your messages and the bot's sit on the right, the customer's on the left in grey. Anything you sent by hand is marked **You** underneath; under the bot's reply you see how fast it came — **answered in 3 s**. The day and time sit above the first message of each day.",
          "When the bot shows a product, the picture appears as a **card** with the product's name, stock and price, read from your catalogue at that moment.",
        ] },

      { note: "The **Inbox** number on the sidebar is the count of unread chats — the same ones shown bold. Opening a chat, or **Mark all as read** in the bell at the top, clears it. It is remembered per device, so your phone and your computer each keep their own.",
        kind: "tip" },

      { h: "Replying from Messenger, Business Suite, WhatsApp or Instagram",
        p: [
          "You do not have to answer from this dashboard. A reply you type in the **Messenger app**, in **Meta Business Suite**, in the **WhatsApp Business app** on your own phone, or in **Instagram** lands in the chat here within seconds, marked **You** — exactly as if you had typed it in the box below.",
          "That matters for two reasons. The customer's messages are then counted as answered, so switching the bot back on does not make it answer them a second time. And the bot **remembers** what you said: a price you quoted by hand is a price it will not contradict later.",
        ] },

      { note: "Meta's own **instant reply** (the automatic “Thanks for contacting us…” some Pages send) also shows up in the chat, because the customer did receive it — but it is not treated as your answer. The bot still replies, and that greeting is kept out of its memory.",
        kind: "tip" },

      { h: "Sending more than text",
        table: { head: ["Button", "What it sends"],
          rows: [
            ["Camera", "Takes a photo there and then — most useful on a phone"],
            ["Photo", "Picks a picture already on your device"],
            ["Microphone", "Records a voice message. Press once to start, again to stop and send"],
            ["The smiley", "A small set of common emoji"],
          ] } },

      { note: "The first time you use the microphone your browser asks permission. If you refuse it, the button will not work until you allow it again in your browser's settings for this site.",
        kind: "warn" },

      { h: "Tags",
        p: [
          "The bot tags conversations on its own as they come in, from a fixed list that depends on your business type. You can also set one by hand from the **Tag this chat…** dropdown just under the chat header.",
          "Tagged chats can then be filtered from the list, and a broadcast can be aimed at a single tag.",
        ],
        table: { head: ["Business type", "The tags"],
          rows: [
            ["Online shop", "Order · Product Inquiry · Delivery · **Complaint** · Other"],
            ["Agency", "Booking · Service Inquiry · **Complaint** · Follow-up · Other"],
          ] } },

      { note: "**Complaint** is the one that matters. It is shown in red everywhere it appears, precisely so an unhappy customer does not get lost in a long list. Filter on it first thing each morning.",
        kind: "tip" },

      { h: "Deleting a chat",
        p: ["The red bin in the chat header removes the conversation from your dashboard. It does **not** delete anything from Facebook, Instagram or WhatsApp — the customer still has the thread on their side, and if they write again a fresh conversation appears."] },

      { h: "On a phone",
        p: ["The list fills the screen; tap a chat to open it and the back button brings you to the list. One back press closes the chat, the next leaves the tab — so you never fall out of the dashboard by accident."] },

      { h: "If something goes wrong",
        faq: [
          { q: "The bot is not replying to anyone.",
            a: "Check the **Bot ON** switch at the top of the chat list first — that one covers everything. Then check the channel's own switch in **Channels**. If both are on and it is still silent, look at the **AI Engine** tab: a bot running on your own API key pauses politely when that key runs out." },
          { q: "The bot is not replying to one person.",
            a: "That conversation is on **manual** — you or someone with your login pressed **Take over**. Press **Hand back to bot** and it resumes with that person." },
          { q: "I turned a switch off and it came back on a few seconds later.",
            a: "That was a bug and it is fixed. If you still see it, your save is failing — you would also get a message saying the switch could not be saved. Check your connection and try again." },
          { q: "My message would not send.",
            a: "Facebook, Instagram and WhatsApp all close the door 24 hours after the customer's last message. After that you cannot write to them until they write to you again. This is Meta's rule and applies to every business tool, not only TellMore AI." },
          { q: "The customer's real name is not showing.",
            a: "On Facebook, names need extra permission from Meta that has to be granted per app. Until then you see the account identifier instead of the name. It does not affect replies in any way." },
          { q: "I answered someone from the Messenger app. Does the bot know?",
            a: "Yes. The reply appears in that chat here as **You**, the customer counts as answered, and the bot carries what you said into its next reply. The same goes for Business Suite, the WhatsApp Business app on your phone, and Instagram." },
          { q: "Everything is bold again after I marked all as read.",
            a: "Only chats with a **new** customer message since then should be bold. If older ones came back, close the app fully and open it again — an app left open does not pick up the latest version until it is reopened." },
        ] },
    ],
  },

  "notifications": {
    title: "Notifications",
    lead: "The bell at the top of the dashboard, the notifications on your phone, and the emails — what each one tells you, and how to keep them quiet until something needs you.",
    time: 5,
    blocks: [
      { h: "The bell",
        p: [
          "The bell at the top of every page collects everything worth your attention, in three groups — the way Facebook arranges its own.",
        ],
        table: { head: ["Group", "What lands there"],
          rows: [
            ["**Needs you**", "A customer who asked for a person, a comment the bot could not answer, and alerts: your plan or message limit, your AI key, a channel that needs reconnecting, a payment decision"],
            ["**Customers**", "Messages waiting for a reply, and new public comments on your posts"],
            ["**Business**", "New orders and bookings, and quieter news such as a payment confirmed"],
          ] } },

      { p: ["Tap a notification and the dashboard opens **the exact thing it is about** — that customer's chat, that order — not just the tab. The number on the bell is how many are unread; a red badge means one of them is urgent."] },

      { h: "Marking as read",
        p: [
          "Opening the bell does not clear anything — only tapping a notification, or **Mark all as read**, does. After Mark all, the bell shows nothing until something new arrives, and it also clears the bold rows and the Inbox number in the sidebar. Read state is kept per device.",
        ] },

      { h: "When a customer needs a person",
        p: [
          "If a customer asks to talk to a human, or asks something the bot is not allowed to decide, the bot says a person will follow up and raises a **needs you** notification — on the bell, on your phone, and by email. Answer from the chat and it clears; the bot's own replies never clear it.",
        ] },

      { h: "On your phone",
        p: [
          "In **Profile** there is one **Notifications** switch. On, this device gets a notification even when the dashboard is closed — a new order, a new booking, a chat that needs you, a channel that stopped working, and the bot pausing because your AI key failed.",
          "In the TellMore AI Android app the switch uses the phone's own notifications; the first time the app opens it asks for permission, along with the camera, microphone and location it uses. In a browser, the browser asks instead.",
        ] },

      { note: "On an iPhone, a browser tab cannot receive notifications. Add TellMore AI to your Home Screen first, open it from there, and then turn the switch on.",
        kind: "warn" },

      { h: "Email",
        p: ["Some things are also emailed to the address you signed up with, so a notification you swiped away is not lost."],
        table: { head: ["What happened", "Email"],
          rows: [
            ["A new order or booking", "Yes — one email each"],
            ["A customer asked for a person", "Yes"],
            ["A channel stopped working and needs reconnecting", "Yes"],
            ["A new customer message", "No — that is what the bell and the phone are for"],
          ] } },

      { h: "If something goes wrong",
        faq: [
          { q: "The switch is on but nothing arrives on my phone.",
            a: "Check the phone's own settings: Settings → Apps → TellMore AI → Notifications must be allowed. If you refused the first prompt, that is where to allow it, then reopen the app." },
          { q: "I marked all as read and the Inbox number stayed.",
            a: "The Inbox number counts unread chats, and Mark all clears it. If it stayed, the app was still running an older version — close it fully and open it again." },
          { q: "I get too many.",
            a: "Turn the phone switch off in Profile; the bell keeps working on its own. Emails only go out for orders, bookings, hand-offs and a broken channel — never for ordinary messages." },
        ] },
    ],
  },

  "analytics": {
    title: "Analytics",
    lead: "How much the bot is doing, how much you still do by hand, and when your customers actually write to you.",
    time: 6,
    blocks: [
      { h: "The period buttons",
        p: [
          "**7 days**, **30 days** and **90 days** sit at the top. Every number on the page changes with them, and each one is compared against **the period immediately before it** — so a green arrow on the 30-day view means better than the previous 30 days, not better than last year.",
          "The page refreshes itself about once a minute; the time it last updated is written on the right.",
        ] },

      { shot: "analytics", cap: "Thirty days at a glance — the five cards, message volume, conversation health and the hour customers actually write." },

      { h: "The five cards at the top",
        table: { head: ["Card", "What it counts"],
          rows: [
            ["**Messages**", "Every message in and out, with today's figure underneath"],
            ["**Customers**", "How many different people wrote to you, split into new and returning"],
            ["**Conversations**", "How many separate chats, and the average number of messages in each"],
            ["**Bot resolved**", "The share of chats the bot finished on its own, with how many needed you"],
            ["**Revenue**", "Money from confirmed orders, with the order count and average order value"],
          ] },
        biz: "ecommerce" },

      { table: { head: ["Card", "What it counts"],
          rows: [["**Bookings**", "Confirmed bookings, and what share of your customers that is"]] },
        biz: "agency" },

      { note: "**Bot resolved** is the number to watch week to week. Rising means your training is working. Falling means customers are asking things the bot does not know yet — and **What customers ask about**, further down, usually tells you what.",
        kind: "tip" },

      { h: "Conversation health",
        p: ["Three bars that answer one question: is the bot actually coping?"],
        table: { head: ["Bar", "What it means"],
          rows: [
            ["**Handled by bot alone**", "The bot answered and nobody needed you. This is the one to grow"],
            ["**Needed a human agent**", "You took over. Normal — but a rising share is worth investigating"],
            ["**Never answered**", "Somebody wrote and got nothing back"],
          ] } },

      { note: "**Never answered** should be zero. Anything above it means a channel was disconnected, or the bot was paused, at the moment those people wrote. The tab prints a warning under the bars when it happens.",
        kind: "warn" },

      { h: "Customer mix",
        p: ["New people against people who came back, plus a count of the **photos** and **voice messages** customers sent. If those two numbers are high, your customers prefer showing to typing — worth knowing before you write your bot's training."] },

      { h: "Channels",
        p: ["Which platform is actually carrying your business, by message count and by how many separate customers came through it. Useful when deciding where to spend on advertising."] },

      { h: "When customers message",
        p: [
          "A grid of seven rows (Sunday to Saturday) by twenty-four hours, in **Bangladesh time**: the darker a cell, the more customers wrote then, and the busiest hour is outlined. Friday evening and Monday morning stop being averaged into one number.",
          "Above it, **Message volume** is one bar per day — the whole bar is every message that day, the filled part is what the bot answered.",
          "This is the most practical chart on the page: it tells you the hours worth being personally available, and the hours you can safely leave to the bot.",
        ] },

      { h: "What customers ask about",
        p: ["The words that come up most often in customer messages. Read it as a to-do list for **Bot Training** — a word appearing often that your bot handles badly is the single most valuable thing you can fix."] },

      { h: "Best selling products",
        p: ["Taken from confirmed orders only, so it reflects what people actually bought rather than what they asked about. Underneath, **Orders over time** and the conversion figure show what share of the people who wrote to you ended up ordering."],
        biz: "ecommerce" },

      { h: "Most requested services",
        p: ["Taken from confirmed bookings only. Underneath, **Bookings over time** and the conversion figure show what share of the people who wrote to you ended up booking."],
        biz: "agency" },

      { h: "If something goes wrong",
        faq: [
          { q: "Everything shows zero.",
            a: "Either no channel is connected yet, or nobody has written in the period you are looking at. Try the 90-day view; if that is empty too, check **Channels**." },
          { q: "Bot resolved says a dash instead of a number.",
            a: "There were not enough finished conversations in the period to work out a percentage. It fills in on its own once there are." },
          { q: "Revenue looks too low.",
            a: "Only **confirmed** orders count. Anything still Pending is not in the figure. Check the status breakdown at the bottom of the tab." },
          { q: "The numbers differ from what Facebook shows me.",
            a: "They count different things. Meta counts everything on your Page including comments and reactions; TellMore AI counts the conversations it actually handled. Some difference is expected." },
          { q: "Why Bangladesh time?",
            a: "Because your customers are there. Fixing the clock to one place means the peak hour means the same thing whether you check it from Dhaka or from abroad." },
        ] },
    ],
  },

  "broadcast": {
    title: "Broadcast",
    lead: "One message to many customers at once — inside the 24-hour window the platforms allow, with the audience checked before anything is sent.",
    time: 6,
    blocks: [
      { h: "The one rule that governs everything here",
        p: [
          "You may only message someone who wrote to you **in the last 24 hours**.",
          "This is Meta's rule, not ours, and it applies to every tool that sends on Facebook, Instagram or WhatsApp. TellMore AI enforces it because sending outside the window is what gets Pages restricted and blocked.",
        ] },

      { note: "So a broadcast is not a newsletter. It is a way to reach people **who are already talking to you today** — a flash offer, a stock update, an apology for a delay. Plan it around your peak hour in **Analytics**.",
        kind: "warn" },

      { shot: "broadcast", cap: "The composer with its four filters, the allowance left this month, and past broadcasts underneath." },

      { h: "Sending one",
        steps: [
          "Write your message. The counter under the box shows how much room you have left.",
          "Choose the **Channel** — all connected channels, or just one.",
          "Choose **Who**: people active in the last 6, 12 or 24 hours.",
          "Narrow it further by order history and by tag if you want to.",
          "Press **Check who will get it**.",
          "Read the result, then press **Send now**.",
        ] },

      { note: "**Send now** stays disabled until you have checked the audience. That is deliberate — a broadcast cannot be taken back, so the dashboard makes you look at the list first.",
        kind: "tip" },

      { h: "The filters",
        table: { head: ["Filter", "What it does"],
          rows: [
            ["**Channel**", "All connected channels at once, or a single platform"],
            ["**Who**", "How recently the person wrote — 6, 12 or 24 hours"],
            ["**Order history**", "Everyone · Has ordered before · Never ordered"],
            ["**Tag**", "Only people whose conversation carries a tag you set in Inbox"],
          ] },
        biz: "ecommerce" },

      { table: { head: ["Filter", "What it does"],
          rows: [["**Booking history**", "Everyone · Has booked before · Never booked"]] },
        biz: "agency" },

      { p: ["Combining them is where this gets useful: *people active in the last 6 hours who have never ordered* is a very different message from *people who have ordered before*."] },

      { h: "Reading the check",
        table: { head: ["Number", "What it means"],
          rows: [
            ["**will receive it**", "People the message can legally and technically reach right now"],
            ["**cannot be messaged**", "People who match your filters but are outside the window or blocked for another reason"],
            ["For example: …", "A few real names, so you can sanity-check you are aiming at the right group"],
            ["Why some are left out", "The exact reason for each person who was skipped"],
          ] } },

      { p: ["If the audience is larger than your plan allows, a red line says how many messages you have left in the current period. The remaining allowance is also printed under the card at all times."] },

      { h: "While it sends",
        p: [
          "A counter shows **Sending… X of Y** and then **Finished — N sent**. Large audiences are sent in batches, so leave the tab open until it says finished.",
          "If some failed, the count says so and the exact reason for each one is in the history below.",
        ] },

      { h: "Past broadcasts",
        p: ["Every broadcast you have sent, newest first, with what it said, when, on which channel, and its badges: **sent**, **replied** (how many of those people wrote back afterwards), **failed** and **skipped**. Tap any of them to open the full recipient list with a status line per person."] },

      { h: "If something goes wrong",
        faq: [
          { q: "It says no channel is ready for broadcasts.",
            a: "Connect Facebook, Instagram or WhatsApp in **Channels**, and make sure the channel is not paused there. The website widget cannot receive broadcasts at all — once a visitor closes the tab there is no address left to send to." },
          { q: "The check says almost nobody will receive it.",
            a: "That is the 24-hour window doing its job. Widen **Who** to 24 hours, and send during or just after your peak hour — **Analytics** tells you when that is." },
          { q: "Some messages failed.",
            a: "Open that broadcast in the history to see the reason for each. The usual causes are the person blocking your Page, deleting their account, or the window closing while the batch was still running." },
          { q: "Can I schedule one for later?",
            a: "No, and it would not help: by the time a scheduled message ran, most of your audience would have fallen outside the 24-hour window. Sending it yourself at the right moment is what makes it land." },
          { q: "Can I take one back?",
            a: "No. Once a message reaches Facebook, Instagram or WhatsApp it belongs to them. This is why the dashboard makes you check the audience and confirm before it sends." },
        ] },
    ],
  },

  "inventory": {
    title: "Inventory and Knowledge Base",
    lead: "What your bot sells from. An online shop puts products here; an agency puts documents. This one tab changes completely depending on your business type.",
    time: 8,
    blocks: [
      { h: "Which one you have",
        p: [
          "The tab is called **Inventory** for an online shop and **Knowledge Base** for an agency, and they are genuinely different screens. Your business type in **Profile** decides which you see.",
          "Both do the same job: they are the facts the bot answers from.",
        ] },

      { shot: "inventory", cap: "The Inventory tab: counters at the top, category filters, and each product with its price and stock badge.",
        biz: "ecommerce" },

      { shot: "knowledge", cap: "The Knowledge Base tab: the documents your bot answers from.",
        biz: "agency" },

      { h: "Adding products",
        p: ["There are three ways in, and the second one saves the most time."],
        table: { head: ["Way", "Best for"],
          rows: [
            ["**Add a product**", "Typing one in by hand — name, photos, price, variants"],
            ["**Paste a product URL**", "You already have the product on a website. We fetch the name, photo and price for you"],
            ["**Import WooCommerce**", "Bringing an entire existing shop over in one go"],
          ] },
        biz: "ecommerce" },

      { h: "Filling in a product",
        table: { head: ["Field", "What to put"],
          rows: [
            ["**Product name**", "The only required field. Write it the way a customer would say it"],
            ["Product code / SKU", "Filled in automatically if you leave it empty"],
            ["Brand", "Optional"],
            ["Category", "Supports levels, like `Men › Panjabi`"],
            ["Tags", "Comma separated — `cotton, summer, gift`. The bot uses these to match loose questions"],
            ["Regular price / Sale price", "In taka. A sale price shows the old one struck through"],
            ["Quantity", "Optional. Leave it empty if you do not track stock"],
            ["Description", "Describe it the way you would to a customer — this is what the bot borrows from"],
            ["Photos", "Upload, or paste an image link starting with `https://`"],
            ["Variants", "Add an option such as Size, then its values. Each value can carry its own code, price and quantity"],
          ] },
        biz: "ecommerce" },

      { note: "Write the description as if you were explaining the product to a customer standing in front of you. The bot answers out of these words, so a description reading *soft cotton, does not shrink, good for summer* produces far better replies than *Cotton Panjabi Navy*.",
        kind: "tip" },

      { h: "Finding things later",
        p: ["Once you have more than a handful of products, four controls do the work:"],
        table: { head: ["Control", "What it does"],
          rows: [
            ["**Search**", "Looks in name, code, tag and brand at once"],
            ["**Category filter**", "One category, or everything not yet filed under one"],
            ["**Sort**", "Newest first · Name A–Z · Price low → high · Price high → low · **Stock issues first**"],
            ["**Grid / table**", "Pictures for browsing, rows for working through a long list. Your choice is remembered"],
          ] },
        biz: "ecommerce" },

      { p: ["The four counters at the top — **Products**, **Categories**, **Variants** and **Low stock** — are the quickest daily check. **Stock issues first** puts everything that needs attention at the top of the list."],
        biz: "ecommerce" },

      { h: "Changing several at once",
        p: ["Tick the boxes on several products and a bar appears at the bottom of the screen. From there you can mark them all in stock or out of stock, or delete them together — much faster than opening each one."],
        biz: "ecommerce" },

      { note: "Marking something **out of stock** is better than deleting it. The bot then tells customers it is unavailable instead of pretending it never existed, and you can bring it back with one tap when it returns.",
        kind: "tip" },

      { h: "Hiding a product from the bot",
        p: [
          "Every product has a **Bot sells** switch — in the table view, and inside the product panel next to Availability. Switch it off and the bot stops offering that product: it will not bring it up, match a customer's photo to it, or take an order for it. Nothing is deleted; the photos, prices and variants stay exactly as they were, and the **Hidden** filter lists them.",
          "This is different from **Out of stock**. Out of stock is a fact the bot tells customers who ask. Hidden means the bot behaves as if the product were not there — a seasonal line you are resting, a wholesale-only item, something being photographed again.",
        ],
        biz: "ecommerce" },

      { h: "Uploading documents",
        p: [
          "An agency's bot answers from your own documents rather than a price list. Press **Upload** and pick a **PDF**, **Word (DOCX)**, text, Markdown or CSV file — or, on a computer, drop the files onto the dashed strip above the list. Several at once is fine; they are read one after another.",
          "TellMore AI reads the file, breaks it into pieces and indexes them. The card then shows **Ready** with how many pieces were indexed — that number is only a progress signal; a bigger document simply makes more. A document that is still being read, or that could not be read, says so on its card instead.",
        ],
        biz: "agency" },

      { p: ["Good documents to upload: your service list with prices, your standard proposal, your terms, a frequently-asked-questions sheet, case studies. Anything you find yourself sending clients over and over."],
        biz: "agency" },

      { note: "The bot answers **using only this information**, plus what you wrote in Bot Training. That is deliberate — it is what stops it inventing a service you do not offer. If it cannot answer something, the fix is to upload a document that covers it.",
        kind: "warn",
        biz: "agency" },

      { p: ["The bin icon removes a document and everything indexed from it, immediately. Upload a corrected version afterwards if you are replacing it rather than dropping it."],
        biz: "agency" },

      { h: "If something goes wrong",
        faq: [
          { q: "The bot quotes an old price.",
            a: "Update the price here and it changes at once — there is nothing to republish. If it is still wrong, check whether the same product exists twice; search the name and delete the duplicate." },
          { q: "The bot says something is available when it is not.",
            a: "Set that product to **out of stock**, or set its quantity to zero. **Stock issues first** in the sort menu shows you everything in that state." },
          { q: "Pasting a product URL did not fill anything in.",
            a: "Some shop websites block automatic reading. Add the product by hand instead — it is a minute's work, and the result is identical." },
          { q: "My WooCommerce import failed.",
            a: "The website address must be the shop's own address, and the consumer key and secret must be generated in WooCommerce under WooCommerce → Settings → Advanced → REST API, with **Read** access. A key made for a different site will not work." },
          { q: "I uploaded a document but the bot does not seem to know it.",
            a: "Two things to check. Scanned PDFs that are really photographs of pages have no text to read — export a text-based PDF instead. And ask the question using words that actually appear in the document; the bot matches on meaning, but it cannot answer about something the file never mentions." },
        ] },
    ],
  },

  "orders": {
    title: "Orders and Bookings",
    lead: "What the bot closed for you. An online shop gets orders taken in chat; an agency gets meetings booked straight into Google Calendar.",
    time: 7,
    blocks: [
      { h: "Which one you have",
        p: ["The tab is **Orders** for an online shop and **Bookings** for an agency. Your business type in **Profile** decides which one appears."] },

      { shot: "orders", cap: "The Orders tab: Needs action first, then every order with its status and next button.",
        biz: "ecommerce" },

      { shot: "bookings", cap: "The Bookings tab: the month, each meeting with its time, and a button that opens the Google Meet link.",
        biz: "agency" },

      { h: "How an order gets here",
        p: [
          "The bot takes it during the conversation. When a customer says what they want and gives a name, phone number and address, the bot writes the order down and it appears here as **Pending**.",
          "Nothing is shipped or charged automatically. Everything after this point is yours to do.",
        ],
        biz: "ecommerce" },

      { h: "Moving an order along",
        p: ["Each order carries a status, and the buttons walk it forward one step at a time:"],
        table: { head: ["Status", "What it means", "Button"],
          rows: [
            ["**Pending**", "The bot took it, you have not checked it yet", "**Confirm**"],
            ["**Confirmed**", "You have accepted it", "**Mark shipped**"],
            ["**Shipped**", "It is with the courier", "**Mark delivered**"],
            ["**Delivered**", "Finished. This is what counts as revenue in Analytics", "—"],
            ["**Cancelled** · **Returned**", "Did not complete. Left out of revenue", "—"],
          ] },
        biz: "ecommerce" },

      { note: "Only **Delivered** orders count towards the Revenue figure in **Analytics**. If your revenue looks lower than you expect, it is usually a pile of orders still sitting on Confirmed.",
        kind: "warn",
        biz: "ecommerce" },

      { h: "The three quick filters",
        p: ["Above the list: **Needs action**, **Today**, **Delivered** and **All orders**. **Needs action** is the one to open every morning — it is everything waiting on you."],
        biz: "ecommerce" },

      { p: ["Then **Search** (order number, name, phone or product), a date range of **All time · Last 7 days · Last 30 days**, and a sort of **Newest · Oldest · Highest amount**."],
        biz: "ecommerce" },

      { h: "Opening one order",
        p: [
          "On a laptop the orders are a table — one row each, with the next step's button at the end of the row. On a phone they are cards. Either way, tap an order and a panel slides in with everything about it — customer, address, items, subtotal, delivery, discount, payment method and which channel it came from.",
          "Three buttons sit at the top of the panel: the **next step** (Confirm, Mark shipped, Mark delivered), **Call**, which dials the customer's number, and **Chat**, which opens their conversation in the Inbox — handy when you need to ask about a size or an address before you ship.",
        ],
        biz: "ecommerce" },

      { table: { head: ["What you can do", "Why"],
          rows: [
            ["Edit **name, phone, delivery area, address**", "The bot writes down what the customer typed; typos happen"],
            ["Set **delivery charge**", "Inside or outside the city usually differ"],
            ["Set **payment method**", "Defaults to cash on delivery"],
            ["**Copy name, phone, address**", "One tap, ready to paste into your courier's form"],
            ["Add a **note**", "Courier and tracking number, or a special request. Only you see it"],
          ] },
        biz: "ecommerce" },

      { note: "The **Copy name, phone, address** button is the one that saves real time. It puts all three on your clipboard in one go, formatted for pasting straight into Pathao, Steadfast or whichever courier you use.",
        kind: "tip",
        biz: "ecommerce" },

      { p: ["The download icon exports what you are currently looking at as a CSV file, filters included — useful for accounts, or for handing a day's orders to someone else."],
        biz: "ecommerce" },

      { h: "Connect Google Calendar first",
        p: [
          "Bookings only work once your calendar is connected — and this is where you connect it. If it is not connected, the tab says so and shows you the button.",
          "It takes about a minute, there is nothing to install, and you log in with your own Google account. TellMore AI only uses it to check when you are free and to create the meetings — nothing else in your calendar is read or touched.",
          "Once connected, the top of the tab shows which Google account is linked, with a **Disconnect** button right there. Disconnecting removes our access at once; bookings already made stay listed, but the bot stops taking new ones.",
        ],
        biz: "agency" },

      { h: "How a booking gets here",
        steps: [
          "A customer asks for a meeting during a conversation.",
          "The bot checks your calendar for a free slot.",
          "It offers times, the customer picks one, and the bot confirms.",
          "The event is created in **your** Google Calendar with a **Google Meet link**, and the customer is sent that link on the channel they wrote from.",
        ],
        biz: "agency" },

      { h: "The calendar",
        p: [
          "The month view marks every day that has something booked; tap a day to see just that day. Above it, **Next 7 days** and **This month** switch the range, and the arrows move between months. On a laptop the month is open from the start; on a phone a strip of the next seven days sits above it — a dot for each meeting — and the month is one tap away below.",
          "The list underneath is grouped by when: **Today**, **Later this week**, **Coming up**, and **Past** at the bottom. Choose a day or a range and the headings give way to that day's list.",
          "Each booking shows the person, the time, which channel they came from, and a **video** icon that opens the Meet link.",
        ],
        biz: "agency" },

      { table: { head: ["Status", "What it means"],
          rows: [
            ["**Confirmed**", "Booked and in your calendar"],
            ["**Completed**", "The meeting has happened"],
            ["**Cancelled**", "Called off. The calendar event is removed too"],
          ] },
        biz: "agency" },

      { note: "Cancelling here also deletes the event from Google Calendar. If the calendar event cannot be removed for some reason, the dashboard tells you plainly and asks you to delete it in Google Calendar yourself, rather than pretending it worked.",
        kind: "warn",
        biz: "agency" },

      { h: "If something goes wrong",
        faq: [
          { q: "An order came through with the wrong phone number.",
            a: "Open the order and edit it. The bot records what the customer typed, and people mistype their own numbers more often than you would think." },
          { q: "The bot did not take an order even though the customer wanted one.",
            a: "It needs a name, a phone number and an address before it will write one down. If the customer never gave all three, look at the conversation and take it by hand." },
          { q: "My revenue in Analytics is lower than my orders.",
            a: "Revenue counts **Delivered** only. Open **Needs action** and walk the outstanding ones forward." },
          { q: "The bot is offering times when I am busy.",
            a: "It reads whatever is in the Google Calendar you connected. If your other commitments live in a different calendar, the bot cannot see them — put them in the connected one, or block the time there." },
          { q: "The Google Meet link is missing.",
            a: "Meet links are created by Google when the event is made. If one is missing, the account you connected may not have Meet enabled. Reconnect the calendar, and if it persists, write to us." },
          { q: "I disconnected Google Calendar. What happens to existing bookings?",
            a: "They stay listed in this tab, but the bot stops taking new ones and can no longer add or remove events in your calendar. Reconnect and it picks up where it left off." },
        ] },
    ],
  },

  "bot-training": {
    title: "Bot Training",
    lead: "Where you teach the bot your business. Answer its questions and it writes its own training from your answers — then set your offers, your bargaining rule and how it sounds.",
    time: 9,
    blocks: [
      { h: "Why the tab is called this",
        p: [
          "It used to be called Settings, and owners looked straight past it. Everything on this page teaches or tunes the bot, so it says what it does.",
          "This is the single most valuable tab in the dashboard. A bot trained for twenty minutes here answers better than one connected to five channels and taught nothing.",
        ] },

      { p: ["Four sections across the top: **Train**, **Offers**, **Bargaining** and **Behavior**. A checklist above them shows how far along you are — Identity, Business, Policies, Services, Q&A, Offers, Bargaining."] },

      { shot: "bot-training", cap: "The checklist across the top, the four sections, and the interview waiting for your first answer." },

      { h: "Train — the interview",
        p: [
          "The bot asks you questions about your business, one at a time, and writes its own training from your answers. You can switch between a **Chat** view and a **Form** view; the form is faster once you know the questions.",
          "**Write in whichever language you like.** Bangla, English or a mix — the bot understands all three, and it will still answer each customer in whatever language that customer used.",
        ] },

      { p: ["It asks about your products and best sellers, delivery time and charge, where you deliver, payment methods, advance payment, your return policy, what to say when something is out of stock, warranty, opening hours, how to handle an angry customer, and your most common questions with your answers."],
        biz: "ecommerce" },

      { p: ["It asks what you do and for whom, your services and prices, how pricing works, how you work with a client step by step, how long before results show, who you usually work with, contract and payment terms, how clients book a consultation, your availability, common objections and how you answer them, and your most common questions with your answers."],
        biz: "agency" },

      { steps: [
          "Answer as many as you can. Skip anything that does not apply — nothing is required.",
          "Press **Generate my bot's profile**. The bot turns your answers into the text it works from.",
          "Press **Save**.",
        ] },

      { note: "Answer as if you were training a new employee on their first day, not filling in a form. *Delivery inside the city is 60 taka and takes one to two days; outside is 120 and takes two to three* teaches the bot far more than *60/120*.",
        kind: "tip" },

      { p: ["Underneath sits **Teach it more** — a box for anything new, any time. A rule you forgot, a price change, something a customer asked that the bot fumbled. What you add there is remembered on top of everything above, so you never have to redo the interview."] },

      { h: "Offers — deals the bot quotes exactly",
        p: ["Write a running offer once and the bot brings it up whenever a customer asks about the things it applies to. It quotes your wording rather than inventing its own."],
        steps: [
          "Press **Add offer**.",
          "Pick which products the offer applies to.",
          "Write the offer the way a customer should hear it, and add the conditions underneath.",
          "Set **Valid until**.",
          "Press **Organise with AI** to tidy your wording, then **Save**.",
        ],
        biz: "ecommerce" },

      { steps: [
          "Press **Add offer**.",
          "Type the service names the offer applies to.",
          "Write the offer the way a client should hear it, and add the conditions underneath.",
          "Set **Valid until**.",
          "Press **Organise with AI** to tidy your wording, then **Save**.",
        ],
        biz: "agency" },

      { note: "Offers stop **automatically** on their end date, so a Ramadan discount does not still be quoted in July. Each one also has its own Live / Off switch if you want to pause it early.",
        kind: "tip" },

      { h: "Bargaining — how it answers “can you do it cheaper?”",
        p: ["Customers will ask. This section decides what happens when they do, and it is one of three choices:"],
        table: { head: ["Choice", "What the bot does"],
          rows: [
            ["**Never discount**", "Politely holds your listed price, and talks about value or a running offer instead"],
            ["**Discount up to a limit**", "Negotiates in small steps and never goes below the percentage you set"],
            ["**My own rule**", "Follows a rule you write in your own words, in any language"],
          ] } },

      { note: "The bot **never reveals your limit** and **never offers a discount before the customer asks**. If you pick a limit, the tab shows a worked example so you can see exactly how low it could go on a given price.",
        kind: "warn" },

      { p: ["**My own rule** is worth using once your rules have exceptions — *no discount under 500; above that, at most 50 off; three or more, free delivery may be offered*. Write it the way you would explain it to a shop assistant."] },

      { h: "Behavior — how it sounds and what it does on its own",
        table: { head: ["Setting", "What it controls"],
          rows: [
            ["**Bot name**", "What it calls itself"],
            ["**Business name**", "What it calls you"],
            ["**Greeting**", "The first thing a new customer sees"],
            ["**Tone**", "Friendly and helpful · Professional and formal · Casual and fun"],
            ["**Customer languages**", "Follow the customer's language · Bangla only · English only"],
          ] } },

      { note: "**Follow the customer's language** is almost always the right choice. Someone who writes in Bangla gets Bangla, someone who writes in English gets English, and someone who mixes gets a mix. Forcing one language only helps if you have a reason to.",
        kind: "tip" },

      { h: "The follow-up message",
        p: [
          "Somebody asked about something and never ordered. Switch this on and the bot sends **one** reminder, after however many hours you choose.",
          "They get it **once**, and it stops immediately if they reply.",
        ] },

      { note: "The delay caps at **23 hours**, and that is not an arbitrary number: Facebook, Instagram and WhatsApp shut the messaging window 24 hours after the customer's last message. Anything later simply cannot be delivered.",
        kind: "warn" },

      { h: "Guardrails",
        p: ["A set of platform rules that are **always on and cannot be changed** — they keep every bot on the service safe and within Meta's policies. Press **See the rules** to read exactly what they are. They are added on top of your training automatically; you never have to write them yourself."] },

      { h: "Advanced — the bot's business profile",
        p: [
          "This is the exact text the bot works from. The **Train** tab writes it for you, and most owners never need to open it.",
          "You can edit it freely if you want to — the guardrails are still added on top. But if you are not sure why you are changing something, use the Train tab and **Teach it more** instead: they cannot break anything.",
        ] },

      { h: "If something goes wrong",
        faq: [
          { q: "I saved my training but the bot answers the same as before.",
            a: "Changes are live immediately, so first check that **Save** actually completed — the button says *Saved* when it has. Then test in a brand new conversation: an ongoing chat carries its earlier context along and can look unchanged for a few messages." },
          { q: "The bot invents things I never told it.",
            a: "That usually means it was asked something your training does not cover, so it filled the gap. Add the missing fact through **Teach it more**. The more complete the training, the less room there is to improvise." },
          { q: "It gives a discount I did not authorise.",
            a: "Check the **Bargaining** section. If it is set to *Discount up to a limit*, the bot may go down to that limit. Set *Never discount*, or lower the percentage." },
          { q: "It answers in English when customers write in Bangla.",
            a: "Set **Customer languages** to *Follow the customer's language*. If it is already on that, check you have not written your training only in English with an instruction to reply in English." },
          { q: "Can I undo the Advanced text if I break it?",
            a: "Yes. Go back to the **Train** tab and press **Generate my bot's profile** again — it rewrites the profile from your interview answers, and your **Teach it more** entries are kept." },
        ] },
    ],
  },

  "ai-engine": {
    title: "AI Engine",
    lead: "Which AI powers your bot. By default it is ours, included in your plan — and if you would rather run on your own Google Gemini key, this is where you put it.",
    time: 5,
    blocks: [
      { h: "You probably do not need this tab",
        p: [
          "Out of the box your bot runs on **TellMore AI's AI**. Nothing to set up, nothing extra to pay, it is part of your plan. Most owners never open this tab, and that is fine.",
          "It exists for businesses that want the AI usage billed to their own account instead of ours.",
        ] },

      { shot: "ai-engine", cap: "An account running on its own key: the key shown masked, the main model and the fallback." },

      { h: "Bringing your own key",
        p: ["Two things have to be true before you can:"],
        steps: [
          "Your account must be **enabled** for it. That is a permission we grant — write to us and ask.",
          "You need a **Google AI (Gemini)** API key of your own, from `aistudio.google.com` → *Get API key*.",
        ] },

      { p: ["Once enabled, the tab shows a box for the key."],
        steps: [
          "Paste your key.",
          "Press **Check key & load models**. We test it against Google before saving anything.",
          "If it works, we pick a sensible main model and a fallback for you. Change them if you want to.",
          "Press **Verify & activate**.",
        ] },

      { note: "The key is checked with Google **before** it is saved, so a mistyped key fails at that moment rather than quietly breaking your bot an hour later. Once saved it is encrypted, and no dashboard — yours or ours — ever shows more than a masked form of it.",
        kind: "tip" },

      { h: "Main model and fallback",
        p: ["The main model answers your customers. The fallback takes over if the main one is busy or unavailable, so a momentary problem at Google does not leave a customer waiting. A higher-quality main model gives better answers and costs you more per message — the choice is yours, since it is your bill."] },

      { h: "What happens if your key stops working",
        p: [
          "If your key runs out of quota, is revoked, or stops working for any reason, the tab says **Not working — bot paused** and your bot stops replying, politely.",
          "It does **not** fall back to TellMore AI's AI.",
        ] },

      { note: "That is deliberate, and it is the point of the whole feature: on your own key you run **only** on your own key. Silently routing you back to our AI would hand you an invisible bill you never agreed to. So the bot pauses and tells you, and you fix the key.",
        kind: "warn" },

      { h: "Going back to ours",
        p: ["Remove the key and the tab confirms: *your bot is back on the platform's AI*. It resumes answering immediately, on your plan, at no extra cost. Nothing about your training, channels or history changes."] },

      { h: "One thing always runs on our key",
        p: [
          "Searching your own products and documents needs the text turned into numbers first — and every saved item has to be turned into numbers by **the same model**, or the search silently stops matching.",
          "So that one step always runs on the same model for everybody, whichever key answers your customers. It is a tiny fraction of the work and it is included in your plan either way.",
        ] },

      { h: "If something goes wrong",
        faq: [
          { q: "The tab says my account is not enabled for this.",
            a: "Running on your own key is a permission we grant per account. Write to us and ask for it — there is nothing you can switch on yourself." },
          { q: "My key was rejected.",
            a: "Three usual causes: the key was copied with a space at one end, it is not a **Google AI (Gemini)** key, or the Google project it belongs to does not have the Gemini API enabled. Generate a fresh one at `aistudio.google.com` and paste it again." },
          { q: "My bot stopped and the tab says the key is not working.",
            a: "Almost always the free quota has run out for the day, or billing lapsed on the Google account. Check the key in Google AI Studio. Removing the key here puts you straight back on our AI while you sort it out." },
          { q: "Can I use OpenAI, or another provider?",
            a: "For answering customers, only Google Gemini keys are supported today. Product and document search always runs on our Gemini model regardless, so nothing breaks either way." },
          { q: "Will this make my bot better?",
            a: "Not by itself. What the bot knows comes from **Bot Training**, not from whose key pays for it. Choose your own key when you want the usage on your own account — an untrained bot on an expensive model is still an untrained bot." },
        ] },
    ],
  },

  "billing": {
    title: "Billing",
    lead: "Your plan, how much of it you have used, and how to pay for a bigger one with bKash or Nagad.",
    time: 4,
    blocks: [
      { h: "Your current plan",
        p: [
          "The card at the top shows which plan you are on and two counters: **Bot replies today** and **Bot replies this month**. On an unlimited plan it says so instead of counting.",
          "A “message” here is **one bot reply to one customer message** — one, even when the answer comes as two or three bubbles. Replies you send yourself, from anywhere, are never counted, and nothing is counted while the bot is off.",
        ] },

      { note: "These are the same limits the bot itself enforces. When you run out, the bot stops replying — so it is worth glancing at this card before a big campaign or a festival rush, not after.",
        kind: "warn" },

      { shot: "billing", cap: "The current plan with what is left this month, the plans you can move to, and your payment history." },

      { h: "Changing plan",
        steps: [
          "Press **Choose a plan** or **Upgrade your plan**.",
          "Pick a plan. The one most businesses choose is marked **Popular**, and the one you are on is marked **Current**.",
          "Choose **Monthly** or **Yearly**. Yearly gives you **two months free**.",
        ] },

      { h: "Paying",
        p: ["Payment is by mobile money, and it is a **Send Money** transfer — not a merchant payment."],
        steps: [
          "The page shows the exact amount and the numbers you can send to. The copy icon beside a number puts it on your clipboard.",
          "Open bKash or Nagad and **Send Money** for exactly that amount.",
          "Come back and enter the **Transaction ID** from your payment receipt. Your own number is optional but helps us match it faster.",
          "Press **Submit payment**.",
        ] },

      { note: "Send the amount **exactly**. A payment that is short, or sent as a merchant payment instead of Send Money, takes much longer to match up and may need to be sent again.",
        kind: "warn" },

      { h: "After you submit",
        p: [
          "A card appears saying **Payment under review**. A person checks the transaction against the number you sent to, then your plan changes.",
          "Nothing is automatic here, so allow a little time. If it has not moved within a working day, write to us with the transaction ID.",
        ] },

      { p: ["**Payment history** at the bottom lists everything you have submitted, with its transaction ID, so you always have a record."] },

      { h: "If something goes wrong",
        faq: [
          { q: "The page says payment numbers are not configured.",
            a: "That is on our side, not yours — no numbers have been set up for the account yet. Write to us and we will complete the payment for you directly." },
          { q: "I paid but my plan has not changed.",
            a: "A person has to match the transaction first. If a working day has passed, write to us with the transaction ID and the number you sent from." },
          { q: "I entered the transaction ID wrongly.",
            a: "Submit it again with the correct one. A duplicate submission is not charged twice — matching is done against the actual transaction, not against what you typed." },
          { q: "What happens when I hit my message limit?",
            a: "The bot stops replying until the period resets or you upgrade. Your conversations, orders and training are untouched — nothing is lost, it simply pauses." },
          { q: "Is yearly really cheaper?",
            a: "Yes — a yearly plan is twelve months for the price of ten. If you are past your trial and intend to keep using it, yearly is straightforwardly better value." },
          { q: "Can I pay with a card?",
            a: "Not at the moment. bKash and Nagad Send Money are the supported methods." },
        ] },
    ],
  },

  "packages": {
    title: "Packages",
    lead: "A free trial, then three sizes for shops and three for services, each with a lower price on your own AI key. Every package carries every feature; what changes is how much. Which is yours, and what happens when you reach a limit.",
    time: 5,
    blocks: [
      { h: "Two ladders, not one",
        p: [
          "A shop and a service do not buy the same thing. A shop shows customers a **catalogue**, matches a photo to a product and takes an order. A service answers from **documents you upload** and books time in your **calendar**.",
          "So the packages come in two sets. You see only the set for your own business — the one you chose when you signed up. Everything below that is not marked as one or the other is in both.",
        ] },

      { table: { head: ["", "Shops", "Services"], rows: [
        ["Answers from", "Your product catalogue", "Documents you upload"],
        ["Takes", "Orders", "Bookings"],
        ["Photo from a customer", "Matched to a product", "—"],
        ["Google Calendar", "—", "Books the meeting and sends the link"],
      ] } },

      { h: "The free trial",
        p: [
          "The same for everybody, because when you start you may not have chosen yet. It gives you **30 bot replies a day** on **one channel**, with everything switched on so you can see what the bot does with your own customers.",
          "It costs nothing and needs no card. When it ends the bot stops replying, but nothing is deleted — your products, documents and conversations wait for you.",
        ] },

      { h: "The three sizes",
        p: [
          "Two sets of three: one for shops, one for services. They grow the same way — replies, channels, AI Assistant questions — but a shop is sized by the products it adds and a service by the knowledge documents it adds. Services cost less, because there is no catalogue for the AI to read. Each set has a lower price for a business on its own AI key.",
          "**Every tier has every feature.** Moving up does not unlock anything — photo matching, comment automation, calendar booking, the AI Assistant and your own AI key are in all three, and in the free trial. What you are buying is **size**: how many replies the bot may send, how many channels it answers on, how big a catalogue or how many documents it can hold.",
        ] },

      { table: { head: ["", "Basic", "Pro", "Enterprise"], rows: [
        ["Bot replies", "2,000 / month", "5,500 / month", "12,000 / month"],
        ["Channels", "2 + website widget", "All 3 + website widget", "All 3 + website widget"],
        ["AI Assistant questions / month", "100", "400", "800"],
        ["Broadcasts / month", "10", "40", "100"],
        ["Every feature", "Yes", "Yes", "Yes"],
        ["Priority support", "—", "—", "Yes"],
      ] } },

      { biz: "ecommerce", table: { head: ["For shops", "Shop Basic", "Shop Pro", "Shop Enterprise"], rows: [
        ["Price / month (launch price to 31 Dec 2026)", "৳2,699", "৳5,999", "৳11,999"],
        ["On your own AI key / month", "৳1,999", "৳4,499", "৳8,999"],
        ["Products you can add (total, never resets)", "500", "1,000", "2,500"],
        ["Products from a website link / month", "10", "40", "100"],
        ["Photo product matching", "Yes", "Yes", "Yes"],
        ["Add products from photos", "Yes", "Yes", "Yes"],
      ] } },

      { biz: "agency", table: { head: ["For services", "Service Basic", "Service Pro", "Service Enterprise"], rows: [
        ["Price / month (launch price to 31 Dec 2026)", "৳2,299", "৳4,999", "৳9,999"],
        ["On your own AI key / month", "৳1,699", "৳3,499", "৳7,499"],
        ["Knowledge documents you can add (total, never resets)", "20", "60", "150"],
        ["Google Calendar booking", "Yes", "Yes", "Yes"],
        ["Comment automation", "Yes", "Yes", "Yes"],
      ] } },

      { h: "When you reach a limit",
        p: [
          "You cannot run out of features — you already have all of them. What you can run out of is room: replies for the month, products or documents added, AI Assistant questions, website imports, broadcasts.",
          "Products and documents are counted as you **add** them, as a **total for as long as you use the package** — the number does not start again each month. Each one added uses one, and deleting it does not give it back: every add is read and indexed by the AI, so it has already been paid for. Need more room? Move up a package, and the new, bigger total counts what you have already added.",
          "**Billing** shows every meter under your package — how much is used and how much is left — and so does **Profile**.",
          "When that happens the dashboard says which limit and what it is, and nothing is deleted. Out of replies, the bot stops answering new customers until the month turns or you move up; your inbox keeps working and you can answer by hand. Out of product slots, the ones you have keep selling and the next one is refused.",
          "The tables above are the real numbers — the same ones the bot and the dashboard enforce, read from your package as the admin panel has it, not from a page written once.",
        ] },

      { h: "How a reply is counted",
        p: ["The unit is **one bot reply to one customer message**. Everything else is free:"],
        table: { head: ["What happens", "Counts as"],
          rows: [
            ["A customer writes, the bot answers", "**1** — even when the answer arrives as two or three bubbles"],
            ["A customer sends three messages in a row, the bot answers once", "**1**"],
            ["You answer yourself — from the dashboard, Messenger, Business Suite, WhatsApp or Instagram", "0"],
            ["The bot is off, or that chat is on manual, and a customer writes", "0"],
            ["A broadcast or a follow-up you send", "0"],
          ] } },

      { note: "So the number on your package is the number of customer questions the bot may answer for you. A long conversation with a bot that answers in short pieces costs no more than one that answers in one block.", kind: "tip" },

      { note: "**It is not a count of customers.** One customer usually asks five or six things — the price, the size, the delivery, and so on — and each answer is one. So 3,000 a month is roughly 600 customers, and the trial's 30 a day is about five or six customers a day. Read your package's number that way when you are deciding which one you need.", kind: "warn" },

      { h: "What the features mean",
        p: ["The words on a package, in plain language."] },

      { table: { head: ["", "What it does"], rows: [
        ["Bot replies", "How many customer messages the bot may answer in a month — one per answer, however many bubbles it takes. When they run out the bot stops replying until the month turns or you move up. Your own replies never count."],
        ["Channels", "How many Facebook Pages, Instagram accounts or WhatsApp numbers you may connect. The website chat widget is separate and does not use one."],
        ["Voice message understanding", "The bot listens to a voice note and answers it, instead of asking the customer to type."],
        ["Comment automation", "Replies to comments on your posts, and can carry the conversation into the inbox."],
        ["Broadcasts & follow-ups", "Sending one message to many people, and nudging somebody who went quiet. Both only ever reach people who wrote to you in the last 24 hours — that is Meta's rule, not ours."],
        ["Website chat widget", "The same bot, on your own website, in one line of code."],
        ["Your own AI key", "Run on your own Google or OpenAI key and pay the AI bill yourself. Useful at high volume."],
      ] } },

      { biz: "ecommerce", table: { head: ["For shops", "What it does"], rows: [
        ["Products", "How many products your catalogue may hold. The bot answers from these."],
        ["Photo product matching", "A customer sends a picture instead of a name, and the bot finds that product in your catalogue and quotes its real price."],
        ["Website imports", "Reading your existing shop or a WooCommerce/Shopify store to fill the catalogue without typing."],
      ] } },

      { biz: "agency", table: { head: ["For services", "What it does"], rows: [
        ["Knowledge Base documents", "Files you upload — price lists, policies, service descriptions — that the bot answers from."],
        ["Google Calendar booking", "The bot checks when you are free, books the meeting, makes the Meet link and sends it."],
        ["Website imports", "Reading pages from your own site into the Knowledge Base without typing them."],
      ] } },

      { h: "Moving between packages",
        steps: [
          "Open **Billing** in your dashboard. You will see only the packages for your business.",
          "Pick one and send the amount by bKash, Nagad or Rocket to the number shown.",
          "Enter the transaction ID. We check it, usually within a few hours, and the package starts.",
        ] },

      { note: "Paying yearly costs ten months instead of twelve. Moving up takes effect as soon as the payment is verified — you do not lose what is left of the month you paid for.", kind: "tip" },

      { faq: [
        { q: "Which set of packages do I see?", a: "The one for the business type on your account — shop or service. It was set when you signed up and it decides your whole dashboard, not just the packages: a shop gets Inventory and Orders, a service gets Knowledge and Bookings." },
        { q: "Can I change my business type?", a: "Ask support. It changes which tabs you have and which packages you can buy, so it is not a switch you should flip by accident." },
        { q: "What happens if I go over the message limit?", a: "The bot stops replying to new customers until the month turns or you move up a package. Nothing is deleted, and your inbox keeps working — you can still answer by hand." },
        { q: "Does the website widget use one of my channels?", a: "No. It has its own switch and does not take a channel slot. A package with one channel can still have the widget." },
        { q: "Why is there no unlimited package?", a: "Because every message costs us real money in AI, and a package that promises unlimited either has a hidden limit or loses money on its heaviest customer. The numbers on these packages are the ones we can actually honour." },
      ] },
    ],
  },
  "profile": {
    title: "Profile",
    lead: "Your business details, your logo, your business type, and your package at a glance.",
    time: 4,
    blocks: [
      { h: "Business information",
        p: ["Your **business name**, **phone**, **address** and **website**. The bot uses these when a customer asks where you are or how to reach you, so keeping them accurate saves you answering the same question by hand."],
        table: { head: ["Field", "Where it shows up"],
          rows: [
            ["Business name", "How the bot refers to you in every conversation"],
            ["Phone", "Given out when a customer asks how to call you"],
            ["Address", "Given out when a customer asks where you are"],
            ["Website", "Shared when a customer wants to browse"],
          ] } },

      { shot: "profile", cap: "Your business details on the left, your package on the right." },

      { h: "Business logo",
        p: ["Upload your logo here. It appears in the dashboard and on your website chat widget, so a visitor sees your brand rather than a generic robot."] },

      { h: "Business type",
        p: [
          "**E-commerce / Online shop** or **Agency / Service provider**. This is not a label — it changes the dashboard.",
        ],
        table: { head: ["", "Online shop", "Agency"],
          rows: [
            ["Two tabs become", "Inventory · Orders", "Knowledge Base · Bookings"],
            ["The bot is taught with", "Your product catalogue", "Your documents"],
            ["The bot can", "Take an order in chat", "Book a meeting on your calendar"],
            ["Its tags are", "Order, Product Inquiry, Delivery, Complaint, Other", "Booking, Service Inquiry, Complaint, Follow-up, Other"],
          ] } },

      { note: "You can change your business type here, and the dashboard follows immediately. What you already have does not transfer, though — products do not become documents. If you switch, plan on setting up the new side from scratch.",
        kind: "warn" },

      { h: "Resources",
        p: ["A count of what your bot has to work with — your products, or your knowledge files. A quick way to notice that an import did not land, or that a document you thought you uploaded is not actually there."] },

      { h: "Your package",
        p: ["The same figures as the Billing tab, repeated here so you can see them without leaving your profile: bot replies today, bot replies this month, and what your plan includes. The button takes you to **Billing** to change it."] },

      { note: "**Google Calendar now connects in the Bookings tab**, next to the meetings it powers — connect, see the connected account, and disconnect all in one place. (Agency accounts only.)",
        kind: "tip" },

      { h: "Notifications",
        p: [
          "One switch. On, **this device** gets a notification even when the dashboard is closed — a new order, a new booking, a chat that needs you, a channel that stopped working. Off, the bell in the top bar still works; only the phone stays quiet.",
          "The first time you turn it on, the phone or browser asks for permission. If it is blocked, the row says so and tells you where to allow it. The full picture — the bell, the phone, the emails — is on the **Notifications** page of this manual.",
        ] },

      { h: "If something goes wrong",
        faq: [
          { q: "My logo will not upload.",
            a: "Use a normal PNG or JPG. Very large files and unusual formats can fail — if yours is several megabytes, shrink it first." },
          { q: "I changed my business type and my products vanished.",
            a: "They are not deleted, they are simply not shown: an agency dashboard has no Inventory tab. Switch back to online shop and they reappear exactly as they were." },
          { q: "The bot gives out an old phone number.",
            a: "Update it here. Also check **Bot Training** — if you typed a phone number into your training text, that copy has to be corrected too." },
          { q: "Google Calendar says connected but the bot is not booking.",
            a: "Check the **Bookings** tab; it reports calendar problems in more detail. The usual cause is that your commitments live in a different Google calendar from the one you connected." },
          { q: "Where do I change my email or password?",
            a: "Those belong to your login rather than your business profile. Use the password reset link on the sign-in screen, or write to us to change the email address." },
        ] },
    ],
  },

  "faq": {
    title: "Common questions",
    lead: "The questions that come up most often, and the ones that do not belong to any single tab.",
    time: 6,
    blocks: [
      { h: "The bot is not replying",
        p: ["Work through these in order — it is almost always one of the first three."],
        steps: [
          "**Inbox** → is the **Bot ON** switch at the top of the chat list on? That one covers everything.",
          "Is that particular chat on **manual**? Its own switch is at the top of the open chat.",
          "**Channels** → is that channel's switch on, and its dot green?",
          "**Billing** → have you run out of messages for the period?",
          "**AI Engine** → if you run on your own key, has it stopped working?",
        ] },

      { h: "About the bot's answers",
        faq: [
          { q: "The bot said something wrong.",
            a: "Fix it in **Bot Training**. Use **Teach it more** for a single fact, or redo the interview if a lot has changed. It takes effect immediately." },
          { q: "It invents things.",
            a: "It fills gaps when asked about something your training does not cover. The cure is more complete training, not different wording." },
          { q: "It replies in the wrong language.",
            a: "**Bot Training → Behavior → Customer languages**. *Follow the customer's language* is nearly always what you want." },
          { q: "It is too formal, or too casual.",
            a: "**Bot Training → Behavior → Tone**: Friendly and helpful, Professional and formal, or Casual and fun." },
          { q: "Can I stop it discussing something entirely?",
            a: "Write the rule in **Teach it more** — for example *never discuss wholesale prices in chat; ask them to call the office*. The bot follows rules written in plain words." },
        ] },

      { h: "About the 24-hour rule",
        p: [
          "Facebook, Instagram and WhatsApp all close the messaging window **24 hours** after the customer's last message. After that you cannot write to them until they write to you again.",
          "This is Meta's rule and it applies to every business tool, not only TellMore AI. It explains three things people often ask about: why a broadcast reaches fewer people than expected, why the follow-up message caps at 23 hours, and why some private replies to comments fail.",
        ] },

      { h: "About your customers' privacy",
        faq: [
          { q: "Who can see my conversations?",
            a: "You, and anyone you give your login to. Every tenant's data is isolated at the database level — no other business on TellMore AI can reach yours." },
          { q: "Does TellMore AI post on my Page?",
            a: "Only what you have switched on: replies to messages, and public replies to comments if comment automation is on. It never writes a post." },
          { q: "What happens if I disconnect a channel?",
            a: "All processing for that channel stops at once. Your history stays in the dashboard until you delete it." },
          { q: "How do I delete everything?",
            a: "Conversations, orders and files can be deleted from their tabs. For the whole account, email us and it is done within 30 days." },
        ] },

      { h: "About phones and computers",
        faq: [
          { q: "Is there an app?",
            a: "The dashboard works in a phone browser and is built for it. On iPhone use Share → *Add to Home Screen*, and on Android use the browser menu → *Add to Home screen*; it then opens like an app." },
          { q: "Can two people use one account?",
            a: "Yes — share the login. Bear in mind that switches are shared too: if one person turns the bot off for a chat, everyone sees it off." },
          { q: "Do I need to keep the dashboard open for the bot to work?",
            a: "No. The bot runs on our servers and answers whether you are logged in or not. You only open the dashboard to watch, take over, or change something." },
        ] },

      { h: "Still stuck",
        p: ["Write to us. Include what you did, what you expected, and what happened instead — and a screenshot if you can. A real person answers."] },
    ],
  },

  "comments": {
    title: "Comments",
    lead: "Every comment left on your Facebook Page and Instagram posts, what the bot replied publicly, and whether it also reached the person privately.",
    time: 5,
    blocks: [
      { h: "What this tab is for",
        p: [
          "A comment on a post is a customer raising their hand in public. TellMore AI answers it twice: a **public reply** underneath the comment so everyone reading the post sees an answer, and a **private message** to that person so a real conversation can start in your inbox.",
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

      { note: "**Open the post** does not appear on comments that arrived before August 2026 on Instagram — the address of the post was not being saved back then, and there is no way to work it out afterwards. Every comment from now on has it.",
        kind: "tip" },

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
            a: "Because deleting here only tidies your dashboard. TellMore AI never deletes anything from your Page or your Instagram account. Delete it on the post itself if you want it gone from public view." },
          { q: "One comment got two replies.",
            a: "That happens if someone edits their comment, which both platforms report as new activity. It is rare. If you see it repeatedly, contact us with the post link." },
        ] },
    ],
  },
};
