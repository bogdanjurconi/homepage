-- Bee Culture under "Other" (checked on 2026-10-29: HTTP 200, valid RSS, posts this week). Off by default.
insert into public.default_sources (name, url, site_url, category, language, enabled_by_default, sort_order) values
  ('Bee Culture', 'https://www.beeculture.com/feed/', 'https://www.beeculture.com', 'other', 'en', false, 92)
on conflict (url) do nothing;
