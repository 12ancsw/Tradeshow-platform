-- Terms & Conditions manager (organiser-side only, this pass). Lets
-- platform_admin/organiser_staff maintain a show's T&Cs -- an
-- organiser-defined `type` (free text, e.g. "Vendor Terms", "Attendee
-- Terms", "Photography Policy" -- deliberately not a fixed Postgres enum,
-- since the organiser decides what categories they need, not the
-- platform), `content` (the actual text), and a manual draft/published
-- toggle mirroring release_phases.status's draft/open/closed pattern --
-- `published_at` is null while a T&C is still being drafted and gets set
-- to the moment the organiser publishes it; un-publishing clears it back
-- to null rather than deleting the row.
--
-- Scoped per-show, same as booth_types/add_ons/release_phases, since
-- different shows may need different terms.
--
-- Deliberately narrow: no public read policy yet, and nothing in the
-- application flow (submit_application_assigned/submit_application_self_selected,
-- or the apply form itself) requires accepting a T&C to apply -- that's
-- the "eventual" vendor/attendee application-flow integration, a future
-- pass once this manager exists to actually author terms with.
create table public.terms_and_conditions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  type text not null,
  content text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index terms_and_conditions_show_id_idx on public.terms_and_conditions (show_id);

alter table public.terms_and_conditions enable row level security;

create policy "Platform admins and organiser staff can view terms and conditions"
  on public.terms_and_conditions for select
  using (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can create terms and conditions"
  on public.terms_and_conditions for insert
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can update terms and conditions"
  on public.terms_and_conditions for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Platform admins and organiser staff can delete terms and conditions"
  on public.terms_and_conditions for delete
  using (public.can_manage_show(show_id));
