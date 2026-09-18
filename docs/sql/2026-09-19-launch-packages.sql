-- Launch packages, priced so every one keeps at least ~৳1,000 a month at 100%
-- use on the current model (gemini-3.6-flash, quality first — owner 2026-09-19).
-- Applied to production 2026-09-19. Safe to run twice.
--
-- Launch prices hold until 31 December 2026 (the flash models double in price
-- on 1 January 2027; the pricing page says so). Nothing is unlimited any more:
-- every allowance is a number, because an unlimited row is a cost with no top.
-- Products and documents are counted as ADDS a month (allowance_events).
-- The ৳0.60 "extra replies" line is gone from every package: it was never
-- built, and nothing is listed that does not work.

update plans set monthly = 0, yearly = 0,
  messages_per_day = 30, messages_per_month = null, channels = 1,
  max_products = 20, max_kb_files = 2, max_scrapes_per_month = 5,
  max_broadcasts_per_month = 2, max_assistant_per_month = 30,
  feature_list = '["Every feature switched on","30 bot replies a day (about 5-6 customers)","1 channel of your choice","20 products or 2 documents","30 AI Assistant questions","No card needed"]'::jsonb,
  updated_at = now()
where id = 'trial';

update plans set monthly = 2699, yearly = 26990, byok_monthly = 1999, byok_yearly = 19990,
  messages_per_month = 2000, channels = 2,
  max_products = 500, max_kb_files = 20, max_scrapes_per_month = 10,
  max_broadcasts_per_month = 10, max_assistant_per_month = 100,
  feature_list = '["2,000 bot replies / month","2 channels + website widget","500 products or 20 documents a month","100 AI Assistant questions / month","Every feature — nothing is held back"]'::jsonb,
  updated_at = now()
where id = 'basic';

update plans set monthly = 5999, yearly = 59990, byok_monthly = 4499, byok_yearly = 44990,
  messages_per_month = 5500, channels = 3,
  max_products = 1000, max_kb_files = 60, max_scrapes_per_month = 40,
  max_broadcasts_per_month = 40, max_assistant_per_month = 400,
  feature_list = '["5,500 bot replies / month","All 3 channels + website widget","1,000 products or 60 documents a month","400 AI Assistant questions / month","Every feature — nothing is held back"]'::jsonb,
  updated_at = now()
where id = 'pro';

update plans set monthly = 11999, yearly = 119990, byok_monthly = 8999, byok_yearly = 89990,
  tagline = 'The most of everything, and room to fit your business',
  messages_per_month = 12000, channels = 3,
  max_products = 2500, max_kb_files = 150, max_scrapes_per_month = 100,
  max_broadcasts_per_month = 100, max_assistant_per_month = 800,
  feature_list = '["12,000 bot replies / month","All 3 channels + website widget","2,500 products or 150 documents a month","800 AI Assistant questions / month","Priority support","Need more? We set your limits to fit"]'::jsonb,
  updated_at = now()
where id = 'enterprise';
