-- Gemini serves a repeated prompt prefix from its own cache at a tenth of the
-- input rate, and those tokens arrive INSIDE promptTokenCount. Without a column
-- of their own every cost figure charged them in full, and no report could show
-- whether caching was working at all.
--
-- Applied to production on 2026-09-18 (supabase migration usage_daily_tokens_cached).
alter table public.usage_daily add column if not exists tokens_cached bigint not null default 0;

create or replace function public.record_ai_usage(
  p_client_id uuid, p_day date, p_kind text, p_provider text, p_model text,
  p_own_key boolean, p_calls integer, p_tokens_in bigint, p_tokens_out bigint,
  p_feature text default 'other'::text, p_page_id text default ''::text,
  p_tokens_cached bigint default 0
) returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.usage_daily as u
    (client_id, day, kind, feature, provider, model, own_key, page_id,
     calls, tokens_in, tokens_out, tokens_cached)
  values
    (p_client_id, p_day, coalesce(p_kind, 'other'), coalesce(p_feature, 'other'),
     coalesce(p_provider, 'google'), coalesce(p_model, 'unknown'), coalesce(p_own_key, false),
     coalesce(p_page_id, ''),
     coalesce(p_calls, 1), coalesce(p_tokens_in, 0), coalesce(p_tokens_out, 0),
     coalesce(p_tokens_cached, 0))
  on conflict (client_id, day, kind, feature, provider, model, own_key, page_id)
  do update set
    calls         = u.calls         + excluded.calls,
    tokens_in     = u.tokens_in     + excluded.tokens_in,
    tokens_out    = u.tokens_out    + excluded.tokens_out,
    tokens_cached = u.tokens_cached + excluded.tokens_cached;
$function$;
