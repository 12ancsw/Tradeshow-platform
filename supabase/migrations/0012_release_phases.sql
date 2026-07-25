-- Release phases (card-show-platform-architecture.md section 2/6):
-- organisers want to gate *when* and *how much* they have to review, so
-- vendors can only apply for booth/island types attached to a currently
-- `open` phase. Deliberately simplified vs. the architecture doc:
--
-- * status is a manual draft/open/closed toggle the organiser flips
--   themselves, not starts_at/ends_at with automatic transitions -- no
--   scheduler/cron exists in this app, and every other time-sensitive
--   thing here (payment verification, invite claiming) is already
--   manual by design.
-- * A phase releases booth types / island types (not individual
--   booths/islands) -- see the Applications migration for how that
--   interacts with per-booth availability at apply time.
--
-- Also gives islands their own status column (mirroring booths' -- an
-- island is now a bookable unit applications can hold/confirm, not just
-- a roster container), and opens public read access to show/booth/island
-- setup data -- until now every one of these tables was organiser-only,
-- which blocks any vendor-facing browsing entirely.

create type public.release_phase_status as enum ('draft', 'open', 'closed');

create table public.release_phases (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  name text not null,
  status public.release_phase_status not null default 'draft',
  selection_fee_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index release_phases_show_id_idx on public.release_phases (show_id);

create table public.release_phase_booth_types (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  release_phase_id uuid not null references public.release_phases (id) on delete cascade,
  booth_type_id uuid not null references public.booth_types (id) on delete cascade,
  unique (release_phase_id, booth_type_id)
);

create index release_phase_booth_types_phase_idx on public.release_phase_booth_types (release_phase_id);

create table public.release_phase_island_types (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  release_phase_id uuid not null references public.release_phases (id) on delete cascade,
  island_type_id uuid not null references public.island_types (id) on delete cascade,
  unique (release_phase_id, island_type_id)
);

create index release_phase_island_types_phase_idx on public.release_phase_island_types (release_phase_id);

alter table public.booth_groups
  add column status public.booth_status not null default 'available';

alter table public.release_phases enable row level security;
alter table public.release_phase_booth_types enable row level security;
alter table public.release_phase_island_types enable row level security;

create policy "Platform admins and organiser staff can view release phases"
  on public.release_phases for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create release phases"
  on public.release_phases for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update release phases"
  on public.release_phases for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete release phases"
  on public.release_phases for delete
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can view phase booth types"
  on public.release_phase_booth_types for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create phase booth types"
  on public.release_phase_booth_types for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete phase booth types"
  on public.release_phase_booth_types for delete
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can view phase island types"
  on public.release_phase_island_types for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create phase island types"
  on public.release_phase_island_types for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete phase island types"
  on public.release_phase_island_types for delete
  using (public.can_manage_show(show_id));

-- Public read access: this is the first vendor-facing data anyone can
-- browse without being organiser staff for the show, so every table a
-- vendor needs to see a show's setup (what's for sale, what it costs,
-- what's already taken) opens up here. Writes stay exactly as
-- restricted as before -- these are additive SELECT policies, and
-- Postgres RLS ORs multiple permissive policies together, so the
-- existing organiser-only SELECT policies on these tables are now
-- redundant but harmless.
create policy "Anyone can view shows"
  on public.shows for select
  using (true);

create policy "Anyone can view booth types"
  on public.booth_types for select
  using (true);

create policy "Anyone can view booths"
  on public.booths for select
  using (true);

create policy "Anyone can view island types"
  on public.island_types for select
  using (true);

create policy "Anyone can view booth groups"
  on public.booth_groups for select
  using (true);

create policy "Anyone can view add-ons"
  on public.add_ons for select
  using (true);

create policy "Anyone can view release phases open to applicants"
  on public.release_phases for select
  using (status = 'open');

create policy "Anyone can view open phase booth types"
  on public.release_phase_booth_types for select
  using (
    exists (
      select 1 from public.release_phases
      where release_phases.id = release_phase_booth_types.release_phase_id
        and release_phases.status = 'open'
    )
  );

create policy "Anyone can view open phase island types"
  on public.release_phase_island_types for select
  using (
    exists (
      select 1 from public.release_phases
      where release_phases.id = release_phase_island_types.release_phase_id
        and release_phases.status = 'open'
    )
  );
