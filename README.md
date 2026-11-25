# Football

Club platform (Next.js App Router). The product specification is in `PROMPT.md`.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and choose Developer, Club admin, Head coach, or Player. A developer sees every registered club and its balances; the other roles are scoped to the club that was open when they signed in. The official drill library is included. The imported players start on U12 Prem, and each one can be edited. Other age groups start empty. Club records are saved in this browser.

The hosted app is https://fracturedorbit1980.github.io/Football/

## Integrated Ecosystem: Primary, Lite & Pro

Football is the primary club management platform. The ecosystem consists of:

1. **Football (Primary Club Platform)**: Hosted at [`https://fracturedorbit1980.github.io/Football/`](https://fracturedorbit1980.github.io/Football/)
   - Full club administrative management, role-based access (Super Admin, Head Coach, Player, Developer).
   - Club registry, age groups, player registration numbers, accounting & credit control, drill library.
2. **Clubstride Lite (Pitch-Side Offset Tool)**: Hosted at [`https://fracturedorbit1980.github.io/Football/lite/`](https://fracturedorbit1980.github.io/Football/lite/)
   - Focused, high-contrast pitch-side tactical console, stopwatch, one-tap substitution engine, and offline matchday tool.
   - Offset from the primary platform for immediate touchline utility.
3. **Clubstride Pro (Expanded Functionality)**: Hosted at [`https://fracturedorbit1980.github.io/Football/pro/`](https://fracturedorbit1980.github.io/Football/pro/)
   - Advanced coaching drill library, player developmental ratings and radars, attendance roll-call register, multi-coach collaboration, and cloud squad sync.

Both Lite and Pro live within the primary Football deployment and share data via same-origin storage and real-time messaging bridges.

This app is a static export, so `npm run build` does not need secrets. Supabase credentials stay optional; see `.env.example`.

## Supabase

`main` added the club schema in `supabase/migrations/20261003120000_initial_schema.sql` (tables, row level security, and a signup trigger). The screens in this branch do not call that database yet. They keep the club in the browser. Apply the migration when a server connection is wired up:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration does not insert auth users. Copy `.env.example` to `.env.local` only for that later connection.

## Coach handoff regression

The Chromium tests build and serve the production static export on loopback, then
click the squad/match launch controls. Fixtures contain only a fictional custom
club, players and coaches; external network requests and service workers are
blocked in each fresh browser context.

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run test:e2e
NEXT_PUBLIC_BASE_PATH=/Football npm run test:e2e
```

The matrix covers roster/match × Lite/Pro destinations and published squad
identity. The UI flow also creates a team, registers players, assigns/replaces a
coach, opens each tier, and checks the visible squad after reload. Pro controls
cover an unnamed local squad and rejection of an owned cloud squad without
membership. No live login or cloud service is used.

The checked-in Pro Expo HTML hardcodes `/Football/pro/` assets. Its rendered
squad tests therefore run under `/Football`; the empty-prefix run still tests
all four navigation destinations and the complete Lite journey. Those explicit
Pro skips are a separate packaging limitation, not a handoff pass.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed Chromium, and
`PLAYWRIGHT_PORT` can change the default loopback test port (4187). If a local
HTTP proxy is configured, exclude `127.0.0.1,localhost` via `NO_PROXY`/`no_proxy`.
The test server always starts from the current export and never reuses an
existing server. CI runs both deployment prefixes without publishing.
