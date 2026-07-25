-- Applications and manual payment verification
-- (card-show-platform-architecture.md section 2/7), scoped to what was
-- agreed for this pass:
--
-- * One choice per application: `is_self_selected` -- either the vendor
--   requests booth type(s) + quantity (<=6 total) and the organiser
--   allocates specific booths later, or the vendor picks specific,
--   currently live+available booths/island themselves off the floorplan
--   right away. Never mixed within one application.
-- * Booths and an island are mutually exclusive within one application
--   (at most 1 island, no booths alongside it).
-- * The per-booth selection fee (release_phases.selection_fee_amount)
--   only applies when self-selecting booths -- never for an island,
--   self-selected or not.
-- * "Live and available" (status = 'available' and placed on the active
--   floorplan, i.e. map_x is not null) gates both what a vendor can
--   self-select and what an organiser can later allocate.
-- * No release-phase time windows, no automated hold expiry -- matches
--   0012's manual-phase-toggle simplification.
--
-- All writes that a *vendor* makes go through the two security-definer
-- functions below (submit_application_assigned,
-- submit_application_self_selected, submit_payment_proof) rather than
-- table RLS policies, for the same reason 0009's subvendor-claim
-- functions do: RLS is row-level, not column-level, and these actions
-- need to touch several tables atomically (with a compare-and-swap on
-- booth/island availability to avoid a race between two applicants)
-- while only ever allowing the caller to write a narrow, specific set of
-- fields. Organiser-side writes (allocating specific booths, verifying
-- payment) reuse the existing can_manage_show-gated UPDATE policies on
-- booths/booth_groups, plus new ones on applications/payment_records --
-- those actions are trusted and don't need the same narrowing.

create type public.application_status as enum (
  'submitted', 'allocated', 'payment_pending', 'confirmed', 'rejected', 'cancelled'
);

create type public.payment_status as enum (
  'awaiting_proof', 'proof_submitted', 'verified', 'rejected', 'waived'
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  release_phase_id uuid not null references public.release_phases (id),
  applicant_user_id uuid not null references public.users (id),
  is_self_selected boolean not null default false,
  requested_island_type_id uuid references public.island_types (id),
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create index applications_show_id_idx on public.applications (show_id);
create index applications_applicant_user_id_idx on public.applications (applicant_user_id);

-- Booth *type* + quantity requested when organiser-assigned (is_self_selected
-- = false). Specific booths, once allocated, are recorded directly on
-- booths.application_id below -- this table is just the ask, not the
-- fulfilment.
create table public.application_booth_requests (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  booth_type_id uuid not null references public.booth_types (id),
  quantity integer not null check (quantity > 0),
  unique (application_id, booth_type_id)
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  amount numeric(10, 2) not null,
  proof_path text,
  status public.payment_status not null default 'awaiting_proof',
  verified_by uuid references public.users (id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (application_id)
);

-- Which application currently holds a booth/island. Set null (not
-- cascaded) if the application row is ever removed -- there's no delete
-- flow for applications, but this matches the same "never silently
-- delete real inventory" reasoning used everywhere else.
alter table public.booths
  add column application_id uuid references public.applications (id) on delete set null;

alter table public.booth_groups
  add column application_id uuid references public.applications (id) on delete set null;

alter table public.applications enable row level security;
alter table public.application_booth_requests enable row level security;
alter table public.payment_records enable row level security;

create policy "Applicants and organiser staff can view applications"
  on public.applications for select
  using (public.can_manage_show(show_id) or applicant_user_id = auth.uid());

create policy "Organiser staff can update applications"
  on public.applications for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

create policy "Applicants and organiser staff can view booth requests"
  on public.application_booth_requests for select
  using (
    public.can_manage_show(show_id)
    or exists (
      select 1 from public.applications
      where applications.id = application_booth_requests.application_id
        and applications.applicant_user_id = auth.uid()
    )
  );

create policy "Applicants and organiser staff can view payment records"
  on public.payment_records for select
  using (
    public.can_manage_show(show_id)
    or exists (
      select 1 from public.applications
      where applications.id = payment_records.application_id
        and applications.applicant_user_id = auth.uid()
    )
  );

create policy "Organiser staff can update payment records"
  on public.payment_records for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));

