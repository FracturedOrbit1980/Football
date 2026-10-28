<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Football (Clubstride)

Static Next.js app for one football club on a phone. Data lives in this browser (Zustand + localStorage). Supabase is optional and unused by the screens. Do not remove features.

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest, node, src/**/*.test.ts
npm run lint
npm run build    # writes ./out . Needs no secrets.
```

GitHub Pages (`.github/workflows/pages.yml`) runs `npm test` then `npm run build` with `NEXT_PUBLIC_BASE_PATH=/Football`. Keep `output: "export"` in `next.config.ts`. Do not add server actions, route handlers, or middleware that need a Node server. Use `<img>`, not `next/image`.

## Map

- `src/app/page.tsx` home. `src/app/admin/*` club admin. `src/app/coach/*` coach. `src/app/player/page.tsx` player.
- `src/components/layout/app-shell.tsx` header, sidebar, bottom nav.
- `src/components/club/club-start.tsx` load / register a club. `src/components/auth/role-session.tsx` demo sign-in (`localStorage` keys `bnfc-role`, `bnfc-role-club`).
- `src/stores/club-store.ts` players, fees, drills, attendance. `src/stores/club-library.ts` the list of clubs. `src/stores/match-store.ts` live clock.
- `src/lib/club/week.ts` dates. `src/lib/club/accounting.ts` money. `src/lib/club/library.ts` official drills. `src/lib/auth/roles.ts` roles.
- `src/app/globals.css` light/dark and club colour themes. Themes are `html[data-club-theme]`. Dark mode is `html.dark`.

Roles: `SUPER_ADMIN` club admin, `HEAD_COACH`, `PLAYER`, `DEVELOPER` (every club). Developer is not scoped to one club.

## Rules

- Mobile first, about 390px wide. Tap targets at least 44px (`min-h-11` / `h-11` / `size-11`).
- Dates shown to people are `dd/mm/yyyy`. Store `yyyy-mm-dd`. Use `formatDate`, `formatDay`, and `DateField`. Do not use `<input type="date">`.
- Destructive actions (delete, restore library, reset minutes, cancel an agreement, clear a frame) need a confirm step. Use `ConfirmBar` or a second press labelled "Confirm …".
- Keep light and dark readable. Slate utilities remap in `html.dark`. Do not put light text on `bg-emerald-50` / `bg-rose-100` without a dark override.
- One component, one job. Prefer a new small file over growing a 500-line component.
- Club records are per browser. Do not require `NEXT_PUBLIC_SUPABASE_URL` to build or run.
- After a UI change, click the flow on a narrow window: home, the role you touched, and dark mode.

## Tests

Add a `src/**/*.test.ts` next to pure logic you change (dates, fees, roles). Run `npm test` before `npm run build`.
