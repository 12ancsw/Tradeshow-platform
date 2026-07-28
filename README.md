Tradeshow Platform — a mobile-first, multi-tenant card show vendor booking
platform. See `CLAUDE.md` for what's implemented, and
`card-show-platform-architecture.md` for the full architecture and data
model.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Supabase

1. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. In
   production (Vercel) these are set as project environment variables
   instead.
2. Run the SQL files in `supabase/migrations/` against your Supabase project,
   in order (via the SQL editor, or `supabase db push` if you have the CLI
   linked):
   - `0001_get_server_time.sql` — RPC the `/` test page calls to verify
     connectivity.
   - `0002_users_roles_and_vendor_profiles.sql` — `users`, `user_roles`,
     and `vendor_profiles` tables with RLS, and the trigger that creates a
     `users` row on signup. Used by `/signup`, `/login`, and `/dashboard`.
   - `0003_organisers_and_shows.sql` — `organisers` and `shows` tables
     with RLS (`platform_admin` sees/writes everything, `organiser_staff`
     scoped to their own organiser), plus RLS letting `platform_admin`
     look up any user by email. Used by `/dashboard` (Organisers/Shows
     sections) and `/dashboard/organisers/[organiserId]`.
   - `0004_booth_types_booths_and_floorplans.sql` — `booth_types`,
     `booths`, and `floorplan_versions` tables with RLS, plus a public
     `floorplans` Storage bucket (created via this migration) with an
     RLS-gated upload policy. Used by `/dashboard/shows/[showId]/*`.
   - `0005_booth_type_updates.sql` — adds the `booth_types` update policy
     `0004` was missing, so booth types can be edited after creation.
   - `0006_remove_booth_type_selection_fee.sql` — drops
     `booth_types.selection_fee`; a selection fee belongs to a future
     `ReleasePhase` instead, not the booth type itself.
   - `0007_add_ons_and_booth_type_deletion.sql` — `add_ons` table with
     RLS (show-level, optionally `mandatory`), plus a `booth_types` delete
     policy so organisers can remove booth types.
   - `0008_booth_groups_and_subvendors.sql` — `booth_groups` (islands) and
     `booth_group_subvendors` tables with RLS, a `booths.booth_group_id`
     column, and a public `vendor-logos` Storage bucket. Used by
     `/dashboard/shows/[showId]/islands`.
   - `0009_subvendor_self_signup.sql` — adds `booth_group_subvendors.user_id`,
     an RLS policy so a claimed subvendor can see their own row, and three
     `security definer` functions (`get_subvendor_invite_preview`,
     `claim_booth_group_subvendor`, `update_own_booth_group_subvendor`)
     plus a Storage policy for self-service logo uploads. Used by
     `/subvendor-invite/[subvendorId]`.
   - `0010_island_types_and_floorplan.sql` — `island_types` table with RLS
     (name, cost) and `booth_groups.island_type_id`/`map_x`/`map_y`, so an
     island can be typed, priced, and placed on the floorplan as its own
     pin. Used by `/dashboard/shows/[showId]/islands` and `.../floorplan`.
   - `0011_booth_type_cascade_deletion.sql` — changes `booths.booth_type_id`
     from blocking deletion to `on delete cascade`, so deleting a booth
     type also deletes the booths using it instead of failing.
   - `0012_release_phases.sql` — `release_phases`, `release_phase_booth_types`,
     `release_phase_island_types` tables with RLS, `booth_groups.status`,
     and public read-access `SELECT` policies on `shows`/`booth_types`/
     `booths`/`island_types`/`booth_groups`/`add_ons` (the first
     vendor-facing read access in the app). Used by
     `/dashboard/shows/[showId]/phases` and `/shows`.
   - `0013_applications_and_payments.sql` — `applications`,
     `application_booth_requests`, `payment_records` tables with RLS,
     `booths.application_id`/`booth_groups.application_id`, three
     `security definer` functions (`submit_application_assigned`,
     `submit_application_self_selected`, `submit_payment_proof`), a
     non-public `payment-proofs` Storage bucket, and an RLS policy letting
     organiser staff see their applicants' names. Used by `/shows/[showId]`,
     `/dashboard` (My Applications), and
     `/dashboard/shows/[showId]/applications`.
   - `0014_show_details_editing_and_logo.sql` — adds `shows.logo_path` and
     a public `show-logos` Storage bucket (the `shows` UPDATE policy for
     editing already existed since `0003`). Used by the new "Details" tab
     at `/dashboard/shows/[showId]/details`, and the logo is rendered
     across `/dashboard`, `/dashboard/organisers/[organiserId]`, every
     show-management tab, and `/shows`/`/shows/[showId]`.
   - `0015_organiser_controlled_allocation_mode.sql` — adds
     `release_phases.allocation_mode` (`organiser_allocated` |
     `immediate_selection`) and updates `submit_application_assigned`/
     `submit_application_self_selected` (from `0013`) to enforce it, so
     the organiser sets per phase whether applications are
     organiser-assigned or self-selected, instead of the applicant
     choosing freely. Used by `/dashboard/shows/[showId]/phases` (new
     field on the create/edit phase forms) and `/shows/[showId]` (the
     apply form now reflects the phase's setting instead of offering a
     choice).
   - `0016_public_read_floorplan_versions.sql` — adds a public
     `using (true)` `SELECT` policy on `floorplan_versions`, closing a
     gap `0012` left (every other show-setup table got one, this one was
     missed). Without it, `shows.active_floorplan_version_id` never
     resolves to an actual image for anyone who isn't organiser staff,
     so every vendor-facing floorplan render (`/shows/[showId]`, "My
     Applications") silently showed nothing.

### Dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see
"Connected to Supabase" with a timestamp, or a clear error describing what's
missing.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
