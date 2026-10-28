-- Widgets: quick links, exchange rates, calendar, web search engine, reader mode preference.
alter table public.profiles
  add column if not exists search_engine  text not null default 'duckduckgo' check (search_engine in ('duckduckgo', 'brave', 'google')),
  add column if not exists show_rates     boolean not null default true,
  add column if not exists show_calendar  boolean not null default true,
  add column if not exists open_in_reader boolean not null default false;

create table public.quick_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  url         text not null check (url ~* '^https?://'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.quick_links enable row level security;
create policy "quick_links: owner full access" on public.quick_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index quick_links_user_idx on public.quick_links (user_id, sort_order);
