-- Lets organiser staff edit a show's details after creation (the
-- `shows` UPDATE policy from 0003 already permits this -- only the app
-- itself never exposed an edit form) and upload a show logo that
-- appears everywhere the show is referenced: the organiser dashboard's
-- show lists, every show-management tab (shared layout header), and the
-- vendor-facing /shows / /shows/[showId] pages. Attendee/VIP views don't
-- exist yet, but `shows.logo_path` will be there for them to read once
-- they do.
alter table public.shows add column logo_path text;

-- Public read (same reasoning as floorplans/vendor-logos -- a show's
-- logo is meant to be seen everywhere, not gated), objects stored at
-- `{show_id}/{random}.{ext}` so `(storage.foldername(name))[1]` is the
-- show_id can_manage_show() checks. Only an INSERT policy is needed,
-- same as the other logo/image buckets -- replacing a logo uploads a new
-- file at a new path rather than overwriting.
insert into storage.buckets (id, name, public)
values ('show-logos', 'show-logos', true)
on conflict (id) do nothing;

create policy "Platform admins and organiser staff can upload show logos"
  on storage.objects for insert
  with check (
    bucket_id = 'show-logos'
    and public.can_manage_show(((storage.foldername(name))[1])::uuid)
  );
