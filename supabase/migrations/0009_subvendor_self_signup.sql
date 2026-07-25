-- Lets a subvendor claim their own booth_group_subvendors entry via a
-- one-time invite link and fill in their own details, instead of that
-- roster being organiser-entered only (0008). This is the first real
-- "vendor role gets granted as part of a flow, not at signup" moment
-- described in CLAUDE.md's Auth section -- claiming an invite self-grants
-- the vendor role and a blank vendor_profiles row, same self-serve RLS
-- policy from 0002_users_roles_and_vendor_profiles.sql.
--
-- Still no PassType/PassAssignment system (passes_note stays organiser-
-- entered free text, per CLAUDE.md) and still nothing to do with costing
-- or applications -- a claimed subvendor can only edit their own
-- descriptive fields (business_name, contact info, notes, logo), never
-- booth_id, booth_group_id, or passes_note.

alter table public.booth_group_subvendors
  add column user_id uuid references public.users (id) on delete set null;

create index booth_group_subvendors_user_id_idx
  on public.booth_group_subvendors (user_id);

-- Organiser staff already see every subvendor row for shows they manage
-- (0008's can_manage_show policy). This adds the other half: a claimed
-- subvendor can see their own row, from any show.
create policy "Subvendors can view their own claimed entry"
  on public.booth_group_subvendors for select
  using (user_id = auth.uid());

-- Claiming and self-editing go through security-definer functions rather
-- than plain RLS policies: an UPDATE policy permissive enough to let an
-- unauthenticated-in-the-row user claim a row (`user_id is null`) would
-- also let them overwrite organiser-controlled columns (booth_id,
-- passes_note, ...) in the same statement, since RLS is row-level, not
-- column-level. These functions hard-code exactly which columns each
-- action can touch.

-- Safe to expose broadly: only returns the one row matching the exact id
-- passed in, and only non-sensitive display fields -- enough for an
-- invite landing page to say "you're invited as X" before the visitor
-- has claimed (and can therefore SELECT) the row through RLS.
create function public.get_subvendor_invite_preview(target_id uuid)
returns table (
  id uuid,
  business_name text,
  claimed boolean,
  island_ref text,
  booth_ref text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.business_name,
    (s.user_id is not null) as claimed,
    g.organiser_ref as island_ref,
    b.organiser_ref as booth_ref
  from public.booth_group_subvendors s
  join public.booth_groups g on g.id = s.booth_group_id
  left join public.booths b on b.id = s.booth_id
  where s.id = target_id;
$$;

create function public.claim_booth_group_subvendor(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.booth_group_subvendors
  set user_id = auth.uid()
  where id = target_id and user_id is null;

  if not found then
    raise exception 'This invite has already been claimed or does not exist.';
  end if;
end;
$$;

create function public.update_own_booth_group_subvendor(
  target_id uuid,
  new_business_name text,
  new_contact_email text,
  new_contact_phone text,
  new_notes text,
  new_logo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.booth_group_subvendors
  set business_name = new_business_name,
      contact_email = new_contact_email,
      contact_phone = new_contact_phone,
      notes = new_notes,
      logo_path = coalesce(new_logo_path, logo_path)
  where id = target_id and user_id = auth.uid();

  if not found then
    raise exception 'Not found, or not yours to edit.';
  end if;
end;
$$;

-- A claimed subvendor uploads their own logo the same way organiser
-- staff do (vendor-logos bucket, 0008), just gated on holding a claimed
-- entry for that show rather than can_manage_show.
create policy "Claimed subvendors can upload their own logo"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-logos'
    and exists (
      select 1 from public.booth_group_subvendors
      where booth_group_subvendors.show_id = ((storage.foldername(name))[1])::uuid
        and booth_group_subvendors.user_id = auth.uid()
    )
  );
