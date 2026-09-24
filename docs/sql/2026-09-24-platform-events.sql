-- What the platform owner is told, and whether they have seen it.
--
-- Owner, 2026-09-24: "From the admin panel I don't get any notifications when
-- any customer enters, or any error occurs, or something happens — it is bad
-- for me."
--
-- Two emails were the whole of it: a payment request, and a new admin signing
-- up. A business could register, a bot could stop replying, a client's AI key
-- could die and a channel could fall off, and the console said nothing. Vercel
-- keeps runtime logs for an hour on this plan, so an error nobody was watching
-- for was simply gone.
--
-- One row per notable thing. src/lib/platform-events.js decides what earns a
-- row and how loudly it is announced; the console's bell reads this.
--
-- `read_at` lives in its own table, per admin email, because two admins reading
-- the same console must not clear each other's bell.

create table if not exists platform_events (
  id          bigserial primary key,
  kind        text        not null,
  severity    text        not null default 'info',   -- info | warn | urgent
  title       text        not null,
  body        text,
  -- Which business it is about, when it is about one. Deliberately NOT a
  -- foreign key: "this business was deleted" must outlive the row it names,
  -- and an event that vanishes with its subject is one nobody can audit.
  client_id   uuid,
  client_name text,
  url         text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_platform_events_created on platform_events (created_at desc);
create index if not exists idx_platform_events_kind    on platform_events (kind, created_at desc);

create table if not exists platform_event_reads (
  event_id bigint      not null references platform_events(id) on delete cascade,
  email    text        not null,
  read_at  timestamptz not null default now(),
  primary key (event_id, email)
);

create index if not exists idx_platform_event_reads_email on platform_event_reads (email);

-- Checked after applying: a row inserts, a read records, marking read twice is
-- harmless (primary key + ON CONFLICT DO NOTHING), and deleting the event takes
-- its reads with it.
