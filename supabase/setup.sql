-- FotoMat 2000 schema + auto-confirm trigger

-- 1. profiles
create table if not exists public.fotomat_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);
alter table public.fotomat_profiles enable row level security;
create policy "public read usernames" on public.fotomat_profiles for select using (true);
create policy "owner insert own profile" on public.fotomat_profiles for insert with check (auth.uid() = id);
create policy "owner update own profile" on public.fotomat_profiles for update using (auth.uid() = id);

-- 2. strips
create table if not exists public.fotomat_strips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  photo_1 text,
  photo_2 text,
  photo_3 text,
  photo_4 text,
  filter_name text,
  created_at timestamptz not null default now()
);
alter table public.fotomat_strips enable row level security;
create policy "owner read own strips" on public.fotomat_strips for select using (auth.uid() = user_id);
create policy "owner insert own strips" on public.fotomat_strips for insert with check (auth.uid() = user_id);

-- 3. auto-confirm sign-ups (no email verification required)
create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_auto_confirm on auth.users;
create trigger on_auth_user_created_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();