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
  (`createShow`).
- `src/components/` — shared UI: `status-badge.tsx`, `organiser-list.tsx`,
  `organiser-form.tsx`, `assign-staff-form.tsx`, `show-list.tsx`,
  `show-form.tsx` — used by both `/dashboard` (as `platform_admin` or
  `organiser_staff`) and `/dashboard/organisers/[organiserId]`.
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
  (nullable, unconstrained — no `floorplan_versions` table exists yet).
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
  creation, floorplan upload (`active_floorplan_version_id` exists but
  nothing sets it), the rest of the Organiser/Show/Booth/Application
  domain model from the architecture doc (§2) — booth types, release
  phases, applications, payments — and any vendor/attendee-facing UI.

## Before Launch

- **Custom SMTP provider.** Supabase's built-in email service (signup
  confirmations, password resets) has a low rate limit meant for dev
  testing only — fine for now, but needs a real provider (Resend,
  Postmark, SendGrid, etc.) wired in via Authentication → Settings → SMTP
  Settings before onboarding real organisers/vendors, or signups will
  start failing with "email rate limit exceeded."
