create extension if not exists pgcrypto;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.organisation_role as enum ('director','admin','site_manager','inspector','subcontractor','viewer');

create table if not exists public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organisation_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_members enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own memberships" on public.organisation_members for select to authenticated using (user_id = auth.uid());
create policy "members read organisations" on public.organisations for select to authenticated using (
  exists (select 1 from public.organisation_members om where om.organisation_id = organisations.id and om.user_id = auth.uid() and om.active)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', '')) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
