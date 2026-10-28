-- Homepage: initial schema
-- Tables: profiles, default_sources, user_sources, feeds, feed_items, saved_articles
-- All tables have RLS. Feed data is written only by the Edge Function (service role).

-- ---------- profiles ----------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  language      text not null default 'ro'     check (language in ('ro', 'en')),
  theme         text not null default 'auto'   check (theme in ('light', 'dark', 'auto')),
  accent        text not null default 'blue',
  text_size     text not null default 'normal' check (text_size in ('small', 'normal', 'large', 'xlarge')),
  layout        text not null default 'cards'  check (layout in ('list', 'cards')),
  weather_city  text,
  weather_lat   double precision,
  weather_lon   double precision,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: owner can read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner can insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner can update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- default_sources (curated feeds) ----------
create table public.default_sources (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  url                 text not null unique,
  site_url            text,
  category            text not null check (category in ('news', 'tech', 'sport', 'other')),
  language            text not null default 'ro',
  enabled_by_default  boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);
alter table public.default_sources enable row level security;
create policy "default_sources: readable by signed-in users"
  on public.default_sources for select to authenticated using (true);

-- ---------- user_sources ----------
-- One row per (user, default source) to override the default on/off state,
-- or one row per custom feed the user added (default_source_id is null, url is set).
create table public.user_sources (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  default_source_id  uuid references public.default_sources (id) on delete cascade,
  name               text,
  url                text,
  enabled            boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint user_sources_default_or_custom
    check ((default_source_id is not null and url is null) or (default_source_id is null and url is not null)),
  constraint user_sources_url_is_http check (url is null or url ~* '^https?://')
);
create unique index user_sources_user_default_uq on public.user_sources (user_id, default_source_id)
  where default_source_id is not null;
create unique index user_sources_user_url_uq on public.user_sources (user_id, url)
  where url is not null;
alter table public.user_sources enable row level security;
create policy "user_sources: owner full access" on public.user_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- feeds (fetch state per feed URL) ----------
create table public.feeds (
  url              text primary key,
  title            text,
  last_fetched_at  timestamptz,
  last_status      integer,
  last_error       text,
  etag             text
);
alter table public.feeds enable row level security;
create policy "feeds: readable by signed-in users" on public.feeds for select to authenticated using (true);

-- ---------- feed_items (cache of fetched entries) ----------
create table public.feed_items (
  id            uuid primary key default gen_random_uuid(),
  feed_url      text not null references public.feeds (url) on delete cascade,
  guid          text not null,
  title         text not null,
  link          text not null,
  summary       text,
  image_url     text,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  unique (feed_url, guid)
);
create index feed_items_feed_published_idx on public.feed_items (feed_url, published_at desc);
alter table public.feed_items enable row level security;
create policy "feed_items: readable by signed-in users" on public.feed_items for select to authenticated using (true);

-- ---------- saved_articles ----------
create table public.saved_articles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  item_id   uuid not null references public.feed_items (id) on delete cascade,
  saved_at  timestamptz not null default now(),
  unique (user_id, item_id)
);
alter table public.saved_articles enable row level security;
create policy "saved_articles: owner full access" on public.saved_articles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- seed: curated sources ----------
insert into public.default_sources (name, url, site_url, category, language, enabled_by_default, sort_order) values
  ('Digi24',        'https://www.digi24.ro/rss',                         'https://www.digi24.ro',     'news', 'ro', true,  10),
  ('HotNews',       'https://hotnews.ro/feed',                           'https://hotnews.ro',        'news', 'ro', false, 20),
  ('Libertatea',    'https://www.libertatea.ro/feed',                    'https://www.libertatea.ro', 'news', 'ro', false, 30),
  ('GSMArena',      'https://www.gsmarena.com/rss-news-reviews.php3',    'https://www.gsmarena.com',  'tech', 'en', true,  40),
  ('Ars Technica',  'https://feeds.arstechnica.com/arstechnica/index',   'https://arstechnica.com',   'tech', 'en', true,  50),
  ('The Verge',     'https://www.theverge.com/rss/index.xml',            'https://www.theverge.com',  'tech', 'en', false, 60);
