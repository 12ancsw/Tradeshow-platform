-- Drop booth_types.selection_fee: per the architecture doc, a selection
-- fee belongs to a ReleasePhase (only charged under
-- allocation_mode = immediate_selection, and set by the organiser when
-- they release booths into that phase), not to the booth type itself.
-- ReleasePhase doesn't exist yet -- when it's built, selection_fee_amount
-- will live there instead. Booth types are generic (category, name,
-- cost) again.
alter table public.booth_types drop column selection_fee;
