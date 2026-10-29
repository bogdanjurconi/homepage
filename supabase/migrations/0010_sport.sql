-- Sport: football teams each person follows (football-data.org ids) and the server-side caches
-- the "sport" Edge Function writes with the service role (no policies = no direct client writes).
alter table public.profiles
  add column if not exists teams jsonb not null default '[]'::jsonb;

-- Teams of the competitions available on the free plan, refreshed weekly; read by signed-in users for the Settings search.
create table public.sport_teams (
  id            integer primary key,
  name          text not null,
  short_name    text,
  tla           text,
  crest         text,
  area          text,
  competitions  text[] not null default '{}',
  updated_at    timestamptz not null default now()
);
alter table public.sport_teams enable row level security;
create policy "sport_teams: signed-in read" on public.sport_teams for select to authenticated using (true);

create table public.sport_competitions (
  code              text primary key,
  name              text not null,
  emblem            text,
  teams_fetched_at  timestamptz
);
alter table public.sport_competitions enable row level security;

-- Per-team match window (key "team:<id>"), refreshed every minute during a match and every few hours otherwise.
create table public.sport_cache (
  key         text primary key,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now()
);
alter table public.sport_cache enable row level security;
