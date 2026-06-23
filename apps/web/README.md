# @cmc/web

The CMC web app — React + Vite + TypeScript + Tailwind + TanStack Query, with
MapLibre GL JS for the campus map.

## Run it

```bash
# offline demo (no backend) — fastest way to see the app:
VITE_DEMO=midway pnpm --filter @cmc/web dev    # real Midway PCA campus
VITE_DEMO=1      pnpm --filter @cmc/web dev    # fictional sample campus

# against Supabase: set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env first
pnpm --filter @cmc/web dev
```

## Layout

```
src/
  App.tsx              routes + auth gate
  auth/                Supabase session + app-role (demo: fake admin)
  lib/
    supabase.ts        client + isDemo flag
    datasource.ts      DataSource interface + Supabase impl
    demo.ts            in-memory demo store (sample + Midway reseed)
    queries.ts         TanStack Query hooks (call the DataSource)
  components/          ui.tsx (Button/Field/Modal/…), Layout
  pages/               Dashboard, Map, Requests, WorkOrders, Assets, Vendors, …
  data/midwaypca.json  generated Midway dataset (scripts/gen-midway-demo.mjs)
public/facilities/     facility GeoJSON the map fetches at runtime
```

## Notes

- All data access goes through `lib/datasource.ts` — don't call `supabase`
  from pages.
- The map (`pages/MapView.tsx`) reads `public/facilities/<id>/*.geojson`. Refresh
  Midway data with `node scripts/gen-midway-demo.mjs` after editing
  `map-data/facilities/midwaypca/`.
- See the repo [`ARCHITECTURE.md`](../../ARCHITECTURE.md) and
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
