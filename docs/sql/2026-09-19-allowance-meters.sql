-- Allowance meters: products and documents are counted as they are ADDED, and
-- the AI Assistant gets a monthly allowance. Applied 2026-09-19. Safe to run twice.
--
-- WHY: the product and document limits counted what is IN the catalogue now, so
-- deleting and re-adding gave the slot back — and every add is paid for (the
-- photos are read and the product is indexed by AI). The owner's rule
-- (2026-09-19): the package number is how many a client may ADD, and a delete
-- does not give it back. Counted by a trigger, so every way in — the add form,
-- photo import, CSV/Shopify import, website import, the AI Assistant — is
-- counted by the same row, and a new way in added later is counted without
-- anyone remembering to.

alter table plans add column if not exists max_assistant_per_month integer;

create table if not exists allowance_events (
  id bigserial primary key,
  client_id uuid not null,
  kind text not null check (kind in ('product', 'document')),
  created_at timestamptz not null default now()
);
create index if not exists allowance_events_client_kind_at
  on allowance_events (client_id, kind, created_at);
-- Server-only table: the service role bypasses RLS, nothing else may read it.
alter table allowance_events enable row level security;

create or replace function log_allowance_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into allowance_events (client_id, kind) values (new.client_id, tg_argv[0]);
  return new;
end $$;

-- AFTER INSERT only: an upsert that UPDATES an existing document (re-upload of
-- the same file) does not fire it, so replacing a file is not a second add.
drop trigger if exists products_allowance on products;
create trigger products_allowance after insert on products
  for each row when (new.client_id is not null)
  execute function log_allowance_event('product');

drop trigger if exists file_registry_allowance on file_registry;
create trigger file_registry_allowance after insert on file_registry
  for each row when (new.client_id is not null)
  execute function log_allowance_event('document');
