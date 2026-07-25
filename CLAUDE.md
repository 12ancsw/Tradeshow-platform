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
`attendee`) is platform-wide. There's no `organisers` table yet (see
Progress Log) — `user_roles.organiser_id` is an unconstrained nullable
column for now, ready for that table once it's built.

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
  done: `platform_admin`/`organiser_staff` grant flow (schema and RLS
  already support it — see `user_roles.granted_by`/`organiser_id` — just
  no UI yet), the show application / ticket-purchase flow that will
  actually grant `vendor`/`attendee`, password reset, email verification
  UX beyond the generic "check your email" message, `VendorFieldPolicy`/
  `VendorFieldConsent`, and the entire Organiser/Show/Booth/Application
  domain model from the architecture doc (§2) — none of that exists yet.

## Before Launch

- **Custom SMTP provider.** Supabase's built-in email service (signup
  confirmations, password resets) has a low rate limit meant for dev
  testing only — fine for now, but needs a real provider (Resend,
  Postmark, SendGrid, etc.) wired in via Authentication → Settings → SMTP
  Settings before onboarding real organisers/vendors, or signups will
  start failing with "email rate limit exceeded."
