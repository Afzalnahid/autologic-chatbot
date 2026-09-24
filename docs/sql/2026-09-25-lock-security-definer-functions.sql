-- Close two SECURITY DEFINER functions that were callable by anyone.
--
-- Found 2026-09-25 while answering the owner's question "how possible is a
-- successful attack?" — by running Supabase's own security linter against the
-- live project rather than reasoning about the code.
--
-- The publishable (anon) key ships inside the browser bundle. That is by
-- design and is safe on its own, because every table has RLS on. But a
-- SECURITY DEFINER function runs as its OWNER and ignores RLS, so any such
-- function left callable by `anon` is a hole straight through it.
--
-- public.record_ai_usage(... 12 args) wrote usage_daily for whatever client_id
-- it was handed. A stranger with the publishable key could have inflated a
-- paying client's usage until the bot hit its monthly cap and went silent, and
-- corrupted the numbers the platform bills on. Not data theft — denial of
-- service against a tenant, and false books.
--
-- How it got there: an older 11-argument version WAS revoked. This
-- 12-argument overload was created later (the tokens_cached column) and
-- inherited Postgres's default `GRANT EXECUTE TO PUBLIC`. A revoke on one
-- overload says nothing about the next one, so every new overload starts open
-- again. Worth remembering the next time this function grows an argument.
--
-- public.log_allowance_event() is the trigger function behind
-- products_allowance and file_registry_allowance. A trigger never consults
-- EXECUTE, so granting it to anybody was pointless as well as unsafe.
--
-- Nothing legitimate breaks: src/lib/usage.js is the only caller, and it runs
-- server-side on SUPABASE_SERVICE_KEY, which these grants do not govern.
-- Verified after applying: anon no, authenticated no, service_role yes.

revoke execute on function public.record_ai_usage(
  uuid, date, text, text, text, boolean, integer, bigint, bigint, text, text, bigint
) from public, anon, authenticated;

revoke execute on function public.log_allowance_event() from public, anon, authenticated;

-- Check it stayed shut:
--   select has_function_privilege('anon', p.oid, 'EXECUTE')
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'record_ai_usage';
