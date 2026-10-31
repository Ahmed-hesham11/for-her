-- Idempotency marker for the server-side Meta Conversions API Purchase event.
-- Set (atomically) before the event is sent, cleared again if Meta rejects it.
alter table public.orders add column if not exists meta_purchase_sent_at timestamptz;
