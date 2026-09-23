-- Deleting a client must delete everything that belongs to them — enforced by
-- the database, not by a list in JavaScript.
--
-- Owner, 2026-09-24: "a client I deleted still exists in database
-- authentications", and then: "when I do something from the admin panel it
-- should also happen in the dashboard."
--
-- What was found. 21 tables carry a client_id. 16 of them already had a
-- foreign key to clients(id) with ON DELETE CASCADE, so Postgres emptied them
-- by itself. Five did not, and the admin route's own delete list named only six
-- tables — a list written once and never revisited, so a table added later is
-- silently left behind. Rows actually stranded by deleted clients:
--
--   processed_comments   11 rows   2 dead clients
--   comments             10 rows   2 dead clients
--   usage_daily           3 rows   1 dead client
--   allowance_events       0
--   broadcast_recipients   0   (reached through broadcasts, which cascades)
--
-- comments held customers' words and processed_comments their ids, months after
-- the business they belonged to was removed.
--
-- The fix is a constraint rather than more code: once the database owns the
-- rule, no future route, script or hand-run DELETE can get it wrong, and a
-- table added next year is covered the moment its foreign key is declared.

begin;

-- 1. Clear what is already stranded. A foreign key cannot be added while rows
--    point at clients that no longer exist.
delete from allowance_events     x where not exists (select 1 from clients c where c.id = x.client_id);
delete from broadcast_recipients x where not exists (select 1 from clients c where c.id = x.client_id);
delete from comments             x where not exists (select 1 from clients c where c.id = x.client_id);
delete from processed_comments   x where not exists (select 1 from clients c where c.id = x.client_id);
delete from usage_daily          x where not exists (select 1 from clients c where c.id = x.client_id);

-- 2. From now on the database does it. Names are spelled out so a re-run is
--    obvious in the constraint list, and each is dropped first so this file is
--    safe to run twice.
alter table allowance_events     drop constraint if exists allowance_events_client_id_fkey;
alter table allowance_events     add  constraint allowance_events_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

alter table broadcast_recipients drop constraint if exists broadcast_recipients_client_id_fkey;
alter table broadcast_recipients add  constraint broadcast_recipients_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

alter table comments             drop constraint if exists comments_client_id_fkey;
alter table comments             add  constraint comments_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

alter table processed_comments   drop constraint if exists processed_comments_client_id_fkey;
alter table processed_comments   add  constraint processed_comments_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

alter table usage_daily          drop constraint if exists usage_daily_client_id_fkey;
alter table usage_daily          add  constraint usage_daily_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

commit;

-- The check that keeps this honest. Run it whenever a table gains a client_id;
-- it must return no rows. Anything it lists will outlive its client.
--
--   select c.table_name
--   from information_schema.columns c
--   join information_schema.tables t
--     on t.table_schema = c.table_schema and t.table_name = c.table_name
--   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
--     and c.column_name = 'client_id'
--     and not exists (
--       select 1
--       from information_schema.table_constraints tc
--       join information_schema.key_column_usage kcu
--         on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
--       join information_schema.referential_constraints rc
--         on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
--       join information_schema.constraint_column_usage ccu
--         on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
--       where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = c.table_schema
--         and tc.table_name = c.table_name and kcu.column_name = 'client_id'
--         and ccu.table_name = 'clients' and rc.delete_rule = 'CASCADE')
--   order by 1;
