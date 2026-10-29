-- The colour a person picked for the custom swatch, kept while they try a preset, so it is one tap away.
alter table public.profiles add column if not exists accent_custom text
  check (accent_custom is null or accent_custom ~ '^#[0-9a-fA-F]{6}$');
update public.profiles set accent_custom = accent where accent like '#%';
