-- Native push for the Android/iOS app (Firebase Cloud Messaging). The web push
-- system stores browser subscriptions in push_subscriptions (endpoint + p256dh +
-- auth); a native app instead has a single FCM registration TOKEN with none of
-- those keys, so it gets its own table rather than bending the other's NOT NULLs.
--
-- One row per device token; unique(token) is the upsert target, so re-registering
-- the same device updates rather than duplicates. Cascade-deleted with the client.
--
-- Run this in Supabase → SQL Editor. Safe to run more than once.

create table if not exists public.fcm_tokens (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  token        text not null unique,          -- the FCM registration token for one device
  platform     text,                          -- "android" / "ios", for the owner to recognise
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists fcm_tokens_client_idx on public.fcm_tokens (client_id);

-- RLS on, no policies: only the service role (which bypasses RLS) ever reads or
-- writes these — exactly like push_subscriptions.
alter table public.fcm_tokens enable row level security;

-- PostgREST caches the schema; nudge it so the new table is visible at once.
notify pgrst, 'reload schema';
