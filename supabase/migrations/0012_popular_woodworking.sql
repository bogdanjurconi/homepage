-- Popular Woodworking under "Other" (checked on 2026-10-29: HTTP 200, valid RSS with images). Off by default.
insert into public.default_sources (name, url, site_url, category, language, enabled_by_default, sort_order) values
  ('Popular Woodworking', 'https://www.popularwoodworking.com/feed/', 'https://www.popularwoodworking.com', 'other', 'en', false, 90)
on conflict (url) do nothing;
