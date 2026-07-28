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
  (`createShow`, `updateShow`, `uploadShowLogo`), `booth-types.ts` (`createBoothType`, `updateBoothType`,
  `deleteBoothType`), `booths.ts` (`createBooth`, `updateBooth`,
  `updateBoothPosition`), `add-ons.ts` (`createAddOn`, `updateAddOn`,
  `deleteAddOn`), `floorplans.ts` (`uploadFloorplan`), `island-types.ts`
  (`createIslandType`, `updateIslandType`, `deleteIslandType`),
  `booth-groups.ts` (`createBoothGroup`, `updateBoothGroup`,
  `deleteBoothGroup`, `updateIslandPosition`, `setBoothGroup`),
  `subvendors.ts` (`createSubvendor`, `updateSubvendor`,
  `deleteSubvendor`), `subvendor-claims.ts` (`claimSubvendor`,
  `updateOwnSubvendor`), `release-phases.ts` (`createReleasePhase`,
  `updateReleasePhase`, `updateReleasePhaseStatus`, `deleteReleasePhase`,
  `attachBoothTypeToPhase`, `detachBoothTypeFromPhase`,
  `attachIslandTypeToPhase`, `detachIslandTypeFromPhase`),
  `applications.ts` (`applyAssigned`, `applySelfSelected`), `payments.ts`
  (`submitPaymentProof`), `allocation.ts` (`allocateBoothsToApplication`,
  `allocateIslandToApplication`, `verifyPayment`, `rejectApplication`).
- `src/components/` — shared UI: `status-badge.tsx`, `organiser-list.tsx`,
  `organiser-form.tsx`, `assign-staff-form.tsx`, `show-list.tsx`,
  `show-form.tsx`, `booth-type-list.tsx`, `booth-type-form.tsx`,
  `booth-list.tsx`, `booth-form.tsx`, `add-on-list.tsx`, `add-on-form.tsx`,
  `floorplan-upload-form.tsx`, `floorplan-tagger.tsx`, `show-tabs.tsx`,
  `island-type-list.tsx`, `island-type-form.tsx`, `booth-group-manager.tsx`,
  `booth-group-form.tsx`, `subvendor-list.tsx`, `subvendor-form.tsx`,
  `subvendor-invite-claim.tsx`, `release-phase-manager.tsx`,
  `release-phase-form.tsx`, `read-only-floorplan.tsx`, `apply-form.tsx`,
  `application-review.tsx`, `my-applications.tsx`, `payment-proof-form.tsx`,
  `show-edit-form.tsx`, `show-logo-upload-form.tsx`
  — used across `/dashboard`, `/dashboard/organisers/[organiserId]`,
  `/dashboard/shows/[showId]/*`, `/subvendor-invite/[subvendorId]`,
  `/shows`, and `/shows/[showId]`.
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
  `floorplan_versions` existed to reference), `logo_path` (nullable,
  `0014_show_details_editing_and_logo.sql`).
