-- Organisers (tenants) and the shows they run. See
-- card-show-platform-architecture.md, section 2 ("Show") and section 3
-- ("Persona -> Module Mapping" / Platform Admin Console, Organiser Console).
--
-- Note: is_platform_admin() previously existed in an earlier iteration of
-- this schema, checking the now-removed `profiles` table. It's recreated
-- here against user_roles.
--
-- Safe to run against a database that already has objects from an even
-- earlier, superseded iteration of the organisers/shows schema (which
-- also defined organiser_status, an is_platform_admin() checking
-- `profiles`, and a show_status enum this version doesn't use) — this
-- drops all of that first. If your database has never seen any of these
-- objects, all of this is a no-op.
drop table if exists public.shows cascade;
drop table if exists public.organisers cascade;
drop function if exists public.is_organiser_staff_for(uuid);
drop function if exists public.is_platform_admin();
drop type if exists public.show_status;
drop type if exists public.organiser_status;

-- These target the existing users/user_roles tables (from
-- 0002_users_roles_and_vendor_profiles.sql), which aren't dropped and
-- recreated above, so a rerun needs these dropped explicitly too.
drop policy if exists "Platform admins can view all users" on public.users;
drop policy if exists "Platform admins can view all roles" on public.user_roles;
drop policy if exists "Platform admins can grant any role" on public.user_roles;

create type public.organiser_status as enum ('pending', 'active', 'suspended');

create table public.organisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.organiser_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.organisers (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  venue_name text not null,
  payment_instructions text not null default '',
  active_floorplan_version_id uuid,
  created_at timestamptz not null default now(),
  constraint shows_date_range check (end_date >= start_date)
);

create index shows_organiser_id_idx on public.shows (organiser_id);

alter table public.organisers enable row level security;
alter table public.shows enable row level security;

-- Security definer so these can check the caller's own roles from inside
-- RLS policies on other tables without recursing into user_roles' own RLS.
create function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'platform_admin'
  );
$$;

create function public.is_organiser_staff_for(target_organiser_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'organiser_staff'
      and organiser_id = target_organiser_id
  );
$$;

create policy "Platform admins and their organiser staff can view organisers"
  on public.organisers for select
  using (public.is_platform_admin() or public.is_organiser_staff_for(id));

create policy "Only platform admins can create organisers"
  on public.organisers for insert
  with check (public.is_platform_admin());

create policy "Platform admins and their organiser staff can update organisers"
  on public.organisers for update
  using (public.is_platform_admin() or public.is_organiser_staff_for(id))
  with check (public.is_platform_admin() or public.is_organiser_staff_for(id));

create policy "Platform admins and organiser staff can view shows"
  on public.shows for select
  using (public.is_platform_admin() or public.is_organiser_staff_for(organiser_id));

create policy "Platform admins and organiser staff can create shows"
  on public.shows for insert
  with check (public.is_platform_admin() or public.is_organiser_staff_for(organiser_id));

create policy "Platform admins and organiser staff can update shows"
  on public.shows for update
  using (public.is_platform_admin() or public.is_organiser_staff_for(organiser_id))
  with check (public.is_platform_admin() or public.is_organiser_staff_for(organiser_id));

-- Platform admins need to search users by email (to grant organiser_staff)
-- and see every role grant. The self-only policies from
-- 0002_users_roles_and_vendor_profiles.sql are untouched and still apply
-- to everyone else.
create policy "Platform admins can view all users"
  on public.users for select
  using (public.is_platform_admin());

create policy "Platform admins can view all roles"
  on public.user_roles for select
  using (public.is_platform_admin());

-- The only path organiser_staff (or any other admin-only role) is ever
-- granted: a platform admin inserting the row directly. Self-serve
-- signup's insert policy (vendor/attendee only, granted_by null) is
-- untouched and remains the only self-serve path.
create policy "Platform admins can grant any role"
  on public.user_roles for insert
  with check (public.is_platform_admin());
