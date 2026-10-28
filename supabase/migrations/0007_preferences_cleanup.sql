-- Trim the option sets after the first round of feedback.

-- Text size: drop 'xlarge'.
alter table public.profiles drop constraint if exists profiles_text_size_check;
update public.profiles set text_size = 'large' where text_size = 'xlarge';
alter table public.profiles add constraint profiles_text_size_check check (text_size in ('small', 'normal', 'large'));

-- Search engine: Google (default) or Brave.
alter table public.profiles drop constraint if exists profiles_search_engine_check;
update public.profiles set search_engine = 'google' where search_engine not in ('brave', 'google');
alter table public.profiles add constraint profiles_search_engine_check check (search_engine in ('brave', 'google'));
alter table public.profiles alter column search_engine set default 'google';

-- Language: English first.
alter table public.profiles alter column language set default 'en';

-- Accent palette: blue, teal, green, amber, coral, violet.
update public.profiles set accent = case accent
  when 'indigo' then 'violet' when 'purple' then 'violet'
  when 'pink' then 'coral' when 'red' then 'coral' when 'orange' then 'coral'
  when 'slate' then 'blue'
  else accent end;

-- Currencies: EUR, USD, GBP, CHF, HUF only, keeping each person's order.
update public.profiles p set rate_currencies = coalesce(
  (select array_agg(c order by ord) from unnest(p.rate_currencies) with ordinality as t(c, ord)
    where c in ('EUR', 'USD', 'GBP', 'CHF', 'HUF')),
  array['EUR', 'USD', 'GBP']);
update public.profiles set rate_currencies = array['EUR', 'USD', 'GBP'] where cardinality(rate_currencies) = 0;

-- Whether the account has a password (Auth does not expose this to the browser).
alter table public.profiles add column if not exists has_password boolean not null default false;
update public.profiles p set has_password = true
from auth.users u where u.id = p.id and coalesce(u.encrypted_password, '') <> '';
