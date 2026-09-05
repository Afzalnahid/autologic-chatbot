-- One order per code — stop the same order being saved twice.
--
-- WHY
-- The bot already refuses to write an order it has seen before: it looks for the
-- same order_code, for the same customer, and skips if it finds one (bot.js).
-- But that check and the write are two separate steps, and two things routinely
-- try to save the SAME order at almost the SAME moment:
--   * Meta redelivers a webhook when our handler is slow or fails after we have
--     already saved, and
--   * the model repeats the whole order object when a customer says "ok" or
--     "confirm" a second time.
-- When two of those land together, BOTH pass the look-up (neither has committed
-- yet), and BOTH insert. The shop then packs one parcel but sees two orders,
-- calls the customer twice, and counts the money twice in analytics.
--
-- A database rule is the only thing that closes that gap, because the database
-- is the one place that sees both writes. These two indexes make a duplicate
-- INSERT fail at the source. The app already tolerates that failure: the losing
-- write's error is ignored (supabase-js returns it, does not throw), the reply
-- is sent normally, and the order stays saved exactly once.
--
-- The two indexes mirror the bot's own two cases:
--   * a customer on a channel (sender_id present): one order_code per customer,
--   * the website widget (no sender_id): one order_code per business, treating
--     the missing sender as a single bucket — the same rule the bot applies with
--     "sender_id is null".
-- Both skip rows with no order_code, because a blank code is not an identity and
-- must never block a real order.
--
-- HOW TO RUN
-- Supabase → SQL Editor. Run STEP 1 FIRST (it only reads). If it returns no
-- rows, run STEP 3 and you are done — STEP 3 is safe to run more than once and
-- deletes nothing. If STEP 1 shows duplicates, do not run STEP 3 yet (it would
-- fail); tell me what STEP 1 returned and we decide on STEP 2 together.

-- ── STEP 1 — read-only: are there existing duplicates that would block the index?
-- (a) channel orders — same code, same customer, more than once:
select client_id, order_code, sender_id, count(*) as copies
from public.orders
where order_code is not null and order_code <> '' and sender_id is not null
group by client_id, order_code, sender_id
having count(*) > 1;

-- (b) website-widget orders — same code, no sender, more than once:
select client_id, order_code, count(*) as copies
from public.orders
where order_code is not null and order_code <> '' and sender_id is null
group by client_id, order_code
having count(*) > 1;


-- ── STEP 2 — ONLY IF STEP 1 RETURNED ROWS. DESTRUCTIVE: it deletes rows.
-- It keeps the EARLIEST saved copy of each duplicated order (the "real" one the
-- bot wrote first) and removes the later copies. Read it, understand it, and run
-- it only after STEP 1 has shown you exactly what will go. It is commented out
-- so it cannot run by accident — remove the /* and */ to enable it.
/*
delete from public.orders
where id in (
  select id from (
    select id,
           row_number() over (
             partition by client_id, order_code, coalesce(sender_id::text, '__widget__')
             order by created_at asc, id asc
           ) as rn
    from public.orders
    where order_code is not null and order_code <> ''
  ) ranked
  where rn > 1
);
*/


-- ── STEP 3 — the guards. Safe to run more than once; deletes nothing.
create unique index if not exists orders_one_per_code_sender
  on public.orders (client_id, order_code, sender_id)
  where sender_id is not null and order_code is not null and order_code <> '';

create unique index if not exists orders_one_per_code_widget
  on public.orders (client_id, order_code)
  where sender_id is null and order_code is not null and order_code <> '';
