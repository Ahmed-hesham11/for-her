# FOR HER

Storefront and admin dashboard for a women's fashion e-commerce brand, built with Next.js (App Router) and Supabase.

## Tech stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Database/storage:** Supabase (Postgres + Storage)
- **Auth:** Custom session-based auth (bcrypt password hashing with transparent legacy Argon2 migration, hashed session tokens stored in a `sessions` table — not Supabase Auth)
- **i18n:** Built-in English/Arabic locale switching with RTL support

## Requirements

- Node.js 20+
- A Supabase project (database + storage bucket for product/category images)

## Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project's values:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — server-only, never exposed to the browser |

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Database migrations live in `supabase/migrations/` and are applied manually in order through the Supabase SQL editor (no CLI migration step in this workflow).

## Production build

```bash
npm run build
npm run start
```

## Deployment notes

- Set the three environment variables above in the hosting platform's project settings — `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- Run any new files in `supabase/migrations/` against the production database before deploying code that depends on them.
- `middleware.ts` protects all `/admin/*` routes; confirm an admin-role profile exists before relying on it in production.
