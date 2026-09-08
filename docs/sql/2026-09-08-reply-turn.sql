-- Plan usage is measured in BOT REPLIES, not customer messages and not the
-- owner's hand-typed replies (owner's rule 2026-09-08). One reply is stored as
-- several message_buffer rows (a photo, the text, a follow-up question), so the
-- code flags only the FIRST row of each reply with reply_turn = true. The plan
-- limit, the billing bar and the admin panel count those flagged rows.
--
-- Safe to run more than once. Existing rows stay reply_turn = false, so counting
-- simply starts fresh from the first reply sent after this runs — no historical
-- backfill needed (older usage was measured on the customer-message basis).

ALTER TABLE message_buffer
  ADD COLUMN IF NOT EXISTS reply_turn boolean NOT NULL DEFAULT false;

-- The count is always "this client, this window, flagged only", so a partial
-- index on the flagged rows keeps it cheap as the table grows.
CREATE INDEX IF NOT EXISTS message_buffer_reply_turn_idx
  ON message_buffer (client_id, created_at)
  WHERE reply_turn;

-- PostgREST caches the schema; nudge it so the new column is visible at once.
NOTIFY pgrst, 'reload schema';
