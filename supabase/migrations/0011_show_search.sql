-- Whether the web search bar shows on the front page.
alter table public.profiles
  add column if not exists show_search boolean not null default true;
