-- ============================================================================
-- Tracks every admin/super_admin write (create/update/activate/upload/role
-- change/...) so the Users page can show "what has this account done" for a
-- given admin or super_admin. Forward-looking only — there is no history
-- before this table exists, nothing earlier can be backfilled.
--
-- Rows are written directly by lib/admin/actions.ts (the service-role
-- client) right alongside each existing write, not through a dedicated RPC:
-- every admin action already funnels through that one file (see its own
-- top-of-file comment), so that's also the single place to log from.
--
-- actor_name/actor_role are a snapshot at write time (not a join to
-- profiles) so a later rename or role change doesn't rewrite history, and
-- the log still reads correctly if the account is ever deleted.
--
-- No RLS policies — like sessions (20260927010000_sessions_table.sql), only
-- service_role (which bypasses RLS) ever touches this table.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id, created_at desc);

alter table public.admin_audit_log enable row level security;
