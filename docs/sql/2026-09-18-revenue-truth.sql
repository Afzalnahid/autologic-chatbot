-- Revenue that means something, and the last unpriced model.
-- Applied to production 2026-09-18. Safe to run twice.
--
-- WHY: the admin panel's "Revenue" read the `plan` column of every client and
-- multiplied by the package price. It therefore counted an expired package, a
-- suspended account, and the owner's own company (comped to 2029) — on a
-- platform where not one payment had ever been recorded it reported ৳8,500 a
-- month. src/lib/revenue.js now separates BILLED from RECEIVED; this is the one
-- thing it needs from the database.

-- An account the platform does not charge: the owner's own company, a demo, a
-- partner. It keeps working exactly like any other client; it is only left out
-- of the revenue figure.
alter table clients add column if not exists internal boolean not null default false;

comment on column clients.internal is
  'True for an account that is never invoiced (the owner''s own company, a demo). Excluded from admin revenue; everything else behaves normally.';

-- The owner's own company.
update clients set internal = true where business_name = 'Autologic System ';

-- The preview of Gemini 3 Flash. It ran 5 calls on 2026-08-24 and had no rate,
-- so those fell through to __default__ (0.30/2.50) and were costed as a house
-- guess. Read off ai.google.dev/gemini-api/docs/pricing on 2026-09-18: the same
-- 0.75/3.75 as the model it previews, doubling on 2027-01-01.
insert into model_prices (provider, model, input_per_1m, output_per_1m, note)
values ('google', 'gemini-3-flash-preview', 0.75, 3.75,
        'Legacy preview of Gemini 3 Flash. Intro rate to 2026-12-31; 1.50/7.50 from 2027-01-01. Verified ai.google.dev/pricing 2026-09-18')
on conflict (provider, model) do update
  set input_per_1m = excluded.input_per_1m,
      output_per_1m = excluded.output_per_1m,
      note = excluded.note,
      updated_at = now();
