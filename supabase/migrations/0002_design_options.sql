-- More personalisation: a third layout (magazine), a font choice and a background style.
alter table public.profiles drop constraint if exists profiles_layout_check;
alter table public.profiles add constraint profiles_layout_check check (layout in ('list', 'cards', 'magazine'));

alter table public.profiles
  add column if not exists font text not null default 'system' check (font in ('system', 'serif', 'rounded')),
  add column if not exists background text not null default 'flat' check (background in ('flat', 'tinted', 'paper'));

-- Accent is free text; the app offers: blue, indigo, purple, pink, red, orange, amber, green, teal, slate.
