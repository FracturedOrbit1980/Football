# Clubstride CI artwork pack

- `clubstride-master/` holds logo **A**, the Clubstride master brand for the website, club portal and Clubstride Pro.
- `clubstride-lite/` holds logo **L1**, the Clubstride Lite app.
- Each folder has these files:
  - `*_lockup_*`: the symbol and wordmark together.
  - `*_symbol_*`: the symbol on its own.
  - `*_appicon_*`: app icons at 1024, 180 and 48 px.
  - `*_favicon_*`: favicons at 16 and 32 px.
  - Each logo comes in dark, light and mono versions, plus SVGs.
- `brand_board.png` shows the colours, fonts (Fredoka and Inter) and usage.
- `clubstride-tokens.css` holds the design tokens to drop into the repos.

## Where each file goes in the repos
- **GameOn (Clubstride Lite):**
  - `icon-1024.png`, `icon-512.png`, `icon-192.png` and `icon-180.png` come from `L1_appicon_*`.
  - The favicon comes from `L1_favicon_32`.
  - The header uses `L1_lockup_dark`.
  - The PDF footer uses `L1_lockup_light`.
- **Football (Clubstride):**
  - The `public/icons/*` files come from `A_appicon_*`.
  - The favicon comes from `A_favicon_32`.
  - The header uses `A_lockup_light` and `A_lockup_dark`.

The logos are still "recommended, not final", so swap them in here once you sign them off.
