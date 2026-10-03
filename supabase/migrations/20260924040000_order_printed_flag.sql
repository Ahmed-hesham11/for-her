-- ============================================================================
-- Adds a persistent "printed" flag on orders, set when the admin actually
-- prints the shipping invoice (the "طباعة" button on
-- /admin/orders/[id]/print, not just opening the page). Drives the print
-- icon's color in the orders list/detail (red = not printed yet, green =
-- printed), so admins can see at a glance which shipping labels are done.
--
-- No new RLS policy needed — Phase 4's `orders_admin_all` already grants
-- admins full update on `orders`, which covers writes to this new column.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.orders add column if not exists printed boolean not null default false;
