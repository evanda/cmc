# Campus Facilities Maintenance System

Build context for Claude Code. **Full specification:** @facility-maintenance-app-plan.md
(Read it before starting — it is the source of truth for features, schema, and build order.)

## What this is

A self-hosted **CMMS** (facility maintenance app) for a multi-building church campus —
assets and tools, work orders, preventive-maintenance scheduling, vendors/contacts, cost
tracking, a fleet of 3 buses, and a single **stitched map** (georeferenced satellite +
interior floorplan overlays with a floor/level switcher). **Web app + React Native (Expo)
mobile**, **single-tenant per deployment** (each church gets its own instance).

## Architecture (plan §7)

- **Monorepo:** pnpm + Turborepo — `apps/web`, `apps/mobile`, `apps/loader`, `packages/shared`
- **Web:** React + Vite + TypeScript + Tailwind + TanStack Query + **MapLibre GL JS**
- **Backend:** **Supabase** (Postgres, Auth, Storage, RLS, pg_cron, Edge Functions)
- **Mobile:** React Native (Expo); render the single MapLibre map in a WebView for v1
- **Maps:** one geographic coordinate system; interior floorplans are georeferenced raster
  `image` overlays organized by a `level` property; floor switcher filters by level (plan §5)
- **Tenancy:** single-tenant per deployment. **Nothing church-specific is hardcoded** —
  church identity/branding live in a single-row `org_settings`/`facilities` table; all
  campus data is per-instance content (plan §7.6)

## Working agreements

- Follow the **phase order in plan §11**. Start at **Phase 0** unless told otherwise.
- The **data model in plan §6** is the schema source of truth.
- Keep church-specific values out of code (config/seed only).
- Prefer **complete, runnable** output over scaffolding stubs.
- **Ask before** adding dependencies not named in the plan.

## Workflow (ported from `evanda/bub`)

Three trigger words drive the day-to-day loop (full detail in @WORKFLOW.md):

- **`triage`** — fetch public feedback (`evanda/cmc-feedback`), weed out-of-scope
  (plan §13), **phase-gate** against the build order (plan §11), file internal
  issues on `evanda/cmc` with breadcrumbs. Skill: `.agents/skills/feedback-rationalizer/`.
- **`toil`** — on the `claude-async` branch, pick a current-phase issue, implement
  it, verify the affected workspaces, commit/push, update one aggregate draft PR
  (falls back to monorepo chores). Prompt: @cmc-async-prompt.md (hook-injected).
- **`syncme`** — pull `claude-async`, apply migrations, run web + mobile for
  manual testing, then guide merge + release across **Supabase → Vercel → Expo
  EAS**. Skill: `.agents/skills/sync-and-release/`.

Supporting machinery: `.claude/settings.json` hooks (SessionStart behind-origin
check, `toil` injector, mobile `versionCode` release guard), `.githooks/prepare-commit-msg`
(`Closes #N`), and `scripts/check-version-sync.js`. Release order is always
**migrations → web → mobile**; the merge to `main` is a user-run step.

## Current task — Phase 0 (Foundation)

Monorepo scaffold; Supabase project + schema (§6); auth + roles (RLS);
single-row `org_settings`/`facilities`; buildings / floors / locations CRUD;
seedable **facility fixtures** + a `reset && seed <name>` dev workflow (plan §7.6).
