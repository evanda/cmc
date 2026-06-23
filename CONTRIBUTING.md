# Contributing

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the big picture. This file is the
day-to-day workflow.

## Prerequisites

- Node ≥ 20, **pnpm 9** (`packageManager` is pinned).
- (Optional) Docker + the Supabase CLI for the local backend stack.

```bash
pnpm install
```

## Everyday commands

```bash
pnpm verify                      # lint + typecheck + test across all workspaces
pnpm --filter @cmc/web dev       # run the web app (Vite) at http://localhost:5173
pnpm --filter @cmc/web build     # production build
pnpm --filter @cmc/shared test   # run shared unit tests (PM engine, conversions)
pnpm format                      # prettier --write
```

Turborepo caches task results; `pnpm verify` is the gate every change must pass
before a PR.

## Running without a backend (demo mode)

You don't need Supabase to see the UI:

```bash
VITE_DEMO=1 pnpm --filter @cmc/web dev        # fictional "Sample Campus"
VITE_DEMO=midway pnpm --filter @cmc/web dev   # the real Midway PCA campus
```

Demo mode fakes a signed-in admin and serves data from an in-memory store
(`apps/web/src/lib/demo.ts`). Gated by env, so it never affects production.

## Running with Supabase

1. `cp .env.example .env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   (plus `SUPABASE_SERVICE_ROLE_KEY` for seeding). **Never commit `.env`.**
2. Apply the schema: `pnpm db:reset` (needs the Supabase CLI + Docker), or push
   `supabase/migrations/` to a hosted project.
3. Load a sample facility: `pnpm db:seed <tiny|bigcampus>`.

### Migration hygiene

- Add changes as a **new** numbered file under `supabase/migrations/` — never
  edit an applied migration.
- Keep the schema aligned with plan §6; include RLS policy changes in the same
  migration.
- No-Docker check: apply the `auth` shim then the migrations against a local
  Postgres (see ARCHITECTURE → "Verifying migrations without Docker").

## Screenshots (headless, for async review)

```bash
VITE_DEMO=1 pnpm --filter @cmc/web build && pnpm screenshots
VITE_DEMO=midway pnpm --filter @cmc/web build && SHOT_SET=midway pnpm screenshots
```

Renders key screens to `screenshots/` with a bundled headless Chromium
(`scripts/screenshot.mjs`) — works on restricted networks (no browser-CDN
download). Maps render via SwiftShader WebGL. Output is gitignored.

## Branches & PRs

- Branch off `main`; keep PRs scoped to one concern.
- Every PR must be `pnpm verify`-green. If you changed the schema, confirm the
  migrations apply cleanly and say so in the PR.
- Conventional-ish commit subjects (`feat(web): …`, `fix(db): …`). The
  `.githooks/prepare-commit-msg` hook appends `Closes #N` when a subject
  references `(#N)`.
- Don't commit church-specific values into code — they belong in config/seed
  (plan §7.6).

## Adding a dependency

The plan (§12) names the intended stack. Prefer those; if you need something
not named, call it out in the PR description with a one-line rationale.
