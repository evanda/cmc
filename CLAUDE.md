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
- **Open a PR immediately on the first push to any feature branch** — use `mcp__github__create_pull_request`
  targeting `main`. Don't wait until a "batch" is done; open the PR on first push so a Vercel
  preview exists throughout development.
- **Always provide the Vercel preview URL** — after creating or pushing to a PR, fetch the URL
  from PR comments using `mcp__github__pull_request_read` (method `get_comments`) — Vercel posts
  it as a bot comment once the build completes. Poll until the comment appears (retry after ~30s).
  Include the preview URL in every reply that touches deployed code. Do **not** guess or construct
  the URL from the branch name — Vercel uses an opaque hash that must be read from the PR comment.
- **Never close a session without a working preview URL.** If the build hasn't finished, say so
  and give the PR link so the user can find it themselves. Do not end on "Vercel will pick it up."

## Workflow

Three trigger words drive the day-to-day loop (see `WORKFLOW.md` for full detail):

| Word | What it does |
|------|-------------|
| **`triage`** | Review open issues, group by phase, apply labels + structured bodies |
| **`toil`** | Pick an issue, implement it on `claude-async`, commit + update draft PR |
| **`syncme`** | Pull `claude-async`, run CI, test, merge, push migrations, cut release |

Hooks wired in `.claude/settings.json`:
- **SessionStart** — warns if the local branch is behind origin before any work.
- **UserPromptSubmit** — intercepts `toil` and injects `claude-async-prompt.md`.
- **PreToolUse (Bash)** — guards mobile `versionCode` before any release build.

## Current task — Phase 0 (Foundation)

Monorepo scaffold; Supabase project + schema (§6); auth + roles (RLS);
single-row `org_settings`/`facilities`; buildings / floors / locations CRUD;
seedable **facility fixtures** + a `reset && seed <name>` dev workflow (plan §7.6).
