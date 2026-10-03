-- ============================================================================
-- Custom server-side sessions, replacing Supabase Auth's session cookies.
--
-- Only the SHA-256 hash of each session token is stored — never the raw
-- token — so a leaked row can't be replayed as a live session. RLS is
-- enabled but deliberately has NO policies for anon/authenticated: this
-- table is reachable only through the service-role key (server-only,
-- lib/supabase/admin.ts), which always bypasses RLS. That's the whole
-- point — a session lookup must never be something the browser can do
-- directly with the anon key.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

alter table public.sessions enable row level security;

-- No policies: anon/authenticated get zero access. Only service_role
-- (which bypasses RLS) can read/write this table.
revoke all on public.sessions from anon, authenticated;
