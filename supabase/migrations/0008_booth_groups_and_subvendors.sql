-- Booth groups ("islands") and their subvendor roster. See
-- card-show-platform-architecture.md section 2 (BoothGroup) -- this is a
-- deliberately narrow slice of that model, not the full thing:
--
-- * No costing/payment/application involvement at all -- an island's
--   price is still just its booth type's base_price like any other booth
--   (see 0004/0006), and there's no primary-vendor-pays-for-the-whole-island
--   flow. This table exists purely so an organiser can record, per island,
--   who the subvendors are (business details, logo, a free-text note on
--   passes owed) -- a paperwork/reference tool, not a booking mechanic.
-- * No island_layout_template / auto-generated sub-slots. An organiser
--   still creates each island booth one at a time (booths.booth_type_id
--   category = 'island', per 0004's simplification note) and then, as a
--   separate step here, assigns specific existing booths into a named
--   booth_group.
-- * No BoothGroupMembership / primary-vs-sub vendor roles, no real vendor
--   accounts involved -- subvendor entries are free text the organiser
--   types in directly, not linked to a public.users row. There's no
--   Application/vendor-assignment flow yet for a real account to hang off
--   of (same reasoning as booth_types/add_ons before this).

create table public.booth_groups (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organiser_ref text not null,
  created_at timestamptz not null default now(),
  unique (show_id, organiser_ref)
);

create index booth_groups_show_id_idx on public.booth_groups (show_id);

-- Which island a booth belongs to, assigned separately from booth
-- creation. Nullable (most booths aren't part of an island), and set
-- null (not cascaded) if the group is deleted -- deleting an island's
-- roster shouldn't delete real booth inventory, same reasoning as
-- booth_types not cascading onto booths.
alter table public.booths
  add column booth_group_id uuid references public.booth_groups (id) on delete set null;

create index booths_booth_group_id_idx on public.booths (booth_group_id);

create table public.booth_group_subvendors (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  booth_group_id uuid not null references public.booth_groups (id) on delete cascade,
  booth_id uuid references public.booths (id) on delete set null,
  business_name text not null,
  contact_email text,
  contact_phone text,
  logo_path text,
  notes text,
  passes_note text,
  created_at timestamptz not null default now()
);

create index booth_group_subvendors_show_id_idx on public.booth_group_subvendors (show_id);
create index booth_group_subvendors_booth_group_id_idx on public.booth_group_subvendors (booth_group_id);

-- A booth can only have one subvendor recorded against it.
create unique index booth_group_subvendors_booth_id_key
  on public.booth_group_subvendors (booth_id)
  where booth_id is not null;

alter table public.booth_groups enable row level security;
alter table public.booth_group_subvendors enable row level security;

create policy "Platform admins and organiser staff can view booth groups"
  on public.booth_groups for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create booth groups"
  on public.booth_groups for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update booth groups"
  on public.booth_groups for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete booth groups"
  on public.booth_groups for delete
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can view subvendors"
  on public.booth_group_subvendors for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create subvendors"
  on public.booth_group_subvendors for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update subvendors"
  on public.booth_group_subvendors for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete subvendors"
  on public.booth_group_subvendors for delete
  using (public.can_manage_show(show_id));

-- Storage bucket for subvendor logos. Public read (same reasoning as the
-- floorplans bucket -- these are just business logos, not sensitive), and
-- objects are stored at `{show_id}/{random}.{ext}` so
-- `(storage.foldername(name))[1]` is the show_id can_manage_show() checks.
insert into storage.buckets (id, name, public)
values ('vendor-logos', 'vendor-logos', true)
on conflict (id) do nothing;

create policy "Platform admins and organiser staff can upload vendor logos"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-logos'
    and public.can_manage_show(((storage.foldername(name))[1])::uuid)
  );
