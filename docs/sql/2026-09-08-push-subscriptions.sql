-- Web Push subscriptions — where the owner's phone/browser can be reached.
--
-- WHY
-- A browser that has been granted notification permission hands back a
-- "subscription": an endpoint URL plus two keys. To send the owner a push (new
-- order, new booking, a chat that needs a human) the server POSTs to that
-- endpoint. One owner can have several — phone, laptop, a second browser — so
-- this is one row per device, keyed by the endpoint.
--
-- HOW TO RUN
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  endpoint     text not null unique,   -- the push service URL; unique = one row per device
  p256dh       text not null,          -- the subscription's public key
  auth         text not null,          -- the subscription's auth secret
  user_agent   text,                   -- which device it is, for the owner to recognise
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- The server looks these up by client to fan a notification out to all of that
-- owner's devices.
create index if not exists push_subscriptions_client_idx
  on public.push_subscriptions (client_id);

-- Only the service role (the app's backend) ever reads or writes these; no
-- browser should. RLS on, no policies = deny all except the service role, which
-- bypasses RLS.
alter table public.push_subscriptions enable row level security;
