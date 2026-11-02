-- "Sources" layout: rows in alphabetical order, or in an order the person sets (a list of feed URLs).
alter table public.profiles add column if not exists source_sort text not null default 'alpha'
  check (source_sort in ('alpha', 'custom'));
alter table public.profiles add column if not exists source_order jsonb not null default '[]'::jsonb;
