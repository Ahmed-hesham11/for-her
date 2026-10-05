-- ============================================================================
-- Lets a super_admin view every account (any role), search/filter them, and
-- promote/demote between 'customer' and 'admin' from the dashboard — this
-- used to be a manual SQL Editor-only operation (see the comments in
-- 20260904040000_phase4_admin_dashboard_access.sql and
-- 20260905010000_phase5_admin_remaining_modules.sql).
--
-- Deliberately NOT exposed here: creating or demoting a super_admin. Both
-- directions stay manual/SQL-only — admin_set_user_role hard-restricts
-- p_new_role to 'customer'/'admin' and refuses to touch a target row that
-- is currently 'super_admin'.
--
-- There is no DB-level role-change trigger anymore
-- (prevent_role_self_change was dropped in
-- 20260927020000_drop_auth_uid_policies.sql, in favor of app-layer checks),
-- and admin RPCs no longer run under the caller's own auth.uid() — they're
-- service-role-only (see 20260927030000_rpc_rewrite.sql) — so
-- admin_set_user_role takes the acting super_admin's id explicitly
-- (p_actor_id) and re-verifies their role itself, as defense-in-depth
-- alongside lib/admin/auth.ts's requireSuperAdmin(), which is the primary
-- gate.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

create or replace function public.admin_list_users(
  p_search text default null,
  p_role text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  id uuid, full_name text, email text, phone_1 text, role text,
  created_at timestamptz, total_count bigint
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.phone_1, p.role, p.created_at,
    count(*) over() as total_count
  from public.profiles p
  where (p_role is null or trim(p_role) = '' or p.role = p_role)
    and (
      p_search is null or trim(p_search) = ''
      or p.full_name ilike '%' || p_search || '%'
      or p.email ilike '%' || p_search || '%'
      or p.phone_1 ilike '%' || p_search || '%'
    )
  order by p.created_at desc
  limit greatest(p_page_size, 1)
  offset greatest(p_page - 1, 0) * greatest(p_page_size, 1);
$$;

create or replace function public.admin_set_user_role(
  p_actor_id uuid,
  p_target_id uuid,
  p_new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_role text;
begin
  if p_new_role not in ('customer', 'admin') then
    raise exception using errcode = 'P0001', message = 'INVALID_ROLE';
  end if;

  select role into actor_role from public.profiles where id = p_actor_id;
  if actor_role is distinct from 'super_admin' then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ONLY';
  end if;

  if p_actor_id = p_target_id then
    raise exception using errcode = 'P0001', message = 'CANNOT_CHANGE_OWN_ROLE';
  end if;

  select role into target_role from public.profiles where id = p_target_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'USER_NOT_FOUND';
  end if;
  if target_role = 'super_admin' then
    raise exception using errcode = 'P0001', message = 'CANNOT_MODIFY_SUPER_ADMIN';
  end if;

  update public.profiles set role = p_new_role, updated_at = now() where id = p_target_id;
end;
$$;

revoke all on function public.admin_list_users(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer) to service_role;

revoke all on function public.admin_set_user_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_role(uuid, uuid, text) to service_role;
