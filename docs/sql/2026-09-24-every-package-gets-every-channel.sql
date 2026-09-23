-- Every package gets every channel. No package rations them any more.
--
-- Owner, 2026-09-24: "in every package there will be no bound of channel, every
-- channel will exist in every package, because if we give the full access of
-- the channel there will be no loss of us — the AI reply will remain same."
--
-- That is the product's economics in one sentence. A bot reply costs a model
-- call and is metered; a connected channel costs nothing at all. The old caps
-- (trial 1, Basic 2, Pro and Enterprise 3) only ever produced shops that left
-- their Instagram unanswered — the product looking worse, with nothing saved.
--
-- `channels = null` is what src/lib/plan-limits.js already reads as "no limit",
-- so no code needed changing for the rule itself. The catalogue in
-- src/lib/plans.js is updated in the same commit; this file is the database,
-- which is what the public pricing page and every live client actually read.
--
-- The mechanism is NOT removed: a super admin can still set a per-client cap in
-- the admin panel if a particular account ever needs one.

begin;

-- The column was NOT NULL, which is why "no limit" could not be expressed here
-- before. null is the value plan-limits.js already reads as "no limit".
alter table plans alter column channels drop not null;

update plans set channels = null;

-- The words on the cards, which are stored here as well as in plans.js.
update plans
set feature_list = (
  select jsonb_agg(
    case
      when f in ('1 channel of your choice', '2 channels + website widget', 'All 3 channels + website widget')
        then 'Every channel: Messenger, Instagram, WhatsApp + website widget'
      else f
    end
    order by ord
  )
  from jsonb_array_elements_text(feature_list::jsonb) with ordinality as t(f, ord)
)::json
where feature_list::text like '%channel%';

commit;

-- Check: every package uncapped, and no card still promising a number of them.
--
--   select id, channels, feature_list from plans order by id;
--   -- channels must be null on every row, and no feature_list entry may match
--   -- '% channel%' unless it is the "Every channel: …" line.
