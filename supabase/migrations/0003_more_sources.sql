-- More curated sources (all checked on 2026-10-28: HTTP 200 and valid RSS).
-- Sources with no images in their feed stay off by default; everyone can switch them on in Settings.
insert into public.default_sources (name, url, site_url, category, language, enabled_by_default, sort_order) values
  ('Adevărul',          'https://adevarul.ro/rss',                    'https://adevarul.ro',             'news',  'ro', true,  12),
  ('Mediafax',          'https://www.mediafax.ro/rss',                'https://www.mediafax.ro',         'news',  'ro', false, 14),
  ('G4Media',           'https://www.g4media.ro/feed',                'https://www.g4media.ro',          'news',  'ro', false, 16),
  ('Gândul',            'https://www.gandul.ro/rss',                  'https://www.gandul.ro',           'news',  'ro', false, 18),
  ('Știrile Pro TV',    'https://rss.stirileprotv.ro/',               'https://stirileprotv.ro',         'news',  'ro', false, 22),
  ('Biziday',           'https://www.biziday.ro/feed/',               'https://www.biziday.ro',          'news',  'ro', false, 24),
  ('Recorder',          'https://recorder.ro/feed/',                  'https://recorder.ro',             'news',  'ro', false, 26),
  ('Playtech',          'https://playtech.ro/feed/',                  'https://playtech.ro',             'tech',  'ro', false, 42),
  ('Zona IT',           'https://zonait.ro/feed/',                    'https://zonait.ro',               'tech',  'ro', false, 44),
  ('Go4IT',             'https://www.go4it.ro/rss',                   'https://www.go4it.ro',            'tech',  'ro', false, 46),
  ('Engadget',          'https://www.engadget.com/rss.xml',           'https://www.engadget.com',        'tech',  'en', false, 62),
  ('9to5Google',        'https://9to5google.com/feed/',               'https://9to5google.com',          'tech',  'en', false, 64),
  ('Android Authority', 'https://www.androidauthority.com/feed/',     'https://www.androidauthority.com','tech',  'en', false, 66),
  ('Tom''s Guide',      'https://www.tomsguide.com/feeds.xml',        'https://www.tomsguide.com',       'tech',  'en', false, 68),
  ('Notebookcheck',     'https://www.notebookcheck.net/News.152.100.html', 'https://www.notebookcheck.net', 'tech', 'en', false, 70),
  ('TechCrunch',        'https://techcrunch.com/feed/',               'https://techcrunch.com',          'tech',  'en', false, 72),
  ('Digi Sport',        'https://www.digisport.ro/rss',               'https://www.digisport.ro',        'sport', 'ro', false, 80),
  ('ProSport',          'https://www.prosport.ro/rss',                'https://www.prosport.ro',         'sport', 'ro', false, 82)
on conflict (url) do nothing;
