-- Summaries stay on by default; the setting lets each person turn them off.
alter table public.profiles alter column show_summary set default true;
update public.profiles set show_summary = true;