- **Editing a show and its logo** (`/dashboard/shows/[showId]/details`,
  the first tab, `show-edit-form.tsx`/`show-logo-upload-form.tsx`): the
  `shows` UPDATE RLS policy already permitted this since `0003` — only an
  edit form was missing (`updateShow` in `src/lib/actions/shows.ts`).
  The logo uses the same public-bucket-plus-`can_manage_show`-storage-policy
  pattern as `floorplans`/`vendor-logos` (bucket `show-logos`, path
  `{show_id}/{random}.{ext}`, replacing uploads a new file rather than
  overwriting). It's rendered everywhere a show is referenced today: the
  `ShowList` component (organiser's own shows on `/dashboard` and the
  admin's `/dashboard/organisers/[organiserId]` drill-down), the shared
  header in `/dashboard/shows/[showId]/layout.tsx` (visible across every
  show-management tab), and the vendor-facing `/shows` list and
  `/shows/[showId]` detail page. Attendee/VIP views don't exist yet, but
  `shows.logo_path` is there for them to read once they're built.
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
  added delete). Deleting a booth type deletes the booths that used it —
  `0011_booth_type_cascade_deletion.sql` changed `booths.booth_type_id`
  from blocking (the original `0007` behaviour) to `on delete cascade`,
  since organisers restructuring a show's booth types (e.g. removing an
  old `island`-category type now that islands are placed/priced as their
  own entity — see Booth Groups below) need to actually delete it, not be
  stuck behind its booths. The delete confirmation shows the affected
  booth count before it happens (`booth-type-list.tsx`, counted via a
  lightweight `booths` query on the Booth Types tab's page). No
  `selection_fee` field: per
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
  zoom in/out buttons (100–400%, since precisely placing several pins
  close together needs more control than native pinch-zoom alone gives),
  plus native pan via a scrollable container. Pins and click-to-place
  coordinates are computed against the zoomable inner surface's own
  bounding rect, not the scrollable outer container's, so placement stays
  accurate at any zoom level or scroll position. Tap-to-place always goes
  through an explicit "Place [ref] here? Confirm/Cancel" step rather than
  saving on tap, plus four nudge buttons (±0.5%) for fine adjustment
  before confirming. Pins are small (fixed-height, `overflow-hidden`,
  centered content) and currently always show the ref as text — that same
  container is what a vendor's logo will render into instead, once
  booths/islands can be assigned to a vendor (no `Application`/vendor-
  assignment relationship exists yet, so there's no logo data source to
  wire up today). The tagger takes a single unified `pins` prop (each
  tagged `kind: "booth" | "island"`) rather than a booths-only list: the
  Floorplan tab's page builds it from standard/corner booths *and*
  `booth_groups` (islands) together, and `confirmPlacement` dispatches to
  `updateBoothPosition` or `updateIslandPosition` based on `kind`. Islands
  stay at full pin size (few of them, need to stay legible/tappable);
  booths render at a third of that size (h-5 → ~6.67px) since there are
  usually many more of them and they'd otherwise clutter the floorplan —
  zoom in to place or reselect those precisely. The picker dropdown only
  lists unplaced pins, so it shrinks as tagging progresses instead of
  staying a full, ever-growing roster; repositioning an already-placed pin
  is done by tapping it directly on the floorplan, not through the
  dropdown. **Individual booths within an island no longer get their own
  floorplan pin** — per feedback ("island applicants will pay for
  island"), the island itself is the unit placed and priced (see Booth
  Groups below); its sub-slot booths still exist for the subvendor roster
  (`booth_group_subvendors.booth_id`), they just aren't independently
  tagged on the public-facing floorplan anymore.
- **Deliberate simplifications** vs. the architecture doc's fuller model
  (§2): no `island_layout_template` (a booth type of category `island`
  doesn't auto-generate sub-slots, you create booths one at a time same as
  any other category, then assign existing booths into a `booth_groups`
  row separately — see Booth Groups below for how much of the real
  `BoothGroup` model that does and doesn't cover), no release phases, no
  floorplan draft/publish reconciliation. All future work.

## Booth Groups (Islands) and Subvendors

`public.island_types`, `public.booth_groups`, and
`public.booth_group_subvendors` (`supabase/migrations/0008_booth_groups_and_subvendors.sql`,
`0010_island_types_and_floorplan.sql`) are a deliberately narrow slice of
the architecture doc's `BoothGroup` model (§2), surfaced on the
`/dashboard/shows/[showId]/islands` tab. What it's *for*: an island is
its own bookable unit — an "island applicant" pays for the whole island,
not its individual booths — so it needs a type/price and a floorplan
placement of its own, the same relationship a `booth_type` has to a
`booth`. The tab has two sections: **Island Types**
(`island-type-list.tsx`/`island-type-form.tsx`, full CRUD) manage the
price/category an island is booked at; **Islands**
(`booth-group-manager.tsx`) manage individual islands — their type,
their subvendor roster, and which booths belong to them. There's still
no `Application`/`PaymentRecord` flow to actually charge an applicant —
the price exists to "facilitate booking" once that flow is built, it
isn't charged today.

- **`island_types`** — `show_id`, `name`, `base_price`. No `category`
  field like `booth_types` has — an island type's *name* is the
  differentiator (e.g. "Premium Island" vs "Standard Island"), there's no
  fixed island/standard/corner-style enum to key behaviour off. Deleting
  an island type in use is blocked (no `on delete cascade` on
  `booth_groups.island_type_id`) with a friendly message — unlike booth
  types (see above), there's no explicit ask yet to cascade this one.
- **`booth_groups`** — `show_id`, `organiser_ref` (e.g. "Island A",
  unique per show), `island_type_id` (nullable FK — nullable only so
  islands created before this migration don't break; the create/edit
  forms require choosing one), `map_x`/`map_y` (nullable percentage
  coordinates, the island's own floorplan pin — see Floorplan tagging
  above). Editable/deletable in place, same pattern as booth types.
  Deleting a group cascades its subvendor roster
  (`booth_group_subvendors.booth_group_id on delete cascade`) but only
  unassigns its booths (`booths.booth_group_id on delete set null`) —
  real booth inventory is never deleted as a side effect, same reasoning
  as booth type deletion not cascading onto booths *used* to be (see
  above — that specific case now does cascade, islands deleting their
  booths doesn't).
- **`booths.booth_group_id`** (nullable FK, added by `0008`) — which
  island a booth belongs to, assigned as a separate step from booth
  creation on the Islands tab (`setBoothGroup` in
  `src/lib/actions/booth-groups.ts`, called directly from a client
  component like `updateBoothPosition`/`updateIslandPosition` rather than
  through a `<form>`). Only booths whose booth type is category `island`
  are offered for assignment; this isn't a DB-level constraint (no CHECK
  can reach across to `booth_types`), just what the UI offers. These
  sub-slot booths are a roster/subvendor-assignment concept only now —
  they don't get their own floorplan pin (see Floorplan tagging above).
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
- **Not `BoothGroupMembership`.** No primary-vs-sub vendor roles, no
  island-wide payment (yet — an island type's `base_price` is a step
  toward it, not the whole thing) — each subvendor entry stands alone.
  `passes_note` stays organiser-entered free text (e.g. "2x vendor
  passes"), not a real `PassType`/`PassAssignment` integration — that
  system doesn't exist yet and is intentionally out of scope for this
  iteration.
- **Storage**: a public-read `vendor-logos` bucket (same reasoning as
  `floorplans` — business logos aren't sensitive), objects at
  `{show_id}/{random}.{ext}`, RLS via `can_manage_show` on the first path
  segment (organiser uploads) or a claimed-subvendor check (self-service
  uploads — see below). Replacing a logo uploads a new file at a new path
  rather than overwriting (same pattern as floorplan re-uploads); the old
  file is simply orphaned rather than deleted.

## Subvendor Self-Signup

`supabase/migrations/0009_subvendor_self_signup.sql` lets a subvendor
claim their own `booth_group_subvendors` row and fill in their own
details, rather than that roster being organiser-entered only. This is
the first real instance of the "vendor role gets granted as part of a
flow, not at signup" behaviour `CLAUDE.md`'s Auth section describes —
claiming an invite self-grants the `vendor` role and a blank
`vendor_profiles` row, through the exact same self-serve RLS policy from
`0002_users_roles_and_vendor_profiles.sql` (`granted_by is null`), not a
new one.

- **`booth_group_subvendors.user_id`** (nullable FK to `public.users`,
  added by this migration) — null until claimed. No uniqueness
  constraint on it: the same person can be a subvendor at more than one
  island/show over time.
- **Invite link**: `/subvendor-invite/[subvendorId]` — a standalone route
  outside `/dashboard`, since the visitor isn't (yet, or ever) organiser
  staff. Each unclaimed row on the Islands tab (`subvendor-list.tsx`)
  shows this link as copyable text; once claimed it shows a "Claimed"
  badge instead. There's no email-sending, so getting the link to the
  actual subvendor is manual (copy/paste into an email, WhatsApp, etc.)
  — consistent with the rest of the app's Day-1-manual style.
- **Claim flow** (`src/lib/actions/subvendor-claims.ts`,
  `src/components/subvendor-invite-claim.tsx`): the invite page always
  shows a lightweight preview (business name, island/booth ref) via the
  `get_subvendor_invite_preview` RPC, then branches on session state —
  not logged in → links to `/signup`/`/login` (no redirect-back
  plumbing; the visitor re-opens the invite link after auth, a deliberate
  simplification); logged in and unclaimed → a "Claim this listing"
  button; logged in and already claimed by someone else → a dead-end
  message; logged in and it's *their* claimed row → a self-edit form
  (business name, contact info, notes, logo — never `booth_id`,
  `booth_group_id`, or `passes_note`, which stay organiser-only).
- **Why security-definer RPC functions instead of RLS policies**: a
  plain `for update using (user_id is null)` policy would let any
  authenticated visitor claim *and* rewrite organiser-controlled columns
  on *any* unclaimed row in the same statement, since RLS is row-level,
  not column-level. `claim_booth_group_subvendor(target_id)` and
  `update_own_booth_group_subvendor(target_id, ...)` hard-code exactly
  which columns each action can touch (same `security definer` pattern as
  `is_platform_admin()`/`can_manage_show()`). Similarly,
  `get_subvendor_invite_preview(target_id)` only ever returns the one row
  matching the exact id passed in and only non-sensitive display fields —
  safe to expose broadly (a visitor who hasn't claimed a row can't
  otherwise `SELECT` it) without becoming a way to browse every unclaimed
  subvendor row platform-wide.
- **Organiser access is unchanged.** `can_manage_show`-gated RLS still
  lets organiser staff read/write every subvendor row for their shows
  (0008), claimed or not — the new `user_id = auth.uid()` policy and the
  RPC functions are strictly additive, a second access path for the
  subvendor themselves.

## Release Phases and Applications

The first real vendor-facing flow: `public.release_phases`,
`public.applications`, and `public.payment_records`
(`supabase/migrations/0012_release_phases.sql`,
`0013_applications_and_payments.sql`) let a vendor apply for booths or an
island, and let organiser staff allocate and manually verify payment for
those applications. This is the architecture doc's §2/§6/§7 core booking
mechanic (`ReleasePhase`, `Application`, `PaymentRecord`), scoped down to
what was actually asked for:

- **Gating, not scheduling.** A `release_phase` is a manual
  `draft | open | closed` toggle organiser staff flip themselves
  (`/dashboard/shows/[showId]/phases`, `release-phase-manager.tsx`) — no
  `starts_at`/`ends_at` automation, since nothing in this app runs on a
  schedule. Only booth types / island types explicitly attached to an
  `open` phase (`release_phase_booth_types`, `release_phase_island_types`
  join tables) are applyable-to; a phase's `selection_fee_amount` is the
  per-booth fee charged only when a vendor self-selects (see below).
- **`release_phases.allocation_mode`** (`organiser_allocated` |
  `immediate_selection`, `0015_organiser_controlled_allocation_mode.sql`)
  — the organiser sets this per phase when creating/editing it (same
  form as name/selection fee), not the applicant: an
  `organiser_allocated` phase only accepts booth-type/quantity requests
  (organiser assigns specific booths later), an `immediate_selection`
  phase only accepts specific, currently live+available booths/an island
  the applicant picks themselves. Originally (`0012`/`0013`) this was a
  toggle on the apply form itself, letting a vendor pick either path on
  any open phase — organiser feedback was that the organiser should
  control this, not the applicant. Both vendor-facing RPC functions
  (`submit_application_assigned`, `submit_application_self_selected`)
  check the phase's `allocation_mode` and reject a call that doesn't
  match it. Changing a phase's `allocation_mode` later doesn't affect
  applications already submitted under it — `applications.is_self_selected`
  is recorded at submission time, never re-derived from the phase.
- **Public read access, for the first time.** Every table a vendor needs
  to browse a show (`shows`, `booth_types`, `booths`, `island_types`,
  `booth_groups`, `add_ons`) previously had organiser-only `SELECT`
  policies; `0012` adds unrestricted `using (true)` `SELECT` policies
  alongside them (Postgres ORs multiple permissive policies together, so
  this is additive, not a replacement). `release_phases` and its join
  tables instead expose only phases with `status = 'open'` — draft/closed
  phases stay organiser-only-visible. `0012` missed `floorplan_versions`
  in that list — `0016_public_read_floorplan_versions.sql` adds the same
  `using (true)` policy there. Until it did, `shows.active_floorplan_version_id`
  never resolved to an image for a non-organiser session (RLS silently
  returned nothing), so every vendor-facing floorplan render — the apply
  form and "My Applications" alike — showed nothing despite the booths/
  islands themselves being visible via the tables `0012` did cover.
- **`booth_groups.status`** (new column, same `booth_status` enum as
  `booths`) — an island is now a bookable unit with its own
  available/held/pending_payment/confirmed/blocked lifecycle, not just a
  roster container.
- **One choice per application, enforced server-side.** A vendor applies
  for *either* up to 6 booths *or* exactly 1 island, never both, within
  whichever assignment path the phase's `allocation_mode` allows: the
  organiser assigns specific booths/an island later (no fee), or the
  vendor self-selects specific, currently live+available ones themselves
  right now (`release_phases.selection_fee_amount` charged **per
  self-selected booth only — never for an island**, self-selected or
  not). "Live+available" means `status = 'available'` and placed on the
  floorplan (`map_x is not null`) — the same availability rule drives
  both the "N available" counts a vendor sees and what they're allowed
  to self-select.
- **Why `security definer` RPC functions, not table RLS, for the vendor's
  own writes**: applying touches several tables in one atomic step
  (create the application, create its booth-type requests or lock
  specific booths, create the payment record), and self-selection needs a
  compare-and-swap against a live availability check to avoid a race
  between two applicants picking the same booth. `submit_application_assigned`
  and `submit_application_self_selected` (both in `0013`) do all of this
  server-side in one transaction — if a self-selected booth/island was
  just taken by someone else, the whole function raises and every insert
  it already made rolls back. `submit_payment_proof` is narrower still:
  it only ever moves `payment_records.proof_path`/`status` and
  `applications.status` for the caller's own application, never
  `verified`/`verified_by`/`amount`. All three mirror the pattern
  `claim_booth_group_subvendor` established in `0009`.
- **`applications`** — `show_id`, `release_phase_id`, `applicant_user_id`,
  `is_self_selected`, `requested_island_type_id` (nullable), `status`
  (`submitted → allocated → payment_pending → confirmed`, plus
  `rejected`/`cancelled`). Self-selected applications start at
  `allocated` (their booths/island are already locked in by the RPC that
  created them); organiser-assigned ones start at `submitted` and need a
  human allocation step.
- **`application_booth_requests`** — `application_id`, `booth_type_id`,
  `quantity`; only populated for organiser-assigned applications (the
  *ask*, not the fulfilment — specific booths, once allocated, are
  recorded directly via `booths.application_id`).
- **`booths.application_id` / `booth_groups.application_id`** (nullable
  FKs, `on delete set null`) — which application currently holds a
  booth/island. Organiser allocation
  (`/dashboard/shows/[showId]/applications`, `application-review.tsx`,
  `src/lib/actions/allocation.ts`) sets these directly through the
  existing `can_manage_show`-gated `UPDATE` policies on `booths`/
  `booth_groups` — organiser writes are trusted and don't need the RPC
  narrowing vendor writes do.
- **`payment_records`** — `application_id` (`unique`, so 1:1),
  `amount` (computed server-side at apply time — booth/island type prices
  plus the per-booth selection fee if self-selected — never trusted from
  the client), `proof_path`, `status`
  (`awaiting_proof | proof_submitted | verified | rejected | waived`,
  `waived` included for a future fee-waiver flow that doesn't exist yet),
  `verified_by`/`verified_at`, `notes`. Verifying
  (`verifyPayment` in `allocation.ts`) flips the payment record, the
  application, and its held booths/island all to `confirmed` together.
  **Rejecting an application** (`rejectApplication`, same file) works at
  any stage — a still-`submitted` organiser-assigned application with
  nothing held yet (no-op release, just marks it `rejected`), an
  `allocated`/self-selected one still waiting on the vendor to submit
  proof, or one where proof was submitted and found wanting — since a
  `payment_records` row always exists from the moment an application is
  created, regardless of stage. Whatever booths/island were held get
  released back to `available` rather than left stranded on a rejected
  application. Surfaced as a "Reject application" action on both halves
  of the Applications tab's review screen (`application-review.tsx`):
  inline on each pending-allocation card, and on each card in "Awaiting
  Payment" (renamed from "Payment Verification Queue" — it now also lists
  allocated applications with no proof submitted yet, not just ones
  already awaiting verification, with "Verify" disabled until proof
  exists but "Reject" always available).
- **Storage**: a **non-public** `payment-proofs` bucket (unlike
  `floorplans`/`vendor-logos` — payment screenshots are sensitive),
  objects at `{show_id}/{application_id}/{random}.{ext}`. Since it's not
  public, viewing a proof means generating a signed URL server-side
  (`createSignedUrl`, 1-hour expiry) wherever it's rendered — the
  vendor's own "My Applications" list and the organiser's payment queue
  each do this themselves.
- **`public.users` gets one more read policy**: organiser staff can now
  see the name/email of anyone who has applied to a show they manage
  (`0013`, additive to `0002`'s self-only and `0003`'s platform_admin-only
  policies) — needed to show "who is this application from" on the
  allocation/verification screens.
- **Vendor routes** (`/shows`, `/shows/[showId]`) are the first
  vendor-facing UI in the app at all — everything built before this was
  organiser-side. `/shows/[showId]` shows a **read-only** floorplan
  (`read-only-floorplan.tsx` — no placement/edit handlers, pins colored by
  status instead of category, same explicit 100–400% zoom controls plus
  native pan as the organiser's tagger — several islands placed close
  together otherwise overlap at 100%) plus booth/island type pricing and
  live availability counts, then `apply-form.tsx` if logged in (sign up/log in
  prompt otherwise, same pattern as the subvendor invite page — no
  redirect-back after auth here either). Logged out, the floorplan
  renders once as a plain reference section above "Booth Types"; logged
  in, that section is skipped and `ApplyForm` renders its own copy
  instead, right alongside the application controls it's driven by.
  **Self-selection is a checklist of live+available booths/an island
  dropdown, not click-to-pick on the floorplan image itself** — the
  floorplan tagger's write/edit machinery is organiser-only tooling;
  building an equivalent click-to-select interaction for vendors was cut
  from this pass as a deliberate scope reduction. What *is* built:
  `ReadOnlyFloorplan` takes an optional `highlightedIds` set, and
  `ApplyForm` feeds it whatever's currently checked/selected in the
  checklist (recomputed via `useMemo` on every change) — so on an
  `immediate_selection` phase, ticking a booth or picking an island
  renders that pin larger and blue on the floorplan the applicant is
  already looking at, without making the tiny pins themselves tap
  targets. On an `organiser_allocated` phase the floorplan still shows
  (status-colored, for reference), just with nothing highlighted, since
  there's no specific booth being picked. The floorplan renders even
  when there's currently no open phase to apply under (`ApplyForm`'s
  "not currently accepting applications" state still shows it) — a
  vendor should be able to see where things are on the map regardless
  of whether they can act on it yet. Island pins on `ReadOnlyFloorplan`
  are smaller than the organiser tagger's (`h-4` vs `h-5`) — several
  islands placed close together were covering more of the floorplan than
  the islands themselves at 100% zoom; the zoom controls are how a
  vendor gets precision back instead.
- **"My Applications"** lives in the existing role-switcher
  (`home-content.tsx`, under the `vendor` context) rather than a separate
  route, listing each application's status, allocated booths/island
  (once known), amount due, payment instructions, and a proof-upload
  form (`payment-proof-form.tsx`) once `allocated`/`payment_pending`.
  Once a booth/island is allocated, the card also renders the show's
  floorplan (`ReadOnlyFloorplan`, same component and `highlightedIds`
  mechanism as the apply form) with the vendor's own booths/island
  highlighted, so they can see on the map what they actually got — this
  data is assembled in `/dashboard/page.tsx` (booth/island rows plus the
  active `floorplan_versions` image, scoped to every show the vendor has
  applied to) since `MyApplications` spans potentially multiple shows,
  unlike the single-show apply form.
- **Deliberate simplifications vs. the architecture doc**: no booth hold
  expiry/timeout (a `held` booth stays held until an organiser
  allocates/rejects or verifies — no background job exists to release
  it), no adjacency validation (self-selecting neighboring booths already
  achieves this — no separate "adjacency" concept needed), no fee
  waivers or refunds, no `VendorFieldPolicy`/consent, and applications
  can't be cancelled or edited by the vendor after submission (only
  proof upload is self-service).

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
  than as separate routes. Editing a show's details and uploading its
  logo is also done now (see Editing a show and its logo above,
  `0014_show_details_editing_and_logo.sql`) — organisers are still not
  editable after creation.
- **Booth types, booths, add-ons, and floorplan tagging** — done. See
  Booth Types, Booths, Add-ons, and Floorplans above: the
  `/dashboard/shows/[showId]/*` tab screens let
  `platform_admin`/`organiser_staff` define booth types (category,
  name, cost), add booths with unique per-show identifiers, define
  show-level add-ons (optionally `mandatory`), and upload/tag a floorplan
  image (tap-to-place with a confirm step and nudge controls). Booth
  types and add-ons are fully editable and deletable in place — deleting a
  booth type now also deletes the booths using it, with the count shown
  before confirming (see above); booths are editable but not (yet)
  individually deletable. Not yet done: deleting individual booths,
  release phases, floorplan draft/publish reconciliation, applications
  (including actually enforcing `mandatory` add-ons), payments, and any
  vendor/attendee-facing UI — the rest of the Organiser/Show/Booth/
  Application domain model from the architecture doc (§2).
- **Booth groups (islands) and subvendors** — done, as a deliberately
  narrow slice. See Booth Groups (Islands) and Subvendors above: the
  `/dashboard/shows/[showId]/islands` tab lets `platform_admin`/
  `organiser_staff` define island types (name, cost), create named
  islands tagged with a type, place each island as its own pin on the
  Floorplan tab, assign existing island-category booths into an island,
  and record each island's subvendors (business name, logo, contact info,
  notes, a free-text passes note) — a reference roster, not a booking
  mechanic yet. An island type's `base_price` exists to "facilitate
  booking," but there's still no `Application`/`PaymentRecord` flow to
  actually charge it. Not yet done: `island_layout_template`
  (auto-generating sub-slots), `BoothGroupMembership`/primary-vs-sub
  vendor roles, and a real `PassType`/`PassAssignment` system
  (`passes_note` stays free text until that's built).
- **Subvendor self-signup** — done. See Subvendor Self-Signup above: a
  subvendor can claim their own roster entry via an invite link
  (`/subvendor-invite/[subvendorId]`) and fill in their own business
  details, contact info, and logo, rather than that entry being
  organiser-entered only. Claiming self-grants the `vendor` role and a
  blank `vendor_profiles` row — the first real use of the self-serve role
  grant described in Auth above. Not yet done: redirect-back-to-invite
  after signup/login (the visitor re-opens the link manually today), and
  email delivery of the invite link itself (organiser copies/shares it
  manually).
- **Release phases and applications** — done, scoped as agreed (see
  Release Phases and Applications above). Organiser staff manually toggle
  a phase draft/open/closed and attach booth/island types to it; vendors
  browse `/shows`/`/shows/[showId]` (the first vendor-facing UI in the
  app), apply for up to 6 booths or 1 island under an open phase either
  organiser-assigned or self-selected (fee applies per self-selected
  booth, never for an island), upload payment proof from "My
  Applications" in `/dashboard`, and organiser staff allocate
  organiser-assigned applications plus verify/reject payment proofs from
  the show's Applications tab. Not yet done: booth hold expiry, fee
  waivers, refunds, cancelling/editing an application after submission,
  `VendorFieldPolicy`/consent, and any VIP/attendee ticketing (separate
  `PassType`/`PassAssignment` track).
- **Organiser-controlled allocation mode + floorplan selection
  highlighting** — done (`0015_organiser_controlled_allocation_mode.sql`).
  See `release_phases.allocation_mode` above: the organiser, not the
  applicant, now decides per phase whether applications are
  organiser-assigned or self-selected — the apply form's old "Organiser
  assigns" / "I'll pick my own" toggle is gone, replaced by a read-only
  banner reflecting the phase's setting. Also: the floorplan an applicant
  sees while self-selecting now highlights (enlarged, blue) whatever
  booths/island they currently have checked, via `ReadOnlyFloorplan`'s
  new `highlightedIds` prop, so they can see on the map where their picks
  actually are before submitting.
- **Reject an application at any stage** — done. Previously an organiser
  could only reject once a payment proof had been submitted
  (`rejectPayment`, only reachable from the payment queue); a
  still-`submitted` application awaiting allocation, or an `allocated`
  one where the vendor hadn't uploaded proof yet, had no reject path at
  all. `rejectPayment` is renamed `rejectApplication` (`allocation.ts`)
  and now works from either half of the Applications tab's review
  screen: a "Reject application" action on each pending-allocation card,
  and on each "Awaiting Payment" card (renamed from "Payment
  Verification Queue," which now also lists allocated-but-unpaid
  applications, not just ones with proof already submitted — "Verify" is
  disabled until proof exists, "Reject" isn't). No new migration —
  `applications.status`'s `rejected` value already existed from `0013`.

## Before Launch

- **Custom SMTP provider.** Supabase's built-in email service (signup
  confirmations, password resets) has a low rate limit meant for dev
  testing only — fine for now, but needs a real provider (Resend,
  Postmark, SendGrid, etc.) wired in via Authentication → Settings → SMTP
  Settings before onboarding real organisers/vendors, or signups will
  start failing with "email rate limit exceeded."
