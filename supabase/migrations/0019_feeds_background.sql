-- Feeds refresh in the background: one request claims the stale feeds, the others serve the cache.
alter table public.feeds add column if not exists refreshing_at timestamptz;

create or replace function public.claim_feeds(urls text[], min_age interval)
returns setof text language sql security definer set search_path = public as $$
  insert into public.feeds (url, refreshing_at)
  select unnest(urls), now()
  on conflict (url) do update set refreshing_at = now()
  where (feeds.last_fetched_at is null or feeds.last_fetched_at < now() - min_age)
    and (feeds.refreshing_at is null or feeds.refreshing_at < now() - interval '2 minutes')
  returning url
$$;
revoke execute on function public.claim_feeds(text[], interval) from public, anon, authenticated;

-- The items a person sees: the newest `total` across their sources, plus at least `per_feed` of every source,
-- so a source that posts weekly still has a row in the "Sources" layout.
create or replace function public.feed_items_for(urls text[], per_feed int, total int)
returns table (id uuid, feed_url text, title text, link text, summary text, image_url text, published_at timestamptz)
language sql security definer stable set search_path = public as $$
  select id, feed_url, title, link, summary, image_url, published_at from (
    select i.id, i.feed_url, i.title, i.link, i.summary, i.image_url, i.published_at,
      row_number() over (partition by i.feed_url order by i.published_at desc nulls last) as rn_feed,
      row_number() over (order by i.published_at desc nulls last) as rn_all
    from public.feed_items i where i.feed_url = any(urls)) t
  where rn_feed <= per_feed or rn_all <= total
  order by published_at desc nulls last
$$;
revoke execute on function public.feed_items_for(text[], int, int) from public, anon, authenticated;

-- Retention keeps the stories people saved (the cascade used to take the bookmark with the story).
create index if not exists saved_articles_item_idx on public.saved_articles (item_id);
create or replace function public.prune_feed_items(feed text, cutoff timestamptz)
returns int language sql security definer set search_path = public as $$
  with d as (
    delete from public.feed_items i
    where i.feed_url = feed and i.fetched_at < cutoff
      and not exists (select 1 from public.saved_articles s where s.item_id = i.id)
    returning 1)
  select count(*)::int from d
$$;
revoke execute on function public.prune_feed_items(text, timestamptz) from public, anon, authenticated;

-- is_admin is set only by the server (the admin function with the service role), never from the browser.
create or replace function public.profiles_guard_admin() returns trigger language plpgsql as $$
declare claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if new.is_admin is distinct from old.is_admin and claims is not null and coalesce(claims->>'role', '') <> 'service_role' then
    raise exception 'is_admin can only be changed by the server';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_admin on public.profiles;
create trigger profiles_guard_admin before update on public.profiles for each row execute function public.profiles_guard_admin();

-- Index nits: the query orders nulls last; user_sources is read by user.
drop index if exists public.feed_items_feed_published_idx;
create index feed_items_feed_published_idx on public.feed_items (feed_url, published_at desc nulls last);
create index if not exists user_sources_user_idx on public.user_sources (user_id);
