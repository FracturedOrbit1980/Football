# Football

Club platform (Next.js App Router). The product specification is in `PROMPT.md`. Architecture and coding rules for small models are in `AGENTS.md`.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests (dates, fees, roles)
npm run lint
npm run build   # static files in ./out
```

Open http://localhost:3000 and choose Developer, Club admin, Head coach, or Player. A developer sees every registered club and its balances; the other roles are scoped to the club that was open when they signed in. The official drill library is included. The imported players start on U12 Prem, and each one can be edited. Other age groups start empty. Club records are saved in this browser. Dates are shown as dd/mm/yyyy.

The hosted app is https://fracturedorbit1980.github.io/Football/

`npm run build` is a static export and does not need secrets. GitHub Pages sets `NEXT_PUBLIC_BASE_PATH=/Football` in `.github/workflows/pages.yml`, runs `npm test`, then publishes `out`. Supabase credentials stay optional; see `.env.example`.

## Supabase

`main` added the club schema in `supabase/migrations/20261003120000_initial_schema.sql` (tables, row level security, and a signup trigger). The screens in this branch do not call that database yet. They keep the club in the browser. Apply the migration when a server connection is wired up:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration does not insert auth users. Copy `.env.example` to `.env.local` only for that later connection.
