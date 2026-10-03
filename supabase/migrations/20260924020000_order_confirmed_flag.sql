-- ============================================================================
-- Adds a standalone "order confirmed" flag, separate from `orders.status`
-- (pending/confirmed/processing/shipped/delivered/cancelled) and
-- `orders.payment_status`. It tracks whether the admin has actually reached
-- the customer (typically over WhatsApp) and had them confirm the order,
-- independent of where the order sits in the fulfillment pipeline.
--
-- No new RLS policy needed — Phase 4's `orders_admin_all` already grants
-- admins full update on `orders`, which covers writes to this new column.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.orders add column if not exists confirmed boolean not null default false;
