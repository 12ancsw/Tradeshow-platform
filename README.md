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
     `users` row on signup. Used by `/signup`, `/signup/role`, `/login`,
     and `/dashboard`.

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
