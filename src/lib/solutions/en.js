// English copy for the solution pages. One page per search someone actually
// types. Every claim here has to be something the product does today — a page
// that oversells wins a click and loses the customer on the first screen.
//
// Shape: { metaTitle, description, eyebrow, title, lead, sections:[{h,p,list}],
//          faq:[{q,a}], related:[slug] }

export const UI = {
  cta: "Start the free trial",
  ctaNote: "3 days free. No card needed.",
  pricing: "See pricing",
  docs: "Read the manual",
  faqTitle: "Common questions",
  more: "More about TellMore AI",
};

export const PAGES = {
  "facebook-messenger-chatbot": {
    metaTitle: "Facebook Messenger Chatbot — answers your Page 24/7 | TellMore AI",
    description:
      "An AI chatbot for your Facebook Page: it answers Messenger questions and post comments day and night, in Bangla or English, using your own prices and products.",
    eyebrow: "Facebook Messenger",
    title: "An AI chatbot for your Facebook Page",
    lead:
      "Most Facebook buyers ask the same six questions — price, size, delivery, stock, location, payment — and most of them ask at midnight. TellMore AI answers all of them from your own catalogue, in the language the customer wrote in, and hands you the conversation the moment it stops being routine.",
    sections: [
      { h: "What it does on a Page",
        list: [
          "Replies to every Messenger message in seconds, in Bangla or English, matching the language the customer used.",
          "Answers from what you taught it: your products, prices, delivery charges, opening hours and policies — never invented facts.",
          "Replies to comments on your posts, and sends the same person a private message so the sale continues in the inbox.",
          "Understands voice notes, which is how a large share of Bangladeshi customers actually write.",
          "Takes an order — name, phone, address, item, quantity — and drops it into your Orders tab.",
          "Books meetings straight into your Google Calendar if you sell services rather than products.",
        ] },
      { h: "Connecting takes one click",
        p: [
          "You sign in with your own Facebook account, choose the Page, and approve. There is no ID to find, no token to copy and nothing to install. Every Page you manage shows in the list, including Pages held in a Business Portfolio.",
          "The bot starts answering immediately. A switch at the top of the Channels tab pauses it whenever you want to take over yourself — and anything you type by hand in Messenger or Business Suite appears in the same inbox, so the bot never repeats what you already said.",
        ] },
      { h: "You stay in control",
        p: [
          "Every conversation is visible in the Inbox tab, with a filter per Page. Take over any chat with one tap; the bot steps back for that customer until you are done.",
          "Analytics shows how many messages were answered, how many turned into orders, and what customers asked most often — usually the fastest way to learn what your product page is missing.",
        ] },
    ],
    faq: [
      { q: "Do I need a developer to set this up?",
        a: "No. You sign in with Facebook, pick your Page and approve. The whole connection is three taps and nothing is installed on your computer." },
      { q: "Will it answer in Bangla?",
        a: "Yes. It replies in the language the customer wrote in — Bangla, English, or Bangla typed in English letters — and it understands voice messages too." },
      { q: "Can it invent a price?",
        a: "No. It answers from the catalogue and the instructions you gave it. When it does not know something, it says so and passes the conversation to you instead of guessing." },
      { q: "What happens when I reply myself?",
        a: "The bot notices your reply and stays quiet in that conversation, so a customer never gets two different answers." },
      { q: "Does it work outside Bangladesh?",
        a: "Yes. Any Facebook Page in any country can connect. Prices are shown in taka, and the bot speaks Bangla and English." },
    ],
    related: ["instagram-dm-automation", "whatsapp-chatbot", "ecommerce-chatbot"],
  },

  "whatsapp-chatbot": {
    metaTitle: "WhatsApp Chatbot for Business — automatic replies | TellMore AI",
    description:
      "Connect your WhatsApp Business number and let an AI chatbot answer customers day and night, take orders and keep every chat in one inbox.",
    eyebrow: "WhatsApp Business",
    title: "A WhatsApp chatbot that answers while you sleep",
    lead:
      "WhatsApp is where a customer expects an answer in minutes, not hours. TellMore AI connects to your WhatsApp Business number through Meta's official API and answers every message with your own prices, stock and delivery rules.",
    sections: [
      { h: "What it handles",
        list: [
          "Instant replies to product, price, delivery and availability questions, in Bangla or English.",
          "Voice notes, understood and answered like any other message.",
          "Order taking: the bot collects name, phone, address and items, then saves the order for you.",
          "Replies you type on your own phone appear in the same inbox, and the bot stays quiet in that chat.",
          "Follow-ups and broadcasts, sent only inside WhatsApp's 24-hour window so your number stays in good standing.",
        ] },
      { h: "The official route, not a copied phone",
        p: [
          "The connection uses Meta's WhatsApp Business Platform — the same route large companies use — so your number is not at risk from an unofficial tool, and messages arrive with a proper business identity.",
          "You connect it from the dashboard in one flow: sign in with Facebook, pick the business and the number, approve. If you do not have a number on the platform yet, the same screen creates one.",
        ] },
      { h: "Costs you can predict",
        p: [
          "TellMore AI charges a flat monthly package, not a fee per message, starting at ৳1,500 a month with a three-day free trial. Meta's own conversation charges, where they apply, are billed by Meta to your WhatsApp account.",
        ] },
    ],
    faq: [
      { q: "Can I keep using WhatsApp on my phone?",
        a: "Yes. Replies you type on your phone reach the inbox as well, and the bot steps back in that conversation so the customer never hears two voices." },
      { q: "Is my number safe?",
        a: "The connection is Meta's official WhatsApp Business Platform, not an unofficial tool that logs into your phone — the route Meta itself asks businesses to use." },
      { q: "Can it send offers to old customers?",
        a: "It can message anyone who wrote to you in the last 24 hours. Outside that window WhatsApp only allows approved template messages, and the platform will not let a broadcast break that rule." },
      { q: "How much does it cost per message?",
        a: "Nothing from us — the package is a flat monthly price. Meta charges its own conversation fee on some message types, billed to your WhatsApp Business account." },
    ],
    related: ["facebook-messenger-chatbot", "ecommerce-chatbot", "bangla-chatbot"],
  },

  "instagram-dm-automation": {
    metaTitle: "Instagram DM Automation — auto-reply to DMs and comments | TellMore AI",
    description:
      "Automate Instagram DMs and comment replies with an AI that knows your products, answers in Bangla or English, and turns a comment into a private conversation.",
    eyebrow: "Instagram",
    title: "Instagram DM and comment automation",
    lead:
      "On Instagram the sale starts under a post. Someone comments \"price?\" and waits. TellMore AI replies to the comment, opens a private message with the same person, and carries the conversation to an order — at three in the morning, in Bangla, without you.",
    sections: [
      { h: "What it automates",
        list: [
          "Every direct message, answered from your catalogue in seconds.",
          "Comments on your posts and reels: a public reply plus a private message to the person who asked.",
          "Voice notes and photo questions — a customer can send a picture of what they want.",
          "Order collection, with everything saved in the Orders tab.",
          "A single inbox shared with Messenger and WhatsApp, so one customer on three apps is still one conversation you can follow.",
        ] },
      { h: "What you need",
        p: [
          "An Instagram professional account (Business or Creator). You connect it from the dashboard by signing in with Instagram and approving — nothing else to set up.",
          "The bot answers in the language the customer used and keeps to the facts you taught it. Anything it cannot answer is handed to you with the whole conversation in view.",
        ] },
    ],
    faq: [
      { q: "Does it reply to comments as well as DMs?",
        a: "Yes, both — and you can switch either off on its own. The public reply stays short; the details go to the private message." },
      { q: "Do I need a Business account?",
        a: "Yes, a professional account (Business or Creator). Switching from a personal account is free and takes a minute in Instagram's settings." },
      { q: "Will customers know it is a bot?",
        a: "It writes plainly and does not pretend to be a person. Most customers only care that the answer is correct and instant — and you can take over any chat whenever you want." },
    ],
    related: ["facebook-messenger-chatbot", "whatsapp-chatbot", "ecommerce-chatbot"],
  },

  "website-chatbot": {
    metaTitle: "Website Chatbot — one line of code, answers in Bangla | TellMore AI",
    description:
      "Add an AI chat widget to your website with one line of code. It answers from your own products and pages, in Bangla or English, and sends the conversation to your inbox.",
    eyebrow: "Website widget",
    title: "A chatbot for your website, in one line of code",
    lead:
      "A visitor with a question and no answer leaves. The TellMore AI widget sits in the corner of your site and answers from the same knowledge your Facebook and WhatsApp bot uses — one brain, every channel.",
    sections: [
      { h: "How it goes on the site",
        p: [
          "Copy one line of script from the Channels tab and paste it before the closing </body> tag of your site. WordPress, Shopify, a hand-written HTML page or a Next.js app — all the same line.",
          "You list the domains allowed to load it, so nobody can lift your widget onto another site.",
        ] },
      { h: "What it can do",
        list: [
          "Answer product, price, delivery and policy questions from your catalogue.",
          "Reply in Bangla or English, following the visitor's own language.",
          "Collect an order or a booking without the visitor leaving the page.",
          "Pass everything to the same inbox your Messenger, Instagram and WhatsApp chats arrive in.",
        ] },
    ],
    faq: [
      { q: "Will it slow my site down?",
        a: "The widget loads after your page, in the background, and is a small script — your page renders first, exactly as it does now." },
      { q: "Do I need to teach it separately?",
        a: "No. It uses the same knowledge, catalogue and rules as your other channels, so an answer is the same everywhere." },
      { q: "Can I control which sites may use it?",
        a: "Yes. Only the domains you list can load the widget; a copy pasted anywhere else is refused." },
    ],
    related: ["ecommerce-chatbot", "facebook-messenger-chatbot", "bangla-chatbot"],
  },

  "ecommerce-chatbot": {
    metaTitle: "E-commerce Chatbot — answers, orders and follow-ups | TellMore AI",
    description:
      "An AI chatbot for online shops: it answers product questions from your catalogue, takes orders on Messenger, Instagram and WhatsApp, and keeps stock answers honest.",
    eyebrow: "Online shops",
    title: "A chatbot built for online shops",
    lead:
      "A shop that sells on Facebook, Instagram and WhatsApp answers the same questions all day in three places. TellMore AI answers them from one catalogue, takes the order, and tells you what is selling.",
    sections: [
      { h: "It knows your catalogue",
        p: [
          "Add products by typing, by uploading a spreadsheet, or by letting the assistant read a photo of your price list. Each product carries its price, sizes, colours, stock status and pictures.",
          "The bot answers from that catalogue only. An item marked out of stock is never sold, and a price change reaches every channel the moment you save it.",
        ] },
      { h: "From question to order",
        list: [
          "The customer asks; the bot answers with the right product and price, and sends the picture.",
          "When they say yes, it collects name, phone, address and quantity in the customer's own language.",
          "The order lands in your Orders tab with a code, ready to confirm, edit or export.",
          "A follow-up can go out inside the 24-hour window to someone who asked and went quiet.",
        ] },
      { h: "What it tells you afterwards",
        p: [
          "Analytics counts the conversations, the orders and the questions customers asked most — including the ones the bot could not answer, which is the shortest list of things worth adding to your catalogue.",
        ] },
    ],
    faq: [
      { q: "Can it sell products it does not have?",
        a: "No. It answers from your catalogue and respects the in-stock switch, so an out-of-stock item is offered as an alternative rather than sold." },
      { q: "Do I have to type every product?",
        a: "No. You can upload a spreadsheet, or send a photo of a price list and let the assistant read it — you approve what it found before anything is saved." },
      { q: "Does it work for a service business?",
        a: "Yes, with a different package: instead of a catalogue it books meetings into your Google Calendar and collects enquiries." },
    ],
    related: ["facebook-messenger-chatbot", "whatsapp-chatbot", "website-chatbot"],
  },

  "bangla-chatbot": {
    metaTitle: "Bangla AI Chatbot — answers customers in Bangla | TellMore AI",
    description:
      "An AI chatbot that answers Bangladeshi customers in real Bangla — typed, in English letters, or as a voice note — across Messenger, Instagram, WhatsApp and your website.",
    eyebrow: "Bangla first",
    title: "An AI chatbot that answers in Bangla",
    lead:
      "Bangladeshi customers do not write the way software expects. They mix Bangla and English in one line, type Bangla in English letters, and send voice notes instead of typing at all. TellMore AI was built for exactly that.",
    sections: [
      { h: "What it understands",
        list: [
          "Bangla script: দাম কত? আছে কি?",
          "Bangla typed in English letters: \"dam koto\", \"ache ki\".",
          "A mix of both in one sentence, which is how most people actually write.",
          "Voice notes, transcribed and answered like any other message — included in every package.",
          "Photos: a customer can send a picture of the item they mean.",
        ] },
      { h: "It replies the way your customer writes",
        p: [
          "The reply follows the customer's own language, so a Bangla question gets a Bangla answer and an English question an English one. You can also fix the tone — formal or friendly — and give it words your business uses.",
          "English-speaking customers abroad get the same service, so a shop selling to both markets runs on one bot.",
        ] },
    ],
    faq: [
      { q: "Does it understand voice messages in Bangla?",
        a: "Yes, on every package. The voice note is transcribed and answered like a typed message." },
      { q: "What if a customer writes Banglish?",
        a: "That is handled. Bangla typed in English letters, and sentences mixing both languages, are understood and answered naturally." },
      { q: "Can the bot be told to use my own words?",
        a: "Yes. You can teach it your brand's wording, your delivery rules and anything else it should say, and it keeps to that." },
    ],
    related: ["facebook-messenger-chatbot", "whatsapp-chatbot", "ecommerce-chatbot"],
  },
};
