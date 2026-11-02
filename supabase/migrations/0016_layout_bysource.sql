-- A fourth layout: one horizontally scrolling row of stories per source.
alter table public.profiles drop constraint if exists profiles_layout_check;
alter table public.profiles add constraint profiles_layout_check check (layout in ('list', 'cards', 'magazine', 'bysource'));
