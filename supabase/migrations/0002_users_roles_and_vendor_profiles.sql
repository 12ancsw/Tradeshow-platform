-- Replaces the single-role `profiles` model with the platform's real
-- shape: one User account per person, holding zero or more UserRoles.
-- See card-show-platform-architecture.md, section 3 "Persona → Module
-- Mapping" / "One signup/login for everyone."

create type public.app_role as enum ('platform_admin', 'organiser_staff', 'vendor', 'attendee');

-- One row per auth user — profile fields shared regardless of which
-- role(s) this person holds.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- A person can hold multiple roles at once (e.g. vendor AND attendee).
-- organiser_id is nullable and, for now, unconstrained — no organisers
-- table exists yet, but the column is here so organiser_staff can be
-- scoped to a specific organiser once that table is built. vendor/attendee
-- are self-serve (granted_by left null) whenever a user takes a
-- vendor/attendee action — e.g. applying to a show or getting a ticket,
-- not at account signup itself. platform_admin/organiser_staff are only
-- ever granted by an existing admin/organiser — that grant flow isn't
-- built yet, but the RLS below already blocks self-granting either of
-- those roles.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role public.app_role not null,
  organiser_id uuid,
  granted_by uuid references public.users (id),
  granted_at timestamptz not null default now(),
  unique (user_id, role, organiser_id)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

-- Extra fields that only exist once a user holds the vendor role.
create table public.vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  business_name text,
  tax_id text,
  mailing_address text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.vendor_profiles enable row level security;

-- Nothing is publicly readable by default: users can only read/update
-- their own row, full stop.
create policy "Users can view own user row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own user row"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can view own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

-- Self-serve role grants can only ever be vendor or attendee for
-- yourself, and only ungranted (i.e. not impersonating an admin-issued
-- grant). platform_admin/organiser_staff require a future grant flow
-- (server-side, run as the granting admin) that this policy does not
-- allow from the client.
create policy "Users can self-grant vendor or attendee"
  on public.user_roles for insert
  with check (
    auth.uid() = user_id
    and role in ('vendor', 'attendee')
    and granted_by is null
  );

create policy "Users can view own vendor profile"
  on public.vendor_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own vendor profile"
  on public.vendor_profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own vendor profile"
  on public.vendor_profiles for insert
  with check (auth.uid() = user_id);

-- Auto-creates a `users` row when someone signs up, pulling name/phone out
-- of the signup form's user_metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
