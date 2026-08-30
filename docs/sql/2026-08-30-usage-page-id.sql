-- Per-channel AI cost: measured instead of divided.
--
-- WHY
-- The admin panel shows what the bot cost on each of a client's channels. It
-- cannot MEASURE that today, because usage_daily records who spent the money
-- but not where the message arrived — so the figure is the client's bot cost
-- split by each channel's share of their messages, and the panel says so.
--
-- That split is right whenever a message costs about the same wherever it
-- arrives, which is the normal case. It is wrong exactly when it matters most:
-- one channel's customers send photographs and another's do not, and a photo
-- carries its own vision call. This adds the missing column so the number is
-- read rather than apportioned.
--
-- HOW TO RUN
-- Supabase → SQL Editor → paste the whole file → Run. It is safe to run twice.
-- Nothing here deletes or rewrites a row.
--
-- ORDER MATTERS, AND THIS FILE IS FIRST.
-- Run this BEFORE deploying the code that sends the new value. The function
-- below defaults the new argument, so the code that is live right now — which
-- does not send it — keeps recording exactly as it does today. There is no
-- window where usage stops being counted.

begin;

-- ── 1. The column ───────────────────────────────────────────────────────────
-- NOT NULL with an empty-string default, not a nullable column, and that is
-- deliberate: this column joins the primary key below, and Postgres will not
-- accept NULL in a key. '' is the honest value for "this call had no channel"
-- — an embedding for a product, the owner pressing a button — and it groups
-- cleanly instead of vanishing from every GROUP BY the way NULL does.
alter table public.usage_daily
  add column if not exists page_id text not null default '';

comment on column public.usage_daily.page_id is
  'Which channel the call belonged to (channels.page_id). Empty when the call had no channel: catalogue indexing, dashboard tools.';

-- ── 2. The key ──────────────────────────────────────────────────────────────
-- One row per client per day per (kind, feature, provider, model, own_key) —
-- and now per channel too. Without this the upsert in the function below would
-- fold two channels' calls into a single row and the new column would hold
-- whichever one happened to arrive first.
--
-- The old key is dropped by name only if it is there, so re-running is safe.
do $$
declare
  k text;
begin
  select conname into k
  from pg_constraint
  where conrelid = 'public.usage_daily'::regclass and contype = 'p';

  if k is not null then
    execute format('alter table public.usage_daily drop constraint %I', k);
  end if;
end $$;

alter table public.usage_daily
  add constraint usage_daily_pkey
  primary key (client_id, day, kind, feature, provider, model, own_key, page_id);

-- ── 3. The writer ───────────────────────────────────────────────────────────
-- DROP then CREATE, not CREATE OR REPLACE. Postgres cannot change a function's
-- argument list in place: adding a parameter makes an OVERLOAD, and a ten-
-- argument call would then match two functions and fail as "not unique". The
-- old one has to go first.
--
-- p_page_id is defaulted for the same reason p_feature was: the code that is
-- live while this runs does not send it, and it must keep working.
drop function if exists public.record_ai_usage(uuid, date, text, text, text, boolean, int, bigint, bigint, text);
drop function if exists public.record_ai_usage(uuid, date, text, text, text, boolean, int, bigint, bigint, text, text);

create function public.record_ai_usage(
  p_client_id uuid,
  p_day       date,
  p_kind      text,
  p_provider  text,
  p_model     text,
  p_own_key   boolean,
  p_calls     int,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_feature   text default 'other',
  p_page_id   text default ''
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage_daily as u
    (client_id, day, kind, feature, provider, model, own_key, page_id,
     calls, tokens_in, tokens_out)
  values
    (p_client_id, p_day, coalesce(p_kind, 'other'), coalesce(p_feature, 'other'),
     coalesce(p_provider, 'google'), coalesce(p_model, 'unknown'), coalesce(p_own_key, false),
     coalesce(p_page_id, ''),
     coalesce(p_calls, 1), coalesce(p_tokens_in, 0), coalesce(p_tokens_out, 0))
  on conflict (client_id, day, kind, feature, provider, model, own_key, page_id)
  do update set
    calls      = u.calls      + excluded.calls,
    tokens_in  = u.tokens_in  + excluded.tokens_in,
    tokens_out = u.tokens_out + excluded.tokens_out;
$$;

-- The app calls this with the service role; nobody else needs it.
revoke all on function public.record_ai_usage(uuid, date, text, text, text, boolean, int, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, date, text, text, text, boolean, int, bigint, bigint, text, text) to service_role;

-- ── 4. Reading it back ──────────────────────────────────────────────────────
-- The admin panel filters by day and groups by client and channel.
create index if not exists usage_daily_client_day_page_idx
  on public.usage_daily (client_id, day, page_id);

commit;

-- ── AFTERWARDS ──────────────────────────────────────────────────────────────
-- Old rows keep page_id = '' for ever. That is correct and not a gap: nobody
-- recorded which channel they belonged to, and guessing now would put a number
-- on the screen that nothing measured. The admin panel shows a channel's cost
-- as measured only from the day this ran, and goes on apportioning the rest —
-- it says which it is doing.
