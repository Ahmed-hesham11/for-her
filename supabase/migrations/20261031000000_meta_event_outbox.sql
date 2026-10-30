-- Durable outbox for Meta Conversions API events (currently: Purchase).
--
-- * A row is created by a trigger in the SAME transaction as the order insert,
--   so a Purchase can't be lost if the app crashes after the order is saved,
--   and a rolled-back order leaves no row.
-- * Only storefront orders (user_id is not null) are enqueued; manually
--   entered social orders are not.
-- * status: pending (waiting / scheduled retry), processing (leased by a
--   worker), sent (Meta accepted it), failed (permanent: expired, rejected,
--   retries exhausted).
-- * event_time is orders.created_at and never changes across retries.
-- * Existing orders are untouched (no backfill). The earlier
--   orders.meta_purchase_sent_at column is left in place but is no longer read.
--
-- Safe to re-run.

create table if not exists public.meta_event_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_name text not null default 'Purchase',
  event_id text not null,
  event_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  locked_until timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  -- Request-derived matching data (hashed email / external id, ip, user agent,
  -- fbp, fbc, source url), written right after the order is created.
  context jsonb,
  created_at timestamptz not null default now(),
  constraint meta_event_outbox_order_event_key unique (order_id, event_name)
);

create index if not exists meta_event_outbox_due_idx
  on public.meta_event_outbox (next_attempt_at)
  where status = 'pending';
create index if not exists meta_event_outbox_leased_idx
  on public.meta_event_outbox (locked_until)
  where status = 'processing';

-- Server-only table: RLS on with no policies. The service role (used by the
-- API routes) bypasses RLS; anon/authenticated users can't read or write it.
alter table public.meta_event_outbox enable row level security;
grant all on table public.meta_event_outbox to service_role;

-- SECURITY DEFINER so the insert works whichever role inserts the order, and
-- a failure here is downgraded to a warning: tracking must never block an order.
create or replace function public.enqueue_meta_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    begin
      insert into public.meta_event_outbox (order_id, event_name, event_id, event_time)
      values (new.id, 'Purchase', new.id::text, new.created_at)
      on conflict (order_id, event_name) do nothing;
    exception when others then
      raise warning 'enqueue_meta_purchase failed for order %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_enqueue_meta_purchase on public.orders;
create trigger orders_enqueue_meta_purchase
  after insert on public.orders
  for each row execute function public.enqueue_meta_purchase();

-- Atomically leases due events. FOR UPDATE SKIP LOCKED means two concurrent
-- workers never receive the same row; a lease that expired (crashed worker)
-- becomes claimable again. attempts is incremented at claim time, so crashes
-- count towards the retry limit.
create or replace function public.claim_meta_events(
  p_limit integer default 10,
  p_lease_seconds integer default 180,
  p_order_id uuid default null
)
returns setof public.meta_event_outbox
language plpgsql
as $$
begin
  return query
  with picked as (
    select e.id
      from public.meta_event_outbox e
     where (p_order_id is null or e.order_id = p_order_id)
       and ((e.status = 'pending' and e.next_attempt_at <= now())
         or (e.status = 'processing' and e.locked_until < now()))
     order by e.next_attempt_at
     limit greatest(p_limit, 1)
       for update skip locked
  )
  update public.meta_event_outbox o
     set status = 'processing',
         lease_token = gen_random_uuid(),
         locked_until = now() + make_interval(secs => p_lease_seconds),
         attempts = o.attempts + 1,
         last_attempt_at = now()
    from picked
   where o.id = picked.id
  returning o.*;
end;
$$;

revoke all on function public.claim_meta_events(integer, integer, uuid) from public;
grant execute on function public.claim_meta_events(integer, integer, uuid) to service_role;
