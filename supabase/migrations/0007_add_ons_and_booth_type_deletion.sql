-- Add-ons (show-level, per card-show-platform-architecture.md section 2:
-- Show -> AddOn 1:many, "Add-on manager... with pricing rules" in the
-- Organiser Console). `mandatory` marks an add-on the organiser requires
-- on every application for this show, rather than one a vendor opts into.
-- There's no Application flow yet to actually enforce that against, so
-- for now `mandatory` is just data the future application flow will read.
create table public.add_ons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0,
  mandatory boolean not null default false,
  created_at timestamptz not null default now()
);

create index add_ons_show_id_idx on public.add_ons (show_id);

alter table public.add_ons enable row level security;

create policy "Platform admins and organiser staff can view add-ons"
  on public.add_ons for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create add-ons"
  on public.add_ons for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update add-ons"
  on public.add_ons for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete add-ons"
  on public.add_ons for delete
  using (public.can_manage_show(show_id));

-- Lets organisers delete booth types. booths.booth_type_id has no
-- `on delete cascade` (deliberately -- deleting a type shouldn't
-- silently orphan/delete real booth inventory), so this fails with a
-- foreign-key violation if any booths still reference the type; the app
-- catches that and surfaces a clear message rather than a raw DB error.
create policy "Platform admins and organiser staff can delete booth types"
  on public.booth_types for delete
  using (public.can_manage_show(show_id));