-- Organiser-assigned path: vendor requests booth type(s) + quantity
-- (<=6 total) or one island type; no specific booths/island touched
-- yet -- that happens later on the organiser's allocation screen via the
-- existing can_manage_show UPDATE policies on booths/booth_groups.
create function public.submit_application_assigned(
  p_show_id uuid,
  p_release_phase_id uuid,
  p_island_type_id uuid,
  p_booth_type_ids uuid[],
  p_booth_type_quantities integer[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_application_id uuid;
  v_amount numeric(10, 2) := 0;
  v_total_booths integer := 0;
  v_i integer;
  v_booth_type_id uuid;
  v_qty integer;
  v_price numeric(10, 2);
  v_released boolean;
begin
  if v_uid is null then
    raise exception 'You must be logged in to apply.';
  end if;

  if not exists (
    select 1 from public.release_phases
    where id = p_release_phase_id and show_id = p_show_id and status = 'open'
  ) then
    raise exception 'This application phase is not open.';
  end if;

  if p_island_type_id is not null then
    if p_booth_type_ids is not null and array_length(p_booth_type_ids, 1) > 0 then
      raise exception 'An application can include booths or one island, not both.';
    end if;

    select exists (
      select 1 from public.release_phase_island_types
      where release_phase_id = p_release_phase_id and island_type_id = p_island_type_id
    ) into v_released;

    if not v_released then
      raise exception 'That island type is not available in this phase.';
    end if;

    select base_price into v_price from public.island_types where id = p_island_type_id;
    v_amount := coalesce(v_price, 0);
  elsif p_booth_type_ids is not null and array_length(p_booth_type_ids, 1) > 0 then
    if array_length(p_booth_type_ids, 1) <> coalesce(array_length(p_booth_type_quantities, 1), 0) then
      raise exception 'Booth type and quantity lists must match.';
    end if;

    for v_i in 1 .. array_length(p_booth_type_ids, 1) loop
      v_booth_type_id := p_booth_type_ids[v_i];
      v_qty := p_booth_type_quantities[v_i];

      if v_qty is null or v_qty < 1 then
        raise exception 'Quantity must be at least 1.';
      end if;

      select exists (
        select 1 from public.release_phase_booth_types
        where release_phase_id = p_release_phase_id and booth_type_id = v_booth_type_id
      ) into v_released;

      if not v_released then
        raise exception 'One of the selected booth types is not available in this phase.';
      end if;

      v_total_booths := v_total_booths + v_qty;

      select base_price into v_price from public.booth_types where id = v_booth_type_id;
      v_amount := v_amount + coalesce(v_price, 0) * v_qty;
    end loop;

    if v_total_booths > 6 then
      raise exception 'A single application can request at most 6 booths.';
    end if;
  else
    raise exception 'Select at least one booth type or an island type.';
  end if;

  insert into public.applications
    (show_id, release_phase_id, applicant_user_id, is_self_selected, requested_island_type_id, status)
  values
    (p_show_id, p_release_phase_id, v_uid, false, p_island_type_id, 'submitted')
  returning id into v_application_id;

  if p_island_type_id is null then
    for v_i in 1 .. array_length(p_booth_type_ids, 1) loop
      insert into public.application_booth_requests (show_id, application_id, booth_type_id, quantity)
      values (p_show_id, v_application_id, p_booth_type_ids[v_i], p_booth_type_quantities[v_i]);
    end loop;
  end if;

  insert into public.payment_records (show_id, application_id, amount, status)
  values (p_show_id, v_application_id, v_amount, 'awaiting_proof');

  return v_application_id;
end;
$$;

-- Self-selected path: vendor picks specific, currently live+available
-- booths (<=6, selection fee applies per booth) or one specific
-- live+available island (no fee). The UPDATE ... where status =
-- 'available' and map_x is not null is a compare-and-swap: if another
-- applicant took the same booth/island a moment earlier, the row count
-- won't match what was requested and the whole function raises,
-- rolling back the application/payment rows it already inserted.
create function public.submit_application_self_selected(
  p_show_id uuid,
  p_release_phase_id uuid,
  p_booth_ids uuid[],
  p_island_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_application_id uuid;
  v_selection_fee numeric(10, 2);
  v_amount numeric(10, 2) := 0;
  v_booth_count integer;
  v_updated integer;
  v_booth_id uuid;
  v_booth_type_id uuid;
  v_island_type_id uuid;
  v_price numeric(10, 2);
  v_released boolean;
begin
  if v_uid is null then
    raise exception 'You must be logged in to apply.';
  end if;

  select selection_fee_amount into v_selection_fee
  from public.release_phases
  where id = p_release_phase_id and show_id = p_show_id and status = 'open';

  if not found then
    raise exception 'This application phase is not open.';
  end if;

  if p_island_id is not null then
    if p_booth_ids is not null and array_length(p_booth_ids, 1) > 0 then
      raise exception 'An application can include booths or one island, not both.';
    end if;

    select island_type_id into v_island_type_id
    from public.booth_groups
    where id = p_island_id and show_id = p_show_id and status = 'available' and map_x is not null;

    if v_island_type_id is null then
      raise exception 'That island is no longer available.';
    end if;

    select exists (
      select 1 from public.release_phase_island_types
      where release_phase_id = p_release_phase_id and island_type_id = v_island_type_id
    ) into v_released;

    if not v_released then
      raise exception 'That island is not available in this phase.';
    end if;

    select base_price into v_price from public.island_types where id = v_island_type_id;
    v_amount := coalesce(v_price, 0);

    insert into public.applications
      (show_id, release_phase_id, applicant_user_id, is_self_selected, requested_island_type_id, status)
    values
      (p_show_id, p_release_phase_id, v_uid, true, v_island_type_id, 'allocated')
    returning id into v_application_id;

    update public.booth_groups
    set application_id = v_application_id, status = 'held'
    where id = p_island_id and status = 'available' and map_x is not null;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'That island was just taken. Please choose another.';
    end if;
  elsif p_booth_ids is not null and array_length(p_booth_ids, 1) > 0 then
    v_booth_count := array_length(p_booth_ids, 1);

    if v_booth_count > 6 then
      raise exception 'A single application can request at most 6 booths.';
    end if;

    foreach v_booth_id in array p_booth_ids loop
      select b.booth_type_id, bt.base_price into v_booth_type_id, v_price
      from public.booths b
      join public.booth_types bt on bt.id = b.booth_type_id
      where b.id = v_booth_id and b.show_id = p_show_id and b.status = 'available' and b.map_x is not null;

      if v_booth_type_id is null then
        raise exception 'One of the selected booths is no longer available.';
      end if;

      select exists (
        select 1 from public.release_phase_booth_types
        where release_phase_id = p_release_phase_id and booth_type_id = v_booth_type_id
      ) into v_released;

      if not v_released then
        raise exception 'One of the selected booths is not available in this phase.';
      end if;

      v_amount := v_amount + coalesce(v_price, 0) + coalesce(v_selection_fee, 0);
    end loop;

    insert into public.applications
      (show_id, release_phase_id, applicant_user_id, is_self_selected, status)
    values
      (p_show_id, p_release_phase_id, v_uid, true, 'allocated')
    returning id into v_application_id;

    update public.booths
    set application_id = v_application_id, status = 'held'
    where id = any(p_booth_ids) and status = 'available' and map_x is not null;

    get diagnostics v_updated = row_count;
    if v_updated <> v_booth_count then
      raise exception 'One of the selected booths was just taken. Please choose again.';
    end if;
  else
    raise exception 'Select at least one booth or an island.';
  end if;

  insert into public.payment_records (show_id, application_id, amount, status)
  values (p_show_id, v_application_id, v_amount, 'awaiting_proof');

  return v_application_id;
end;
$$;

-- Vendor's own "I've paid, here's my proof" step. Deliberately narrow:
-- only proof_path and status move to 'proof_submitted' on the payment
-- record (never verified/verified_by/amount), and the application only
-- moves to 'payment_pending' -- both scoped to the caller's own
-- application.
create function public.submit_payment_proof(p_application_id uuid, p_proof_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payment_records
  set proof_path = p_proof_path, status = 'proof_submitted'
  where application_id = p_application_id
    and status in ('awaiting_proof', 'proof_submitted')
    and exists (
      select 1 from public.applications
      where applications.id = p_application_id and applications.applicant_user_id = auth.uid()
    );

  if not found then
    raise exception 'Not found, or not yours to update.';
  end if;

  update public.applications
  set status = 'payment_pending'
  where id = p_application_id and status in ('submitted', 'allocated', 'payment_pending');
end;
$$;

-- Storage bucket for payment proof screenshots -- NOT public, unlike
-- floorplans/vendor-logos, since these are financial records. Objects
-- are stored at `{show_id}/{application_id}/{random}.{ext}`; reading
-- requires a signed URL generated server-side by whichever page renders
-- it (the applicant's own "My Applications" view, or the organiser's
-- payment verification queue).
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "Applicants can upload their own payment proof"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.applications
      where applications.id = ((storage.foldername(name))[2])::uuid
        and applications.show_id = ((storage.foldername(name))[1])::uuid
        and applications.applicant_user_id = auth.uid()
    )
  );

create policy "Applicants and organiser staff can view payment proofs"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (
      public.can_manage_show(((storage.foldername(name))[1])::uuid)
      or exists (
        select 1 from public.applications
        where applications.id = ((storage.foldername(name))[2])::uuid
          and applications.applicant_user_id = auth.uid()
      )
    )
  );

-- public.users (0002) only lets a user read their own row, plus a
-- platform_admin-specific policy from 0003. Organiser staff reviewing
-- applications need to see an applicant's name -- add the equivalent
-- policy scoped to people who have actually applied to a show that
-- staff member manages.
create policy "Organiser staff can view their applicants' user info"
  on public.users for select
  using (
    exists (
      select 1 from public.applications
      where applications.applicant_user_id = users.id
        and public.can_manage_show(applications.show_id)
    )
  );
