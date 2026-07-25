-- Islands become their own bookable, priced, floorplan-tagged entity
-- rather than a roster grouping over individually-tagged booths. Per
-- feedback: "island applicants will pay for island" -- the island itself
-- is the unit an applicant books and pays for (once an Application flow
-- exists; still not built -- see CLAUDE.md), not its individual sub-slot
-- booths. Concretely:
--
-- * island_types mirrors booth_types (name, base_price) but is a
--   separate table, not a new booth_types.category value -- booth_types
--   with category='island' still means "type of an individual sub-slot
--   booth within an island" (0004's simplification, unchanged); this new
--   table means "type of the island container itself."
-- * booth_groups gets island_type_id (its price/category) and map_x/map_y
--   (its own floorplan pin), the same shape as booths' own placement
--   columns. Both nullable: existing island rows predate this migration
--   and have neither set yet.
--
-- Still not wired into payments/applications (no PaymentRecord/Application
-- exists), and sub-slot booths within an island keep working exactly as
-- before (booth_group_subvendors.booth_id, setBoothGroup) -- this only
-- changes what shows up as its own pin on the floorplan.

create table public.island_types (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  name text not null,
  base_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index island_types_show_id_idx on public.island_types (show_id);

alter table public.booth_groups
  add column island_type_id uuid references public.island_types (id),
  add column map_x numeric(5, 2),
  add column map_y numeric(5, 2);

alter table public.island_types enable row level security;

create policy "Platform admins and organiser staff can view island types"
  on public.island_types for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create island types"
  on public.island_types for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update island types"
  on public.island_types for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

-- No `on delete` override on booth_groups.island_type_id (defaults to
-- NO ACTION), same as booth_types used to be before 0011 -- deleting an
-- island type still in use fails with a clear message instead of
-- silently leaving islands priceless.
create policy "Platform admins and organiser staff can delete island types"
  on public.island_types for delete
  using (public.can_manage_show(show_id));
