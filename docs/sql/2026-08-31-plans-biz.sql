-- Packages belong to a business type, and the six new ones replace the old three.
--
-- Run this in Supabase → SQL Editor. Safe to run twice.
--
-- WHY A COLUMN AND NOT A CONVENTION IN THE ID. Reading "shop_" off the front of
-- an id works right up until somebody creates a package called "shopify_addon",
-- and then a shop package is hidden from shops for a reason nobody can see. The
-- type is a fact about the package, so it is stored as one.
--
-- 'both' IS THE DEFAULT, and every row written before this runs gets it. A
-- package shown to everybody is a smaller mistake than one hidden from the
-- people it was written for: the first is noticed the day it happens, the
-- second is noticed when somebody asks why they cannot buy anything.

alter table public.plans
  add column if not exists biz text not null default 'both';

-- Only three values mean anything. Without this a typo in a future edit turns
-- into a package nobody can see.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plans_biz_check'
  ) then
    alter table public.plans
      add constraint plans_biz_check check (biz in ('both', 'ecommerce', 'agency'));
  end if;
end $$;

-- The pricing page and the billing screen both ask "what may THIS business
-- buy?", which is this index's whole job.
create index if not exists plans_biz_active_idx
  on public.plans (biz, active, sort);

-- ── The seven packages ─────────────────────────────────────────────────────
--
-- One free trial for everybody, then three tiers on each side. The tiers are
-- Starter / Growth / Scale on both, because "agency" used to name the top tier
-- AND one of the business types, and "the agency package for an agency" meant
-- two different things depending on who was reading it.
--
-- Prices here are the ones the old three carried, kept so nothing changes
-- price by accident. The admin panel now shows what each package actually
-- COSTS to run, measured from real calls — set the prices from that once a few
-- days of traffic have been metered.

insert into public.plans as p
  (id, biz, name, tagline, sort, active, public, monthly, yearly,
   messages_per_day, messages_per_month, messages_per_channel, channels,
   max_products, max_kb_files, max_scrapes_per_month, max_broadcasts_per_month,
   features, feature_list, highlight)
