-- Lets platform_admin/organiser_staff edit a booth type's details after
-- creation -- 0004_booth_types_booths_and_floorplans.sql only granted
-- select/insert. booths already has an update policy from that migration
-- (used for floorplan tagging), reused here for editing a booth's
-- identifier/type/status too.
create policy "Platform admins and organiser staff can update booth types"
  on public.booth_types for update
  using (public.can_manage_show(show_id))
  with check (public.can_manage_show(show_id));
