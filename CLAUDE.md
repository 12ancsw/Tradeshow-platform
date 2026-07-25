@AGENTS.md

# Tradeshow Platform

A card show vendor booking platform: organisers run trading card shows and
sell table/booth space to vendors; buyers browse and attend. Built
**mobile-first** — most vendors and attendees will use the product on a
phone, so design and test at small viewports first and progressively
enhance for larger screens.

## Tenancy model

Multi-tenant. Each tenant is (at minimum) an organiser running one or more
shows. Data, access, and branding should be scoped per tenant — do not
assume a single global instance when designing schema, queries, or routes.

## Personas

Five roles drive the permission model and UI surfaces:

1. **Platform Admin** — operates the platform itself across all tenants
   (support, billing oversight, abuse handling).
2. **Organiser** — owns a tenant; creates and runs shows, manages vendor
   applications/bookings, verifies payments.
3. **Vendor** — applies for and books tables/booths at shows, manages their
   own listing/profile.
4. **VIP buyer** — attendee with elevated access (e.g. early entry,
   reserved perks) tied to a show.
5. **General attendee** — regular show visitor; browsing/ticketing only.

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
- `supabase/migrations/` — hand-applied SQL migrations (run in the Supabase
  SQL editor, or via the Supabase CLI once one is wired up)

## Auth

Supabase Auth, email/password only for now. `public.profiles` (see
`supabase/migrations/0002_profiles.sql`) holds one row per auth user with a
`role` enum (`vendor` | `organiser` | `platform_admin`), auto-populated by a
DB trigger on `auth.users` insert from the `role` passed in signup
`user_metadata`. `platform_admin` is never selectable at signup — it's set
manually (e.g. a SQL update) by whoever operates the platform.

- `/signup` — email/password + Vendor-or-Organiser role choice
- `/login` — email/password
- `/dashboard` — placeholder post-login landing page; redirects to `/login`
  if there's no session

## Notes

- The `/` route is currently a connectivity test page: it calls a
  `get_server_time` RPC (defined in
  `supabase/migrations/0001_get_server_time.sql`) and shows "Connected to
  Supabase" with the returned timestamp on success, or a clear error
  otherwise.

## Progress Log

- **Supabase connectivity** — done. `/` verifies the app can reach Supabase.
- **Auth (email/password + role)** — done. Signup/login/dashboard above,
  backed by `profiles` table + RLS + auto-create trigger. Not yet done:
  password reset, email verification UX beyond the generic "check your
  email" message, and any role-gated routes/UI beyond the dashboard's
  plain-text role display.
