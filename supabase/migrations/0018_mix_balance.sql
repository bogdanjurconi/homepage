-- How the front page shares its cards between sources, 0 (every source the same) to 4 (by how much each publishes); 2 = square root.
alter table public.profiles add column if not exists mix_balance smallint not null default 2
  check (mix_balance between 0 and 4);
