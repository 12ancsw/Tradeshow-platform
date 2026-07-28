-- Fixes a gap left by 0012: every table a vendor needs to browse a show
-- (shows, booth_types, booths, island_types, booth_groups, add_ons) got a
-- public `using (true)` SELECT policy so vendor-facing pages could read
-- them without being organiser staff -- floorplan_versions was missed.
-- Its row is what maps `shows.active_floorplan_version_id` to the actual
-- image_path in the (already public) `floorplans` Storage bucket, so
-- without this, every vendor-facing floorplan render silently resolved
-- to null for anyone who wasn't organiser staff for that show -- the
-- booths/islands themselves were visible (map_x etc. via 0012), just
-- never the image to place their pins on.
create policy "Anyone can view floorplan versions"
  on public.floorplan_versions for select
  using (true);
