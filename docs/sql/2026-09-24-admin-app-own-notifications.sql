-- The admin app gets its own address for notifications.
--
-- Owner, 2026-09-24: "I notice that my native app which is for users it
-- automatically converted to admin app — the admin app and the user app will be
-- separated." Two separate apps: the user app carries the user's own customer
-- alerts, the admin app carries the platform alerts.
--
-- Until now pushToAdmins() addressed an admin by their OWN client id, so a
-- platform alert landed in the same app as their business's customer messages
-- and, being tagged url "/admin", turned the user app into the admin console
-- the moment it was tapped. An admin device now registers here instead, keyed by
-- the admin's email, and nothing about the client tables changes.
--
-- Deliberately two NEW tables rather than a nullable client_id on the existing
-- ones: fcm_tokens.client_id and push_subscriptions.client_id are NOT NULL with
-- a foreign key, the client push that works today is untouched, and undoing all
-- of this is two DROPs.

create table if not exists admin_fcm_tokens (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  token        text not null unique,
  platform     text default 'android',
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists admin_push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists admin_fcm_tokens_email_idx on admin_fcm_tokens (email);
create index if not exists admin_push_subscriptions_email_idx on admin_push_subscriptions (email);

-- Every read and write goes through the service key in our own API routes, the
-- same as fcm_tokens and push_subscriptions. No anon access.
alter table admin_fcm_tokens enable row level security;
alter table admin_push_subscriptions enable row level security;
