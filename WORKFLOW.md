# Developer Workflow

A quick-reference for the day-to-day loop, ported from `evanda/bub` and adapted
to this CMMS monorepo (web + mobile + loader + shared, on Supabase). Each section
links to the dedicated skill for full detail.

---

## Trigger Words (Claude Shortcuts)

Type one of these as your entire message to kick off the named workflow:

| Word | What it does | Skill |
|------|-------------|-------|
| **`triage`** | Fetches public feedback issues, weeds out-of-scope, **phase-gates** against the build plan, groups them, asks for judgment calls, files approved items as internal issues with breadcrumbs | `.agents/skills/feedback-rationalizer/` |
| **`toil`**   | On `claude-async`: picks an open issue fitting the current phase, implements it, verifies the affected workspaces, commits, pushes, updates the aggregate draft PR (falls back to monorepo chores when no issue fits) | _(inline prompt — [cmc-async-prompt.md](cmc-async-prompt.md), injected by a hook)_ |
| **`syncme`** | Pulls `claude-async`, applies migrations, runs web + mobile for manual testing, summarises changes, waits for sign-off, then guides merge + release across Supabase / Vercel / Expo EAS | `.agents/skills/sync-and-release/` |

---

## Getting Started (one-time per clone)

```bash
pnpm install
git config core.hooksPath .githooks    # enable the Closes #N commit hook
supabase start                         # local Postgres + Auth + Storage
pnpm db:reset                          # apply migrations + seed a facility fixture
```

The repo also ships Claude Code hooks (in `.claude/settings.json`): a
SessionStart "behind origin" check, the `toil` prompt injector, and a mobile
`versionCode` release guard. They activate automatically.

---

## 1. Daily Intake — Triage Feedback

Pull latest first, then process new public feedback.

```bash
git pull --ff-only
```

Tell Claude **"triage"** — it fetches the public feedback repo
(`evanda/cmc-feedback`), weeds out anything out of scope (plan §13) or
multi-tenant (plan §7.6), **tags each request with the phase that owns it**
(plan §11), asks you about judgment calls, and files approved items as internal
issues on `evanda/cmc` with two-way breadcrumbs.

Skill: `.agents/skills/feedback-rationalizer/`

---

## 2. Async Routine — Implement an Issue

Tell Claude **"toil"** (or run it overnight). It works on `claude-async`, picks a
current-phase issue, implements it across the right workspaces, adds a Supabase
migration if the schema changes, verifies (`pnpm -r lint typecheck test`),
commits, pushes, and updates one aggregate draft PR against `main`. Full spec:
[cmc-async-prompt.md](cmc-async-prompt.md).

```bash
gh pr list --repo evanda/cmc --head claude-async   # find the open draft PR
gh pr view <N> --repo evanda/cmc --web             # read the summary + checklist
git fetch && git checkout claude-async             # pull to test locally
```

---

## 3. Review, Merge & Release — `syncme`

Tell Claude **"syncme"** — it pulls the branch, applies any new migrations to a
local/branch DB, runs the web (and mobile, if touched) surfaces for manual
testing, summarises exactly what changed and what to test, waits for your
sign-off, then guides the merge and the release.

Skill: `.agents/skills/sync-and-release/`

Release is three surfaces in dependency order:

| Order | Surface | How | Tag |
|-------|---------|-----|-----|
| 1 | **Backend** | `supabase db push` | (shared release commit) |
| 2 | **Web** | Vercel (auto on merge to `main`) or `vercel --prod` | `release/web-vX.Y.Z` |
| 3 | **Mobile** | bump `app.json` version + versionCode → `eas build` → `eas submit` | `release/mobile-vX.Y.Z` |

The merge to `main` is a **user-run** step (the safety classifier denies an
agent-issued `gh pr merge`). Version sync is guarded by `pnpm check-versions` and
the `check-versioncode.sh` PreToolUse hook (mobile only).

---

## Parallel work — git worktrees (carried over from bub)

Run independent sessions in separate worktrees so they don't collide on the index
or `claude-async`:

```bash
git worktree add ../cmc-feature-x -b feature-x   # new branch in its own dir
git worktree list
git worktree remove ../cmc-feature-x             # when done
```

Each worktree is a full checkout sharing one `.git` — ideal for running `toil` in
one while reviewing with `syncme` in another.

---

## 4. Run & Test (manual)

```bash
pnpm --filter web dev          # Vite dev server (web)
pnpm --filter mobile start     # Expo dev server (mobile; map in a WebView)
pnpm -r lint typecheck test    # all workspaces
pnpm check-versions            # mobile version sources agree
```
