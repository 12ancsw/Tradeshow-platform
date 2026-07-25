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
- `src/lib/supabase.ts` — Supabase client factory, reads env vars
- `supabase/migrations/` — hand-applied SQL migrations (run in the Supabase
  SQL editor, or via the Supabase CLI once one is wired up)

## Notes

- The `/` route is currently a connectivity test page: it calls a
  `get_server_time` RPC (defined in
  `supabase/migrations/0001_get_server_time.sql`) and shows "Connected to
  Supabase" with the returned timestamp on success, or a clear error
  otherwise.
