# Deploy (production hosting)

How to put a CMC instance online: **`apps/web` on Vercel + the backend on hosted
Supabase**. Single-tenant per deployment — each church gets its own Supabase
project + its own Vercel project (plan §7.6). This is the repeatable "deploy for
a friend" checklist; [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) covers standing up
and seeding the database itself.

Architecture in one line: the web app is a static Vite SPA that talks directly to
Supabase (Postgres + Auth + Storage + RLS + Edge Functions). There is no custom
server to host — Vercel serves static files, Supabase is the backend.

---

## Hosting model

| Piece | Host | How it deploys |
|-------|------|----------------|
| `apps/web` (Vite SPA) | **Vercel** | Git integration — push to `main` auto-deploys |
| `supabase/` (DB, Auth, Storage, functions) | **Supabase** (managed) | `.github/workflows/deploy-backend.yml` (or `supabase db push` by hand) |
| `apps/mobile` (Expo) | Expo EAS | Phase 4 — not yet |

The current reference instance: **<https://cmc-web-sandy.vercel.app>** → Supabase
project `fynevwffzebqygoxajae`.

---

## 1. Web → Vercel (one-time, dashboard)

Vercel's Git integration can't be scripted (it's an OAuth connect), so this is a
manual one-time setup per instance. Project settings that matter for this monorepo:

| Setting | Value |
|---------|-------|
| Root Directory | **repo root** (leave blank) — *not* `apps/web` |
| Framework Preset | Other |
| Build Command | `pnpm --filter @cmc/web build` |
| Output Directory | `apps/web/dist` |
| Install Command | default (`pnpm install` at root) |

Most of this is pinned in [`vercel.json`](../vercel.json), so in practice you only
set the Root Directory + env vars in the dashboard and Vercel reads the rest.

> **Why repo root, not `apps/web`?** The web build runs `sync-map-data`
> (`node ../../scripts/sync-map-data.mjs`) and imports `packages/shared` as
> source — both reach *outside* `apps/web`. Rooting at the repo top keeps the
> whole workspace present at build time and avoids the (now-removed) Vercel
> "include files outside root directory" toggle.

`vercel.json` also adds the SPA rewrite (`/(.*)` → `/index.html`) so client routes
like `/map` and `/accept-invite` survive a hard refresh / deep link instead of 404ing.

### Environment variables (Vercel dashboard → Settings → Environment Variables)

| Var | Value | Notes |
|-----|-------|-------|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | client-exposed |
| `VITE_SUPABASE_ANON_KEY` | the project's **anon** key | public by design; RLS enforces access |

- Leave `VITE_DEMO` **unset** in production (it's the in-memory demo flag).
- **Never** add `SUPABASE_SERVICE_ROLE_KEY` (or a server `SUPABASE_URL`) to Vercel —
  those are CLI/seed-only and must never reach the browser bundle. (Vite only
  exposes `VITE_`-prefixed vars, but don't tempt it.)

There is no root `.env` on Vercel; Vite still picks up the `VITE_*` vars from the
build environment, so the dashboard values flow into `import.meta.env`.

---

## 2. Backend → Supabase (automated via GitHub Actions)

The database schema, Edge Functions, and Auth config deploy through
[`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml).

**Required repo Actions secrets** (Settings → Secrets and variables → Actions):

| Secret | Where to get it |
|--------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database (reset it if you don't have the original — safe; the app uses the anon/service keys, not this password) |

`SUPABASE_PROJECT_REF` is set in the workflow `env:` (currently
`fynevwffzebqygoxajae`); change it when forking for another church.

**How it runs:**
- **On push to `main`** touching `supabase/migrations/**` or `supabase/functions/**`
  → `supabase db push` + `supabase functions deploy invite-user`. (No auth config.)
- **Manual** (Actions → "Deploy backend (Supabase)" → Run workflow) → same, plus
  it can set the Auth Site URL + `SITE_URL` function secret from the `app_url`
  input (default = the reference URL; blank to skip).

CI (`ci.yml`) only *validates* migrations against a throwaway Postgres — it never
touches the hosted DB. This workflow is the only thing that applies them.

To deploy by hand instead: `pnpm dlx supabase link --project-ref <ref>` then
`supabase db push` (see `SUPABASE_SETUP.md`).

---

## 3. Auth URL config (do this once the Vercel URL exists)

Until Supabase knows the app's origin, login redirects and invite emails point at
the wrong place (default `localhost:3000`). Two things must reference the prod URL:

1. **Auth → URL Configuration** — Site URL = the Vercel URL; Redirect allow-list
   includes `<vercel-url>/**`, `http://localhost:5173/**`, `http://127.0.0.1:5173/**`.
2. **`SITE_URL` Edge Function secret** — `invite-user` reads it to build the
   `/accept-invite` redirect (`supabase secrets set SITE_URL=<vercel-url>`).

Both are done automatically by a **manual** run of the deploy-backend workflow
(set `app_url`), or by hand in the dashboard. This closes issue #39's config gap;
the app-side `/accept-invite` page already shipped in #42.

---

## 4. Seed + first-run

After the schema is live, load the church's data and create the first admin —
see [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) (`pnpm db:seed <facility>`, service-role
env) and the first-run setup wizard (issue #14, in progress).

---

## Smoke test

- Prod URL loads, you can **log in** (real Supabase, not demo).
- Hard-refresh `/map` — no 404 (SPA rewrite working).
- An admin **invite** email links to `<prod>/accept-invite` and the invitee can
  set a password (needs §3 done).
- **Forgot password** from the login page emails a reset link to
  `<prod>/account/update-password`, and following it lets you set a new password
  (covered by the `<vercel-url>/**` allow-list entry in §3).
- The deployed JS bundle contains the **anon** key only — `grep` it for
  `service_role` and find nothing.

## New-instance checklist (TL;DR)

1. Create a Supabase project → `supabase link` → `supabase db push` → seed.
2. Create a Vercel project on the repo: Root Directory = repo root; add the two
   `VITE_SUPABASE_*` env vars.
3. Add `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` repo secrets; set
   `SUPABASE_PROJECT_REF` in the workflow.
4. Run the deploy-backend workflow once with `app_url` = the new Vercel URL
   (sets Auth Site URL + `SITE_URL`).
5. Smoke-test (above), then hand it over.
