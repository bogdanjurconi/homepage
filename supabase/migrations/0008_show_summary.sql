-- Title-only cards by default; the summary under the title is opt-in.
alter table public.profiles add column if not exists show_summary boolean not null default false;
