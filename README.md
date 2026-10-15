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

## Privacy (POPIA), offline and sync

### Privacy notice
- `/privacy/` (or `/privacy/?club=<club id>`) shows a POPIA notice built from the club's settings (Club home → Privacy notice). **This is a template. Have the club's lawyer review it before relying on it.**
- The club is the responsible party. Admins fill in the information officer, address, hosting region and retention period. Supabase is listed as an operator.
- Registration stores the policy version and the time of consent (`consents`, `guardians.consent_version`). Portal users acknowledge the notice, download their data as JSON and send access, correction or deletion requests (`data_requests`), which admins can see and close.
- When the notice text changes, bump `PRIVACY_POLICY_VERSION` in `src/lib/privacy.ts` and the default in `club_privacy.policy_version`.

### Offline
`npm run build` runs `scripts/build-sw.mjs`, which writes `out/sw.js` with every exported page and `_next/static` asset to precache. It registers under the base path scope (`/Football/`).
- Pages use the network first and fall back to the cache.
- Static assets are served from the cache first.
- Supabase requests are never cached.

The drill library, editor and live match keep working with no connection.

### Sync (club mode only; demo mode stays on the device)
- Drills you create and saved matches are written locally, queued in IndexedDB (`football-sync`) and pushed to `club_drills` / `club_matches` when online. Each record holds formation, minutes, substitutions, events and score. Built-in library drills are not synced.
- **Conflicts: last write wins on `updated_at`.** A database trigger ignores an update older than the stored row, and the device keeps whichever copy has the newer `updated_at`. If two devices edit the same record offline, the later edit replaces the earlier one completely; there is no field-level merge. Deletes are soft (`deleted_at`) so they sync too.
- Club home → Sync has these controls:
  - Sync on/off.
  - Wi-Fi only. This works only where the browser reports the connection type (mostly Android Chrome). Elsewhere, automatic sync waits and you use "Sync now".
  - "Sync now".
- Signing out clears the sync queue and the club's local workspace from the device.
- Matches are not yet linked to a club team (local team ids are not club team ids), so every coach in the club can see them.

### Matches belong to club teams
Migration `20261015160000_match_team_scope.sql` scopes `club_matches` to real club teams:
- Coaches, team managers and fitness staff can read and write only the matches of teams they are assigned to (`team_staff`).
- Club admins see every match in their club, including **unassigned** ones.
- Players and guardians can read (but not edit) matches their player took part in (`player_ids`).
- Other clubs are always denied.

Events, minutes and substitutions live in the match row (`detail`), so the same rules cover them.

On the device, the live match has a "Club team for this match" picker. It maps the local team to a club team and remembers the choice; a club team with the same name is picked automatically. Squad names are matched to club players to fill `player_ids`.

After the upgrade, every match on the device is sent once more so that it gets its team:
- Matches that can't be placed on one of your teams are **held** on the device (Club home → Sync → "Not synced") until you choose a team. Staff can't upload unassigned matches.
- Matches already uploaded with no team stay visible to club admins under "Unassigned matches", where admins can assign them. The staff member who uploaded such a match can also still see it and move it onto one of their own teams.
- If the server refuses a record (for example, you were removed from that team), it is marked **rejected** with the reason instead of blocking the queue. You can pick a team, try again, or keep it on the device only. Network errors are simply retried.
