-- Admin-controlled category order (drag & drop in /admin/categories) and a
-- per-category switch for the homepage grid.
--
-- sort_order is scoped to the category's parent: top-level categories are
-- ordered among themselves, and each parent's subcategories among theirs.
-- Existing categories keep today's alphabetical order until reordered.

alter table public.categories
  add column if not exists sort_order integer not null default 0,
  add column if not exists show_on_home boolean not null default true;

with ranked as (
  select id, row_number() over (partition by parent_id order by name) - 1 as position
  from public.categories
)
update public.categories c
   set sort_order = ranked.position
  from ranked
 where c.id = ranked.id;
