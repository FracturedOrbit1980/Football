# Football

Club platform for Sportfica and other clubs (Next.js App Router, static export to GitHub Pages).
The original product specification is in `PROMPT.md`.

```bash
npm ci
npm run dev
```

The hosted app is https://fracturedorbit1980.github.io/Football/

## Two modes

| | Local demo | Club database (Supabase) |
| --- | --- | --- |
| When | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` not set | Both set at build time |
| Sign-in | Pick any role (clearly labelled demo) | Email sign-in link |
| Data | This browser only | Supabase Postgres, isolated per club by row level security |
| Use for real player data | **No** | Yes |

`npm run build` never needs secrets. Without them it builds the demo.

### Roles in club mode

| Role | Scope |
| --- | --- |
| Platform admin | Creates clubs and invites each club's first admin. Cannot read player, guardian, rating, or finance data. |
| Club admin | Everything in their own club: teams, staff, registration, finance, sponsors, branding. |
| Coach | Their own teams (one coach can hold many teams). Full create/update/delete of player ratings. |
| Team manager | Their teams' registration details, guardians, kit, subs, and statements. |
| Fitness / conditioning | Optional per team. Reads their teams' players. |
| Player / guardian | Only their own (or their child's) player portal. |

People join a club only by invitation to their email address. Player IDs (e.g. `SPF00001`) and
player-card references (e.g. `C2026-00001`) are generated per club and are unique within it.

**Security model.** GitHub Pages is static, so the browser talks to Supabase directly with the
public anon key. Row level security in Postgres is the security boundary; the route gates in
the app are only for a tidy UI. Never put the `service_role` key in the app or in GitHub
Pages secrets.

## Supabase setup

1. **Create a project** at https://supabase.com (free tier is fine). Pick a region close to
   your users (e.g. `eu-west` or `af-south` if offered) and note the database password.
2. **Run the migrations**, in order. Either:
   - CLI: `npx supabase init` (first time only, creates `supabase/config.toml`),
     `npx supabase link --project-ref YOUR_PROJECT_REF`, then `npx supabase db push`; or
   - Dashboard → SQL editor: paste and run each file in `supabase/migrations/` in filename order.
3. **Auth settings** (Dashboard → Authentication):
   - Email provider on (it is by default). Optionally turn off "Allow new users to sign up"
     once your admins exist; invited people still sign in by link.
   - URL configuration → Site URL `https://fracturedorbit1980.github.io/Football/` and add
     `https://fracturedorbit1980.github.io/Football/**` and `http://localhost:3000/**` to the
     redirect allow list.
   - The built-in email sender is rate-limited; configure SMTP for real use.
4. **Make yourself platform admin.** Open the app, sign in once with your email, then in the
   SQL editor run:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
   Then open **Platform** in the app, create a club, and give the club admin's email. They
   become club admin the next time they sign in with that address.
5. **GitHub Actions secrets.** Repository → Settings → Secrets and variables → Actions → New
   repository secret:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Project Settings → API → `anon` `public` key

   Then make this one change in `.github/workflows/pages.yml`, in the `npm run build` step's
   `env:` block (it is not in this branch because the push token lacked the `workflow` scope):
   ```yaml
         - run: npm run build
           env:
             NEXT_PUBLIC_BASE_PATH: /Football
             # Public values only. Leave the secrets unset to deploy the local demo mode.
             NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
             NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
   ```
   Commit it on `main` after merging, then re-run the "Deploy GitHub Pages" workflow.
6. **Local development against Supabase:** copy `.env.example` to `.env.local` and fill in the
   same two values.

### Storage

The migration creates two private buckets, `club-logos` (1 MB, PNG/JPEG/WebP) and
`club-backdrops` (3 MB). Files live under `<club_id>/…`; only that club's members can read
them and only its club admins can write. The app shows them through short-lived signed URLs.

## Database tests

`supabase/tests/rls_club_isolation.test.sql` is a pgTAP suite proving, among other things,
that one club cannot read or write another club's players, guardians, ratings, finance,
teams, members, or files; that a player (or guardian) sees only their own record; that
coaches have rating CRUD only for their own teams; and that the first-admin promotion works.

```bash
npx supabase start && npx supabase test db   # with the Supabase CLI and Docker
scripts/test-db.sh                           # or: plain PostgreSQL 15+ with pgTAP installed
```

`scripts/test-db.sh` creates a throwaway database, loads small stand-ins for Supabase's
`auth` and `storage` schemas (`supabase/tests/local/supabase_stub.sql`), applies the
migrations, and runs the tests.

## POPIA notes

- Registration records guardian consent (`guardians.consent_at`) and requires a guardian email
  and contact number.
- Guardian contact details are visible only to the club admin, the player's coach and team
  manager, and the family. Platform admins cannot read personal data.
- Deleting a player removes their guardians, ratings, finance lines, and kit records.
- The local demo is for trying the app only; do not enter real children's details there.
- The club still needs its own privacy notice, an information officer, and a Supabase data
  processing agreement; choose the project region with that in mind.

## Not yet in the database

The drill library, drill editor, and live match tracker still keep their working data on the
device, even in club mode.
