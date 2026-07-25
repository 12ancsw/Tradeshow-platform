-- Lets organisers actually delete a booth type that still has booths
-- assigned to it, rather than being blocked (0007's original behaviour).
-- With islands now placed and priced as their own entity (0010), the old
-- 'island'-category booth types some shows already have booths under are
-- expected cleanup, not an error condition -- so this replaces the
-- foreign-key block with a cascade: deleting a booth type deletes the
-- booths that used it. booth_group_subvendors.booth_id (0008) is already
-- `on delete set null`, so any subvendor roster entries pointing at a
-- deleted booth just lose that booth reference rather than being deleted
-- themselves.
--
-- The app surfaces this plainly before it happens (a count of affected
-- booths in the delete confirmation), since it's now a real deletion of
-- booth inventory, not a blocked one.
alter table public.booths drop constraint booths_booth_type_id_fkey;

alter table public.booths
  add constraint booths_booth_type_id_fkey
  foreign key (booth_type_id) references public.booth_types (id) on delete cascade;
