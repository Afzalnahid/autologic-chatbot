// Both languages in one place, so a change to the story cannot land in one and
// not the other. Bangla is written, not translated word for word — a shop owner
// in Cumilla should recognise their own way of speaking.

export const COPY = {
  en: {
    hookSmall: "For businesses in Bangladesh",
    hookBig: ["One AI chatbot for", "all your customer channels"],

    s1Label: "Step one",
    s1Title: "Connect your channels",
    s1Body: "Facebook, Instagram, WhatsApp and your own website. One click each. Nothing to install.",

    s2Label: "Step two",
    s2Title: "Teach it your business",
    s2Body: "Upload a price list, a PDF, your product photos. It reads them and answers from them.",
    s2Files: ["service-packages.pdf", "delivery-and-returns.docx", "products.csv"],

    s3Label: "Step three",
    s3Title: "It answers, day and night",
    s3Body: "In the language the customer wrote in.",

    chat: [
      { me: true, text: "আপনাদের সার্ভিস প্যাকেজ কত?" },
      { me: false, text: "স্টার্টার ১,৫০০৳, প্রো ৩,৫০০৳ এবং এজেন্সি ৬,০০০৳ প্রতি মাসে।" },
      { me: true, text: "বৃহস্পতিবার একটা মিটিং করা যাবে?" },
      { me: false, text: "বিকেল ৪টা খালি আছে। বুক করে দিলাম — লিংক পাঠিয়েছি ✅" },
    ],

    s4Label: "And then it acts",
    s4Title: "Bookings, orders, follow-ups",
    s4Items: [
      { icon: "calendar", text: "Meeting booked in your Google Calendar" },
      { icon: "video", text: "Google Meet link sent to the customer" },
      { icon: "bag", text: "Order saved with name, phone and address" },
      { icon: "tag", text: "Every chat sorted: Booking, Complaint, Inquiry" },
    ],

    s5Label: "You see everything",
    s5Title: "One dashboard for every channel",
    stats: [
      { value: "91%", label: "Handled by the bot" },
      { value: "24/7", label: "Always answering" },
      { value: "4", label: "Channels, one inbox" },
    ],

    ctaTitle: "Start free. No card needed.",
    ctaSub: "3-day trial · Bangla and English · autologic-chatbot.vercel.app",
    ctaButton: "Start free trial",
  },

  bn: {
    hookSmall: "বাংলাদেশের ব্যবসার জন্য",
    hookBig: ["আপনার সব চ্যানেলের জন্য", "একটাই এআই চ্যাটবট"],

    s1Label: "ধাপ এক",
    s1Title: "চ্যানেল যুক্ত করুন",
    s1Body: "ফেসবুক, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর নিজের ওয়েবসাইট। একেকটা এক ক্লিকে। কিছু ইনস্টল করতে হয় না।",

    s2Label: "ধাপ দুই",
    s2Title: "আপনার ব্যবসা শেখান",
    s2Body: "দামের তালিকা, পিডিএফ, পণ্যের ছবি — আপলোড করুন। বট পড়ে নেয়, আর সেখান থেকেই উত্তর দেয়।",
    s2Files: ["সার্ভিস-প্যাকেজ.pdf", "ডেলিভারি-নিয়ম.docx", "পণ্যের-তালিকা.csv"],

    s3Label: "ধাপ তিন",
    s3Title: "দিনরাত উত্তর দেয়",
    s3Body: "গ্রাহক যে ভাষায় লেখেন, সেই ভাষাতেই।",

    chat: [
      { me: true, text: "আপনাদের সার্ভিস প্যাকেজ কত?" },
      { me: false, text: "স্টার্টার ১,৫০০৳, প্রো ৩,৫০০৳ এবং এজেন্সি ৬,০০০৳ প্রতি মাসে।" },
      { me: true, text: "বৃহস্পতিবার একটা মিটিং করা যাবে?" },
      { me: false, text: "বিকেল ৪টা খালি আছে। বুক করে দিলাম — লিংক পাঠিয়েছি ✅" },
    ],

    s4Label: "তারপর নিজেই কাজ করে",
    s4Title: "বুকিং, অর্ডার, ফলো-আপ",
    s4Items: [
      { icon: "calendar", text: "মিটিং বুক হয় আপনার গুগল ক্যালেন্ডারে" },
      { icon: "video", text: "গ্রাহকের কাছে মিট লিংক চলে যায়" },
      { icon: "bag", text: "অর্ডার সেভ হয় — নাম, ফোন, ঠিকানাসহ" },
      { icon: "tag", text: "প্রতিটি চ্যাট আলাদা: বুকিং, অভিযোগ, জিজ্ঞাসা" },
    ],

    s5Label: "সব আপনার চোখের সামনে",
    s5Title: "সব চ্যানেল, একটাই ড্যাশবোর্ড",
    stats: [
      { value: "৯১%", label: "বট একাই সামলায়" },
      { value: "২৪/৭", label: "সবসময় উত্তর দেয়" },
      { value: "৪", label: "চ্যানেল, এক ইনবক্স" },
    ],

    ctaTitle: "ফ্রিতে শুরু করুন। কার্ড লাগবে না।",
    ctaSub: "৩ দিনের ট্রায়াল · বাংলা ও ইংরেজি · autologic-chatbot.vercel.app",
    ctaButton: "ফ্রি ট্রায়াল শুরু করুন",
  },
};
