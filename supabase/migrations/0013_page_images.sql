-- Marks items whose article page was already searched for an og:image, so it is fetched once.
alter table public.feed_items add column if not exists page_image_checked boolean not null default false;
