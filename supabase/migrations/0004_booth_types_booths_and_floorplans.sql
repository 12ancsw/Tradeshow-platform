-- Booth types, booths, and floorplan images for a show. See
-- card-show-platform-architecture.md, section 2 (BoothType, Booth,
-- FloorplanVersion) and section 3 (Organiser Console).
--
-- Deliberate simplifications vs. the fuller architecture doc model for
-- this iteration (noted in CLAUDE.md): no islands (BoothGroup /
-- parent_group_id / island_layout_template), no release phases, and no
-- floorplan draft/publish reconciliation workflow -- just booth type
-- definition, a flat list of booths per show, and a single
-- "latest upload wins" floorplan image.

create type public.booth_category as enum ('island', 'standard', 'corner');
create type public.booth_status as enum ('available', 'held', 'pending_payment', 'confirmed', 'blocked');

create table public.booth_types (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  name text not null,
  category public.booth_category not null,
  base_price numeric(10, 2) not null default 0,
  selection_fee numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index booth_types_show_id_idx on public.booth_types (show_id);

create table public.booths (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  booth_type_id uuid not null references public.booth_types (id),
  organiser_ref text not null,
  status public.booth_status not null default 'available',
  map_x numeric(5, 2),
  map_y numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (show_id, organiser_ref)
);

create index booths_show_id_idx on public.booths (show_id);
create index booths_booth_type_id_idx on public.booths (booth_type_id);

create table public.floorplan_versions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  image_path text not null,
  uploaded_by uuid references public.users (id),
  uploaded_at timestamptz not null default now()
);

create index floorplan_versions_show_id_idx on public.floorplan_versions (show_id);

-- Was nullable and unconstrained (no floorplan_versions table existed
-- yet) since 0003_organisers_and_shows.sql. Constrain it now.
alter table public.shows
  add constraint shows_active_floorplan_version_id_fkey
  foreign key (active_floorplan_version_id) references public.floorplan_versions (id);

alter table public.booth_types enable row level security;
alter table public.booths enable row level security;
alter table public.floorplan_versions enable row level security;

-- Shared check: can the caller manage (read/write) the given show's
-- setup data? Same platform_admin / organiser_staff-for-this-organiser
-- rule as shows/organisers themselves (0003_organisers_and_shows.sql),
-- just resolved one hop further through shows.organiser_id.
create function public.can_manage_show(target_show_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shows
    where shows.id = target_show_id
      and (public.is_platform_admin() or public.is_organiser_staff_for(shows.organiser_id))
  );
$$;

create policy "Platform admins and organiser staff can view booth types"
  on public.booth_types for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create booth types"
  on public.booth_types for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can view booths"
  on public.booths for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create booths"
  on public.booths for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update booths"
  on public.booths for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can view floorplan versions"
  on public.floorplan_versions for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create floorplan versions"
  on public.floorplan_versions for insert
  with check (public.can_manage_show(show_id));

-- Storage bucket for floorplan images. Public read (venue map images
-- aren't sensitive) so the public URL works directly without signed
-- URLs; write access is still RLS-gated below. Objects are stored at
-- `{show_id}/{random}.{ext}`, so `(storage.foldername(name))[1]` is the
-- show_id that can_manage_show() checks.
insert into storage.buckets (id, name, public)
values ('floorplans', 'floorplans', true)
on conflict (id) do nothing;

create policy "Platform admins and organiser staff can upload floorplans"
  on storage.objects for insert
  with check (
    bucket_id = 'floorplans'
    and public.can_manage_show(((storage.foldername(name))[1])::uuid)
  );
