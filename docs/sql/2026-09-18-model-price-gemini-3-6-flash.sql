-- The model the platform actually runs had no row in the price book, so every
-- cost in the admin panel fell through to the __default__ rate (0.30/2.50) and
-- read about 2.2× too cheap — Broker's BD's three weeks showed $0.71 where the
-- real bill was $1.55 (measured 2026-09-18).
--
-- Applied to production on 2026-09-18. Kept here so a fresh database gets it.
insert into model_prices (provider, model, input_per_1m, output_per_1m, note)
values ('google', 'gemini-3.6-flash', 0.75, 3.75,
        'Intro rate to 2026-12-31; 1.50/7.50 from 2027-01-01. Verified ai.google.dev/pricing 2026-09-18')
on conflict (provider, model) do update
  set input_per_1m = excluded.input_per_1m,
      output_per_1m = excluded.output_per_1m,
      note = excluded.note;
