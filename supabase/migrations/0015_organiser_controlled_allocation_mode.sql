-- Lets the organiser -- not the vendor -- decide, per release phase,
-- whether applicants request booth/island types and have the organiser
-- assign specific booths later, or self-select specific live+available
-- booths/an island themselves. This is
-- card-show-platform-architecture.md's ReleasePhase.allocation_mode,
-- which 0012/0013 deliberately left out in favour of letting the vendor
-- freely choose either path on any open phase (an "Organiser assigns" /
-- "I'll pick my own" toggle on the apply form) -- organiser feedback was
-- that the organiser should be the one setting this, not the applicant.
--
-- Existing applications are unaffected: `applications.is_self_selected`
-- is recorded at submission time and never re-derived from the phase, so
-- changing a phase's allocation_mode later only changes what *new*
-- applications can do under it.
create type public.release_phase_allocation_mode as enum ('organiser_allocated', 'immediate_selection');

alter table public.release_phases
  add column allocation_mode public.release_phase_allocation_mode not null default 'organiser_allocated';

-- Re-point both vendor-facing application functions (0013) at the
-- phase's allocation_mode instead of accepting either path on any open
-- phase. Bodies are otherwise unchanged from 0013.
create or replace function public.submit_application_assigned(
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
      and allocation_mode = 'organiser_allocated'
  ) then
    raise exception 'This application phase is not accepting organiser-assigned applications.';
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

create or replace function public.submit_application_self_selected(
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
  where id = p_release_phase_id and show_id = p_show_id and status = 'open'
    and allocation_mode = 'immediate_selection';

  if not found then
    raise exception 'This application phase is not accepting self-selected applications.';
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