values
  -- public = true: the trial has always been the first card on the pricing
  -- page, and hiding it here would quietly remove it.
  ('trial', 'both', 'Free Trial', 'Try everything for a few days', 0, true, true, 0, 0,
   30, null, null, 1, 20, 2, 5, 2,
   '{"vision":true,"voice":true,"kb":true,"calendar":true,"comments":false,"widget":true,"broadcast":true,"followup":true,"byok":false}'::jsonb,
   '["Full access, no card needed","30 bot replies a day (about 5-6 customers)","1 channel (Facebook, Instagram or WhatsApp)","AI replies in Bangla & English","Live conversation inbox"]'::jsonb, false),

  ('shop_starter', 'ecommerce', 'Shop Starter', 'One channel, your catalogue answering for itself', 1, true, true, 1500, 15000,
   null, 3000, null, 1, 300, 0, 20, 4,
   '{"vision":false,"voice":false,"kb":false,"calendar":false,"comments":false,"widget":true,"broadcast":true,"followup":true,"byok":false}'::jsonb,
   '["3,000 bot replies / month","1 channel of your choice","Product catalogue & order collection","AI replies in Bangla & English","Live conversation inbox","Analytics dashboard"]'::jsonb, false),
  ('shop_growth', 'ecommerce', 'Shop Growth', 'Every channel, and customers who send photos instead of names', 2, true, true, 3500, 35000,
   null, 15000, null, 3, 3000, 0, 200, 20,
   '{"vision":true,"voice":true,"kb":false,"calendar":false,"comments":true,"widget":true,"broadcast":true,"followup":true,"byok":false}'::jsonb,
   '["15,000 bot replies / month","All 3 channels — Facebook, Instagram, WhatsApp","Photo product matching (Vision AI)","Voice message understanding","Broadcasts and follow-up messages","Everything in Shop Starter"]'::jsonb, true),
  ('shop_scale', 'ecommerce', 'Shop Scale', 'For a catalogue and a crowd that keep growing', 3, true, true, 6000, 60000,
   null, 50000, null, 3, null, 0, null, null,
   '{"vision":true,"voice":true,"kb":false,"calendar":false,"comments":true,"widget":true,"broadcast":true,"followup":true,"byok":true}'::jsonb,
   '["50,000 bot replies / month","Unlimited products","Comment automation on your posts","Use your own AI key","Priority support","Everything in Shop Growth"]'::jsonb, false),

  ('svc_starter', 'agency', 'Service Starter', 'One channel, answering from your own documents', 4, true, true, 1500, 15000,
   null, 3000, null, 1, 0, 10, 20, 4,
   '{"vision":false,"voice":false,"kb":true,"calendar":false,"comments":false,"widget":true,"broadcast":true,"followup":true,"byok":false}'::jsonb,
   '["3,000 bot replies / month","1 channel of your choice","Knowledge Base — upload your documents","AI replies in Bangla & English","Live conversation inbox","Analytics dashboard"]'::jsonb, false),
  ('svc_growth', 'agency', 'Service Growth', 'Every channel, and meetings booked while you sleep', 5, true, true, 3500, 35000,
   null, 15000, null, 3, 0, 40, 200, 20,
   '{"vision":false,"voice":true,"kb":true,"calendar":true,"comments":true,"widget":true,"broadcast":true,"followup":true,"byok":false}'::jsonb,
   '["15,000 bot replies / month","All 3 channels — Facebook, Instagram, WhatsApp","Google Calendar booking with Meet links","Voice message understanding","Broadcasts and follow-up messages","Everything in Service Starter"]'::jsonb, true),
  ('svc_scale', 'agency', 'Service Scale', 'For a practice that answers all day', 6, true, true, 6000, 60000,
   null, 50000, null, 3, 0, null, null, null,
   '{"vision":false,"voice":true,"kb":true,"calendar":true,"comments":true,"widget":true,"broadcast":true,"followup":true,"byok":true}'::jsonb,
   '["50,000 bot replies / month","Unlimited Knowledge Base documents","Comment automation on your posts","Use your own AI key","Priority support","Everything in Service Growth"]'::jsonb, false)

on conflict (id) do update set
  biz = excluded.biz,
  name = excluded.name,
  tagline = excluded.tagline,
  sort = excluded.sort,
  active = excluded.active,
  public = excluded.public,
  monthly = excluded.monthly,
  yearly = excluded.yearly,
  messages_per_day = excluded.messages_per_day,
  messages_per_month = excluded.messages_per_month,
  -- NOT copied from excluded: whatever the owner has typed into the panel for
  -- the per-channel cap stays theirs. The trial's is the one figure this
  -- migration deliberately clears, below.
  channels = excluded.channels,
  max_products = excluded.max_products,
  max_kb_files = excluded.max_kb_files,
  max_scrapes_per_month = excluded.max_scrapes_per_month,
  max_broadcasts_per_month = excluded.max_broadcasts_per_month,
  features = excluded.features,
  -- Filled in only when empty, so bullets edited in the panel survive a re-run.
  feature_list = case when p.feature_list is null or p.feature_list = '[]'::jsonb
                      then excluded.feature_list else p.feature_list end,
  highlight = excluded.highlight,
  updated_at = now();

-- The trial's per-channel cap was set to 10, which made the real ceiling ten
-- customer messages for the whole trial rather than the 30 a day the same
-- screen advertised. The daily figure is the one that should govern a trial.
update public.plans set messages_per_channel = null where id = 'trial';

-- ── The old three ──────────────────────────────────────────────────────────
--
-- Hidden rather than deleted. Nothing is on them (the owner confirmed the only
-- accounts were their own tests), but a plan id that vanishes while a row still
-- points at it turns a client into "no plan" silently, and keeping the row
-- costs nothing.
update public.plans
   set active = false, public = false
 where id in ('starter', 'pro', 'agency');
