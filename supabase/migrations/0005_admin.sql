-- Administrators can invite and remove accounts (through the "admin" Edge Function).
-- Public sign-up is disabled in Auth settings; new accounts come only from invitations.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- The first account is the administrator.
update public.profiles p set is_admin = true
from auth.users u where u.id = p.id and u.email = 'bogdan.jurconi@gmail.com';
