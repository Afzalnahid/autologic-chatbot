# Autologic Chatbot

Full-stack AI chatbot platform replacing n8n. Built with Next.js, Supabase, and Google Gemini.

## What This Replaces

| n8n Workflow | Now Handled By |
|---|---|
| Chatbot (Messenger) | `/api/messenger` route |
| Telegram Main Ingestor | `/api/telegram` route |
| Main - Supabase Vector Pipeline | `src/lib/vector-pipeline.js` |
| Web Scraper Sub-workflow | `src/lib/web-scraper.js` |

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd autologic-chatbot
npm install
```

### 2. Create `.env.local`

Copy `.env.example` to `.env.local` and fill in your keys:

```
SUPABASE_URL=https://cchvsgouqqxibhubioch.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
GEMINI_API_KEY=your_gemini_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token_here
FACEBOOK_VERIFY_TOKEN=your_verify_token_here
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Where to find these:**
- **SUPABASE_SERVICE_KEY**: Supabase Dashboard > Settings > API > `service_role` key
- **GEMINI_API_KEY**: Google AI Studio > Get API Key
- **TELEGRAM_BOT_TOKEN**: @BotFather on Telegram
- **FACEBOOK tokens**: Meta Developer Portal > Your App > Messenger Settings

### 3. Create the settings table in Supabase

Run this in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  settings jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON public.app_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000 for the dashboard.

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect your GitHub repo in the Vercel dashboard. Add all env vars in Vercel > Settings > Environment Variables.

### 6. Update webhook URLs

After deployment, update your webhook URLs:

**Facebook Messenger:**
- Meta Developer Portal > Messenger > Webhooks
- Callback URL: `https://your-app.vercel.app/api/messenger`
- Verify Token: same as FACEBOOK_VERIFY_TOKEN

**Telegram:**
Run this once to set the webhook:
```
https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram
```

### 7. Deactivate n8n workflows

Once verified working, deactivate all 4 n8n workflows.

## Architecture

```
src/
  app/
    page.js              Dashboard UI (client component)
    layout.js            Root layout with Tabler icons
    globals.css          Tailwind + custom styles
    api/
      messenger/route.js   Facebook Messenger webhook (GET: verify, POST: messages)
      telegram/route.js    Telegram bot webhook (POST: commands, products, URLs)
      products/route.js    Products CRUD (GET, POST, DELETE)
      orders/route.js      Orders management (GET, PUT)
      conversations/route.js  Conversations from message_buffer (GET)
      settings/route.js    App settings (GET, POST)
      demo-chat/route.js   Demo chatbot with vector search (POST)
  lib/
    supabase.js          Supabase client + all DB operations
    gemini.js            Gemini AI (chat, image analysis, embeddings)
    vector-pipeline.js   Product ingestion (analyze > embed > store)
    web-scraper.js       URL scraping + AI product extraction
    messenger.js         Facebook Messenger API helpers
    telegram.js          Telegram Bot API helpers
```

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/messenger` | Facebook webhook verification |
| POST | `/api/messenger` | Handle incoming Messenger messages |
| POST | `/api/telegram` | Handle Telegram bot updates |
| GET | `/api/products` | List all products from Supabase |
| POST | `/api/products` | Add product (with vector embedding) |
| DELETE | `/api/products` | Delete product by ID |
| GET | `/api/conversations` | Get grouped conversations |
| GET | `/api/orders` | List orders |
| PUT | `/api/orders` | Update order status |
| GET/POST | `/api/settings` | Read/write app settings |
| POST | `/api/demo-chat` | Demo chatbot with RAG |
