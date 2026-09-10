-- "This customer needs a person." The bot has always promised a team member
-- would help — and nothing recorded it, so the owner was never told. Two
-- columns on contacts carry the signal: set when the bot hands off (its
-- [[HANDOFF]] token, or the customer plainly asking for a human), cleared when
-- the owner replies or flips the bot switch for that customer.
--
-- Run this in Supabase → SQL Editor. Safe to run more than once.

alter table public.contacts
  add column if not exists needs_human    boolean not null default false,
  add column if not exists needs_human_at timestamptz;

-- The notification feed asks "who is waiting for a person?" per client.
create index if not exists contacts_needs_human_idx
  on public.contacts (client_id, needs_human_at desc)
  where needs_human;

notify pgrst, 'reload schema';
