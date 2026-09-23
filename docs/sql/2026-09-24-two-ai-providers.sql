-- Two AI providers, one at a time, and a note on every vector saying which one
-- made it.
--
-- Owner's decision (2026-09-24): "if it is a Gemini API key then the full system
-- will run with this key, and if it is an OpenAI key the full system will run
-- with the OpenAI key — not a single part will run with another key. There will
-- be an on/off switch: when one provider is turned on the other goes off
-- automatically. Two providers can't be on at the same time, but both can be
-- off at the same time."
--
-- Two things have to change in the database for that to be safe.
--
-- 1. platform_ai held ONE row, id 'main'. It now holds one row per provider,
--    each with its own key, models and an `enabled` switch. "Both off" is a
--    real state — the platform then runs on the GEMINI_API_KEY environment
--    variable, exactly as it did before any of this existed.
--
--    "Both on" is refused by the database itself, not only by the code: a
--    unique index on a constant expression, restricted to enabled rows, means
--    at most one row can ever have enabled = true. A bug, a hand-run UPDATE or
--    two admins pressing at once all hit the same wall.
--
-- 2. Search works by comparing a question's 768 numbers with a product's 768
--    numbers. Gemini's 768 and OpenAI's 768 are DIFFERENT SPACES: comparing
--    them returns confident nonsense rather than an error, which is the worst
--    kind of bug there is. So every embedded row now records the model that
--    made it, and rows made by a different one are skipped by search and
--    re-embedded in the background.
--
--    Everything embedded before today was Gemini's — that is all there was — so
--    the backfill is not a guess.

begin;

-- ── 1. one row per provider, with a switch ──────────────────────────────────
alter table platform_ai add column if not exists enabled boolean not null default false;

-- The old single row becomes Google's, switched on, because that is what the
-- platform has been running on.
update platform_ai set id = 'google', enabled = true where id = 'main';

-- And OpenAI gets its empty row, off, waiting for a key.
insert into platform_ai (id, provider, enabled)
select 'openai', 'openai', false
where not exists (select 1 from platform_ai where id = 'openai');

update platform_ai set provider = id where provider is null or provider <> id;

-- At most one enabled row, enforced by the database.
drop index if exists platform_ai_one_enabled;
create unique index platform_ai_one_enabled on platform_ai ((true)) where enabled;

-- ── 2. which vector space each embedding is in ──────────────────────────────
alter table products       add column if not exists embedding_model text;
alter table products       add column if not exists embedding_stale_at timestamptz;
alter table knowledge_base add column if not exists embedding_model text;
alter table knowledge_base add column if not exists embedding_stale_at timestamptz;

-- Everything that already has a vector was embedded by Gemini.
update products       set embedding_model = 'gemini-embedding-001' where embedding is not null and embedding_model is null;
update knowledge_base set embedding_model = 'gemini-embedding-001' where embedding is not null and embedding_model is null;

-- The sweep looks for rows in the wrong space, or flagged when a key changed.
create index if not exists idx_products_embedding_model       on products (client_id, embedding_model);
create index if not exists idx_kb_embedding_model             on knowledge_base (client_id, embedding_model);
create index if not exists idx_products_embedding_stale       on products (embedding_stale_at) where embedding_stale_at is not null;
create index if not exists idx_kb_embedding_stale             on knowledge_base (embedding_stale_at) where embedding_stale_at is not null;

commit;

-- Checks:
--
--   select id, provider, enabled, (api_key_enc is not null) as has_key from platform_ai order by id;
--   -- two rows, at most one enabled
--
--   insert into platform_ai (id, provider, enabled) values ('x','x',true);
--   -- must fail while another row is enabled
--
--   select embedding_model, count(*) from products group by 1;
--   select embedding_model, count(*) from knowledge_base group by 1;
--   -- no NULL where embedding is not null
