-- A separate, lower price for clients who run on their OWN AI key (BYOK).
--
-- A BYOK client pays for their own AI usage, so the platform fee is lower. Every
-- paid package now carries a second price pair — byok_monthly / byok_yearly —
-- shown to, and charged to, a client ONLY while they actually have a saved own
-- key (the billing code decides; see priceForClient in src/lib/plans.js). A
-- package with NULL here has no BYOK price and such a client pays the standard
-- price, so the trial and any custom package are safe by default.
--
-- Run this in Supabase → SQL Editor. Safe to run more than once: the columns are
-- added only if missing, and the seed below fills a price only where none is set
-- yet, so prices later edited in the admin panel are never overwritten by a re-run.

alter table public.plans
  add column if not exists byok_monthly integer,
  add column if not exists byok_yearly  integer;

-- Seed the six paid tiers (Shop and Services share the same prices, as the
-- standard prices do). Starter 1000/10000, Growth 2500/25000, Scale 4000/40000.
-- `where byok_monthly is null` keeps this a one-time seed: a value the owner
-- later changes in the panel stays theirs on any re-run.
update public.plans set byok_monthly = 1000, byok_yearly = 10000
  where id in ('shop_starter', 'svc_starter') and byok_monthly is null;

update public.plans set byok_monthly = 2500, byok_yearly = 25000
  where id in ('shop_growth', 'svc_growth') and byok_monthly is null;

update public.plans set byok_monthly = 4000, byok_yearly = 40000
  where id in ('shop_scale', 'svc_scale') and byok_monthly is null;

-- PostgREST caches the schema; nudge it so the new columns are visible at once.
notify pgrst, 'reload schema';
