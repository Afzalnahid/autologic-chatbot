-- Voice message understanding is included in EVERY package (owner's rule,
-- 2026-09-16). The Starter packages (and the legacy "starter" row) had
-- voice=false, so the plan cards, the admin feature chips and the client's
-- Profile showed "Voice notes: off" even though the bot already answered voice
-- notes on every plan. Safe to run more than once.
update public.plans
   set features = coalesce(features, '{}'::jsonb) || '{"voice": true}'::jsonb
 where coalesce(features->>'voice', 'false') <> 'true';
