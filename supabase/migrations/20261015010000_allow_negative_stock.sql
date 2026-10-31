-- ============================================================================
-- Orders deduct products.stock_quantity even when stock is short (see
-- 20261008030000), so the count can go below zero. If products has a CHECK
-- constraint that forbids that (e.g. stock_quantity >= 0), the deduction fails
-- and checkout shows "Unable to process your order right now." This drops any
-- CHECK constraint on public.products that mentions stock_quantity (not the
-- unrelated ones). Safe to re-run; does nothing if there is none.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.products'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%stock_quantity%'
  loop
    execute format('alter table public.products drop constraint %I', r.conname);
    raise notice 'dropped constraint %', r.conname;
  end loop;
end $$;
