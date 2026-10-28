-- Which currencies each person sees on the exchange-rates card.
alter table public.profiles
  add column if not exists rate_currencies text[] not null default array['EUR', 'USD', 'GBP'];
