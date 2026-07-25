@AGENTS.md
@card-show-platform-architecture.md

# Tradeshow Platform

A card show vendor booking platform: organisers run trading card shows and
sell table/booth space to vendors; buyers browse and attend. Built
**mobile-first** — most vendors and attendees will use the product on a
phone, so design and test at small viewports first and progressively
enhance for larger screens.

See `card-show-platform-architecture.md` for the full architecture and
data model — it's the source of truth for anything not covered below,
including the not-yet-built Organiser/Show/Booth/Application domain model.
This file tracks what's actually implemented and where.

## Tenancy model

Multi-tenant. An `organiser_staff` role is scoped to one organiser via
`user_roles.organiser_id`; every other role (`platform_admin`, `vendor`,
`attendee`) is platform-wide. `public.organisers` (see
`supabase/migrations/0003_organisers_and_shows.sql`) is the tenant table
— `name`, `slug`, `status` (`pending` | `active` | `suspended`, defaults
to `active` since only `platform_admin` creates them and does so
deliberately). `public.shows` belongs to one organiser via `organiser_id`.

## Personas

Five roles drive the permission model and UI surfaces (see the
architecture doc's "Persona → Module Mapping"):

1. **Platform Admin** (`platform_admin`) — operates the platform itself
   across all tenants (support, billing oversight, abuse handling). Never
   self-selected — granted by an existing admin.
2. **Organiser Staff** (`organiser_staff`) — belongs to one organiser
   (`user_roles.organiser_id`); creates and runs shows, manages vendor
   applications/bookings, verifies payments. Never self-selected — granted
   by an existing admin/organiser.
3. **Vendor** (`vendor`) — applies for and books tables/booths at shows,
   manages their own listing/profile (`vendor_profiles`). Self-serve, but
   *not* at account signup — see Auth below for where that role actually
   gets granted.
4. **Attendee** (`attendee`) — covers both VIP pass buyers and general
   attendees per the architecture doc (same `User`/ticketing
   infrastructure, differentiated by `PassType` tier once that exists).
   Self-serve, same caveat as vendor above.

A single account can hold more than one role at once (e.g. `vendor` AND
`attendee`) — see the role switcher on `/dashboard`.

## Payments (Day 1)

Manual payment verification only — **no Stripe or other payment processor
integration on Day 1**. Organisers confirm payments out-of-band (e.g. bank
transfer, cash, check) and mark bookings as paid themselves. Design booking
status/state to accommodate a "pending verification" step rather than
assuming an automated payment webhook will flip it.

## Stack

- Next.js (App Router, TypeScript, Tailwind CSS)
- Supabase (Postgres + auth), accessed via `@supabase/supabase-js`
- Deployed on Vercel; Supabase URL/anon key are supplied as Vercel
  environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — never hardcode them

## Project layout

- `src/app/` — App Router routes
- `src/lib/supabase/anon.ts` — plain anon-key client factory (used by the `/`
  connectivity test page)
- `src/lib/supabase/server.ts` — cookie-aware Supabase client for Server
  Components and Server Actions (auth-aware, reads the session cookie)
- `src/lib/supabase/middleware.ts` + `src/proxy.ts` — refreshes the auth
  session cookie on every request. Note: this Next.js version renamed the
  `middleware.ts` convention to `proxy.ts` (see AGENTS.md) — don't
  reintroduce a `middleware.ts` file, it won't run.
- `src/lib/auth.ts` — `getCurrentUserWithRoles()` helper (session user,
  `users.name`, and every `user_roles` row), used by `/dashboard`.
- `src/lib/actions/` — Server Actions shared across routes:
  `organisers.ts` (`createOrganiser`, `assignOrganiserStaff`), `shows.ts`
  (`createShow`), `booth-types.ts` (`createBoothType`, `updateBoothType`,
  `deleteBoothType`), `booths.ts` (`createBooth`, `updateBooth`,
  `updateBoothPosition`), `add-ons.ts` (`createAddOn`, `updateAddOn`,
  `deleteAddOn`), `floorplans.ts` (`uploadFloorplan`), `booth-groups.ts`
  (`createBoothGroup`, `updateBoothGroup`, `deleteBoothGroup`,
  `setBoothGroup`), `subvendors.ts` (`createSubvendor`, `updateSubvendor`,
  `deleteSubvendor`).
- `src/components/` — shared UI: `status-badge.tsx`, `organiser-list.tsx`,
  `organiser-form.tsx`, `assign-staff-form.tsx`, `show-list.tsx`,
  `show-form.tsx`, `booth-type-list.tsx`, `booth-type-form.tsx`,
  `booth-list.tsx`, `booth-form.tsx`, `add-on-list.tsx`, `add-on-form.tsx`,
  `floorplan-upload-form.tsx`, `floorplan-tagger.tsx`, `show-tabs.tsx`,
  `booth-group-manager.tsx`, `booth-group-form.tsx`, `subvendor-list.tsx`,
  `subvendor-form.tsx` — used across `/dashboard`,
  `/dashboard/organisers/[organiserId]`, and `/dashboard/shows/[showId]/*`.
- `supabase/migrations/` — hand-applied SQL migrations (run in the
  Supabase SQL editor, or via the Supabase CLI once one is wired up)

## Auth

Supabase Auth, email/password only for now. **One signup/login for
everyone** (architecture doc §3) — there's no per-persona account type,
just a `users` row (name/email/phone, one per auth user, auto-populated by
a DB trigger reading signup `user_metadata`) plus zero or more
`user_roles` rows determining what the account can do.

- `public.users` (`supabase/migrations/0002_users_roles_and_vendor_profiles.sql`)
  — `id` (= `auth.users.id`), `email`, `name`, `phone`, `created_at`.
- `public.user_roles` — `user_id`, `role` (`platform_admin` |
  `organiser_staff` | `vendor` | `attendee`), `organiser_id` (nullable,
  organiser_staff only), `granted_by`/`granted_at`. RLS only allows a user
  to self-insert `vendor`/`attendee` rows with `granted_by = null` —
  `platform_admin`/`organiser_staff` require a grant flow that isn't
  built yet (see Progress Log), and RLS blocks self-granting either from
  the client.
- `public.vendor_profiles` — `user_id`, `business_name`, `tax_id`,
  `mailing_address`. Created (blank) alongside the `vendor` role at
  signup.
- RLS on all three: users can read/update only their own row(s); nothing
  is publicly readable by default.

**Signup is account creation only — no role choice.** `/signup` collects
email, password, name; calls `supabase.auth.signUp` (built-in Supabase
signup, no hand-rolled password handling) with `name` in `user_metadata`;
the DB trigger creates the `users` row; redirects straight to `/dashboard`.
This is a deliberate divergence from the architecture doc §3 text, which
describes picking "I'm a vendor" / "I'm attending as a guest" at signup
time — instead, vendor/attendee `user_roles` rows get granted later, as
part of whatever show/event flow actually needs that role (e.g. applying
to a show grants `vendor`, getting a ticket grants `attendee`). Neither of
those flows exists yet (no `organisers`/`shows` tables — see Tenancy model
above), so today an account can sit at zero roles indefinitely; `/dashboard`
handles that state (see below). The RLS policy that lets a user self-grant
`vendor`/`attendee` (`granted_by is null`) is unchanged and still applies
whenever that future flow inserts the row — it isn't signup-specific.

`/login` — email/password. `/dashboard` — redirects to `/login` with no
session; otherwise shows "Logged in as [name]" and, once the account holds
at least one role, ", role: [role]" plus a role switcher
(`src/app/dashboard/home-content.tsx`, a client component) when the
account holds more than one — active role is local component state only,
not persisted anywhere yet (per architecture doc §3, this is enough for
now; whichever context is "active" will eventually drive the bottom
nav/home screen once those exist). Zero roles is a normal, expected state
right now, not an error — it just means "hasn't applied to a show or
gotten a ticket yet."

## Organisers and Shows

`public.organisers` and `public.shows` (`supabase/migrations/0003_organisers_and_shows.sql`)
back the Platform Admin and Organiser consoles, both of which live inside
`/dashboard` rather than as separate routes — the role switcher (see Auth
above) picks which console's content renders, per the architecture doc's
"whichever context is active determines what the home screen shows."

- **`organisers`** — `name`, `slug` (auto-generated from `name`), `status`.
- **`shows`** — `organiser_id`, `name`, `start_date`/`end_date` (`end_date
  >= start_date` enforced by a check constraint), `venue_name`,
  `payment_instructions` (free text), `active_floorplan_version_id`
  (nullable, FK added in `0004_booth_types_booths_and_floorplans.sql` once
  `floorplan_versions` existed to reference).
- **RLS**: `public.is_platform_admin()` and `public.is_organiser_staff_for(organiser_id)`
  are `security definer` helper functions (avoid recursive RLS lookups
  against `user_roles`, same pattern as the removed `is_platform_admin()`
  from an earlier iteration of this schema — recreated here against
  `user_roles` instead of the removed `profiles` table). `platform_admin`
  can read/write every row on both tables; `organiser_staff` can read/write
  only rows where `organiser_id` matches a `user_roles` row they hold.
  Only `platform_admin` can create organisers; both `platform_admin` and
  `organiser_staff` (for their own organiser) can create shows.
- **Granting `organiser_staff`**: the *only* path — no self-serve, ever.
  `platform_admin`, from an organiser's detail page
  (`/dashboard/organisers/[organiserId]`), enters an existing user's email;
  `assignOrganiserStaff` looks them up in `public.users` (a new RLS policy
  lets `platform_admin` read every `users`/`user_roles` row, beyond the
  self-only policies from `0002_users_roles_and_vendor_profiles.sql`) and
  inserts a `user_roles` row with `granted_by` set to the granting admin.
- **`/dashboard` as `platform_admin`**: an "Organisers" section — list of
  every organiser (linking to its detail page) plus a "Create Organiser"
  form (name only; slug and `active` status are automatic).
- **`/dashboard/organisers/[organiserId]`**: platform-admin-only detail
  page for one organiser — its shows, a "Create Show" form, and the
  "Assign Organiser Staff" form. Superuser access: any organiser, not just
  ones the admin also staffs.
- **`/dashboard` as `organiser_staff`**: a "Shows" section scoped to
  whichever organiser that specific role grant is for (the role switcher
  already keys each context by `role:organiser_id`, so holding
  `organiser_staff` for multiple organisers "just works" — switching
  shows each one's shows separately) — list of shows plus a "Create Show"
  form. No organiser-detail editing or staff-assignment here; that's
  admin-only.

## Booth Types, Booths, Add-ons, and Floorplans

`public.booth_types`, `public.booths`, `public.add_ons`, and
`public.floorplan_versions` (`supabase/migrations/0004_booth_types_booths_and_floorplans.sql`
onward) let `platform_admin`/`organiser_staff` set up a show's booth
inventory. They live across four separate per-show tab screens rather
than one long page — `/dashboard/shows/[showId]/booth-types` (booth types
+ add-ons together, since add-ons are the other thing an organiser
configures once per show before opening bookings), `/dashboard/shows/[showId]/booths`,
`/dashboard/shows/[showId]/floorplan`, and `/dashboard/shows/[showId]/islands`
(see Booth Groups (Islands) and Subvendors below) — sharing a layout
(`src/app/dashboard/shows/[showId]/layout.tsx`) that fetches the show
once, renders the show name/dates header, and renders `ShowTabs`
(`src/components/show-tabs.tsx`, a client component using `usePathname()`
to highlight the active tab) as a horizontal scrollable tab strip — a
mobile-friendly "menu" rather than a sidebar, matching the rest of the
app's no-desktop-chrome constraint. `/dashboard/shows/[showId]` itself is
now just a redirect to the `booth-types` tab, so every existing link into
the show detail page (`ShowList`, etc.) keeps working unchanged. Each tab
is its own Server Component fetching only the data it renders; because
some data feeds more than one tab (a booth's `booth_type_id` drives both
its label on the Booths tab and its pin category on the Floorplan tab), the
relevant Server Actions (`src/lib/actions/booth-types.ts`, `booths.ts`)
call `revalidatePath` for every tab whose data they can affect, not just
the tab the mutating form lives on.

- **`booth_types`** — `show_id`, `name`, `category` (`island` | `standard`
  | `corner`), `base_price`. Editable and deletable in place (tap "Edit"
  or "Delete" on a booth type's list row — `0005_booth_type_updates.sql`
  added the update policy `0004` was missing, `0007_add_ons_and_booth_type_deletion.sql`
  added delete). Deleting a booth type with booths still assigned to it
  fails with a clear message instead of orphaning/cascading — `booths.booth_type_id`
  deliberately has no `on delete cascade`. No `selection_fee` field: per
  the architecture doc, that belongs to a future `ReleasePhase` (only
  charged under `allocation_mode = immediate_selection`, set by the
  organiser when they release booths into that phase), not the booth type
  itself — `0006_remove_booth_type_selection_fee.sql` removed an earlier,
  incorrect `selection_fee` column here.
- **`add_ons`** — `show_id`, `name`, `price`, `mandatory` (boolean).
  Show-level per the architecture doc (`Show` → `AddOn` 1:many), not
  booth-type-scoped. `mandatory` marks an add-on the organiser requires on
  every application for the show, rather than one a vendor opts into —
  there's no `Application` flow yet to actually enforce that against, so
  today `mandatory` is just data a future application flow will read.
  Full CRUD (create/edit/delete), same inline patterns as booth types.
- **`booths`** — `show_id`, `booth_type_id`, `organiser_ref` (the
  organiser-defined unique identifier, e.g. "A1" — unique per show),
  `status` (defaults `available`, matches the architecture doc's enum; no
  booking flow transitions it automatically, but it's editable in place —
  e.g. to manually `block` a booth behind a pillar), `map_x`/`map_y`
  (nullable percentage coordinates, set by the floorplan tagger below).
  Booth type and `organiser_ref` are also editable in place, same
  tap-"Edit" pattern as booth types. The Booths tab (`booth-list.tsx`)
  renders booths as a grid of cards rather than a stacked list, and groups
  them by `booth_type_id`: standard/corner booths each get their own card
  directly in the grid, while every booth sharing an `island`-category
  booth type collapses behind a single expandable "Island" card showing a
  booth count, which expands to reveal those booths as their own cards
  underneath (indented with a left border). This is a UI grouping only —
  there's no real parent/child relationship in the data (no `BoothGroup`,
  see Deliberate simplifications below), so "sub booths within an island"
  today just means "booths whose booth type happens to be category
  `island`." Tapping a card to edit it expands that card to the grid's
  full width (`col-span-full`) so the edit form isn't squeezed into a
  grid cell.
- **`floorplan_versions`** — `show_id`, `image_path` (a path inside the
  `floorplans` Storage bucket, not a full URL), `uploaded_by`,
  `uploaded_at`. Every upload inserts a new row and repoints
  `shows.active_floorplan_version_id` at it — "latest upload wins," no
  draft/active/archived reconciliation workflow (architecture doc §5) yet.
- **Storage**: a public-read `floorplans` bucket (venue map images aren't
  sensitive, so the public URL works directly — no signed URLs). Objects
  are stored at `{show_id}/{random}.{ext}`; a `storage.objects` INSERT
  policy checks `(storage.foldername(name))[1]` against the same
  can-manage-this-show rule as everything else.
- **RLS**: a new `public.can_manage_show(show_id)` helper (same
  `security definer` pattern as `is_platform_admin()`/
  `is_organiser_staff_for()`) — `platform_admin` or `organiser_staff` for
  that show's organiser can read/write. Reused for the storage policy too.
- **Floorplan tagging** (`src/components/floorplan-tagger.tsx`): explicit
  zoom in/out buttons (100–400%, since precisely placing several booths
  close together within an island's footprint needs more control than
  native pinch-zoom alone gives), plus native pan via a scrollable
  container. Booth pins and click-to-place coordinates are computed
  against the zoomable inner surface's own bounding rect, not the
  scrollable outer container's, so placement stays accurate at any zoom
  level or scroll position. Tap-to-place always goes through an explicit
  "Place [booth] here? Confirm/Cancel" step rather than saving on tap,
  plus four nudge buttons (±0.5%) for fine adjustment before confirming.
  Pins are small (fixed-height, `overflow-hidden`, centered content) and
  currently always show the booth ref as text — that same container is
  what a vendor's logo will render into instead, once booths can be
  assigned to a vendor (no `Application`/vendor-assignment relationship
  exists yet, so there's no logo data source to wire up today). Pin size
  is per booth-type `category`: `island` pins stay full size (fewer of
  them, sub-slots sit close together and need to stay legible/tappable);
  `standard`/`corner` pins render at a third of that size (h-5 → ~6.67px)
  since there are usually many more of them and they'd otherwise clutter
  the floorplan — zoom in to place or reselect those precisely. The
  booth-picker dropdown only lists unplaced booths, so it shrinks as
  tagging progresses instead of staying a full, ever-growing show roster;
  repositioning an already-placed booth is done by tapping its pin
  directly on the floorplan, not through the dropdown.
- **Deliberate simplifications** vs. the architecture doc's fuller model
  (§2): no `island_layout_template` (a booth type of category `island`
  doesn't auto-generate sub-slots, you create booths one at a time same as
  any other category, then assign existing booths into a `booth_groups`
  row separately — see Booth Groups below for how much of the real
  `BoothGroup` model that does and doesn't cover), no release phases, no
  floorplan draft/publish reconciliation. All future work.

## Booth Groups (Islands) and Subvendors

`public.booth_groups` and `public.booth_group_subvendors`
(`supabase/migrations/0008_booth_groups_and_subvendors.sql`) are a
deliberately narrow slice of the architecture doc's `BoothGroup` model
(§2), surfaced on the `/dashboard/shows/[showId]/islands` tab
(`src/components/booth-group-manager.tsx`). What it's *for*: letting an
organiser record, per island, who the subvendors sharing it are —
business details, a logo, and a free-text note on passes owed — as a
reference roster, not a booking mechanic. It's explicitly **not** wired
into pricing or applications: an island booth's price is still just its
booth type's `base_price` like any other booth, there's no
primary-vendor-pays-for-the-whole-island flow, and subvendor entries
aren't linked to a real vendor account.

- **`booth_groups`** — `show_id`, `organiser_ref` (e.g. "Island A",
  unique per show). Editable/deletable in place, same pattern as booth
  types. Deleting a group cascades its subvendor roster
  (`booth_group_subvendors.booth_group_id on delete cascade`) but only
  unassigns its booths (`booths.booth_group_id on delete set null`) —
  real booth inventory is never deleted as a side effect, same reasoning
  as booth type deletion not cascading onto booths.
- **`booths.booth_group_id`** (nullable FK, added by this migration) —
  which island a booth belongs to, assigned as a separate step from booth
  creation on the Islands tab (`setBoothGroup` in
  `src/lib/actions/booth-groups.ts`, called directly from a client
  component like `updateBoothPosition` rather than through a `<form>`).
  Only booths whose booth type is category `island` are offered for
  assignment; this isn't a DB-level constraint (no CHECK can reach across
  to `booth_types`), just what the UI offers.
- **`booth_group_subvendors`** — `show_id` (denormalized, same pattern as
  `booths.show_id`), `booth_group_id`, `booth_id` (nullable FK, which
  specific sub-slot this subvendor occupies — a partial unique index
  enforces at most one subvendor per booth), `business_name` (required),
  `contact_email`, `contact_phone`, `logo_path`, `notes`, `passes_note`
  (free text, e.g. "2x vendor passes" — not a real `PassType`/
  `PassAssignment` integration, since neither exists yet). Full CRUD
  (`src/lib/actions/subvendors.ts`, `src/components/subvendor-form.tsx`/
  `subvendor-list.tsx`), same inline edit/delete pattern as booth types
  and add-ons. Logo upload reuses the floorplan upload's pattern (upload
  to Storage first, then write the path) inside the same server action as
  the rest of the form fields, rather than a separate upload step.
- **No real vendor accounts involved.** Subvendor entries are organiser-
  entered free text, not linked to a `public.users` row — there's no
  `Application`/vendor-assignment flow yet for a real account to hang off
  of (same reasoning `add_ons.mandatory` isn't enforced against anything
  yet). Not `BoothGroupMembership`/primary-vs-sub vendor roles either.
- **Storage**: a public-read `vendor-logos` bucket (same reasoning as
  `floorplans` — business logos aren't sensitive), objects at
  `{show_id}/{random}.{ext}`, RLS via `can_manage_show` on the first path
  segment. Replacing a logo uploads a new file at a new path rather than
  overwriting (same pattern as floorplan re-uploads); the old file is
  simply orphaned rather than deleted.

## Notes

- The `/` route is currently a connectivity test page: it calls a
  `get_server_time` RPC (defined in
  `supabase/migrations/0001_get_server_time.sql`) and shows "Connected to
  Supabase" with the returned timestamp on success, or a clear error
  otherwise.

## Progress Log

- **Supabase connectivity** — done. `/` verifies the app can reach Supabase.
- **Auth & roles (users/user_roles/vendor_profiles)** — done. Replaces an
  earlier single-role `profiles` table (and the `organisers`/`shows`
  tables + `/admin`/`/organiser` consoles built on top of it) with the
  architecture doc's real shape: one `User` per person, many `UserRole`
  rows. See Auth above for `/signup`, `/login`, `/dashboard`.
- **Signup is role-agnostic** — done. Originally `/signup` was followed by
  a mandatory `/signup/role` step (matching the architecture doc's literal
  text); that step is removed. Signup now only creates the account;
  `vendor`/`attendee` roles get granted later, inside a future show
  application / ticket-purchase flow (not built yet). `/dashboard` handles
  the zero-role state gracefully instead of forcing a redirect. Not yet
  done: the show application / ticket-purchase flow that will actually
  grant `vendor`/`attendee`, password reset, email verification UX beyond
  the generic "check your email" message, `VendorFieldPolicy`/
  `VendorFieldConsent`.
- **Organisers, Shows, and the `organiser_staff` grant flow** — done. See
  Organisers and Shows above for the full picture: `organisers`/`shows`
  tables with RLS, `platform_admin`'s "Organisers" section and per-organiser
  detail page (create organisers, create shows anywhere, assign
  `organiser_staff` by email), and `organiser_staff`'s own "Shows" section
  in `/dashboard`, both surfaced through the existing role switcher rather
  than as separate routes. Not yet done: editing organisers/shows after
  creation.
- **Booth types, booths, add-ons, and floorplan tagging** — done. See
  Booth Types, Booths, Add-ons, and Floorplans above: the
  `/dashboard/shows/[showId]/*` tab screens let
  `platform_admin`/`organiser_staff` define booth types (category,
  name, cost), add booths with unique per-show identifiers, define
  show-level add-ons (optionally `mandatory`), and upload/tag a floorplan
  image (tap-to-place with a confirm step and nudge controls). Booth
  types and add-ons are fully editable and deletable in place; booths are
  editable but not (yet) deletable. Not yet done: deleting booths,
  release phases, floorplan draft/publish reconciliation, applications
  (including actually enforcing `mandatory` add-ons), payments, and any
  vendor/attendee-facing UI — the rest of the Organiser/Show/Booth/
  Application domain model from the architecture doc (§2).
- **Booth groups (islands) and subvendors** — done, as a deliberately
  narrow slice. See Booth Groups (Islands) and Subvendors above: the
  `/dashboard/shows/[showId]/islands` tab lets `platform_admin`/
  `organiser_staff` create named islands, assign existing island-category
  booths into them, and record each island's subvendors (business name,
  logo, contact info, notes, a free-text passes note) — a reference
  roster, not a booking mechanic. Not wired into pricing, applications,
  or any real vendor account. Not yet done: `island_layout_template`
  (auto-generating sub-slots), `BoothGroupMembership`/primary-vs-sub
  vendor roles, a real `PassType`/`PassAssignment` system, and linking
  subvendor entries to actual vendor accounts once an Application flow
  exists.

## Before Launch

- **Custom SMTP provider.** Supabase's built-in email service (signup
  confirmations, password resets) has a low rate limit meant for dev
  testing only — fine for now, but needs a real provider (Resend,
  Postmark, SendGrid, etc.) wired in via Authentication → Settings → SMTP
  Settings before onboarding real organisers/vendors, or signups will
  start failing with "email rate limit exceeded."
