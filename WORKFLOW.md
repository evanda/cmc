# Developer Workflow

A quick-reference for the day-to-day loop, adapted to this CMMS monorepo
(web + mobile + loader + shared, on Supabase). Each section links to the
dedicated skill for full detail.

---

## Trigger Words (Claude Shortcuts)

Type one of these as your entire message to kick off the named workflow:

| Word | What it does | Skill |
|------|-------------|-------|
| **`triage`** | Fetches open issues on evanda/cmc, groups them by phase, asks for judgment calls, consolidates duplicates, and fleshes out thin issues | `.claude/skills/triage/` |
| **`toil`** | On `claude-async`: picks an open issue, implements it across the right workspaces, runs lint/typecheck/test, commits, pushes, updates the aggregate draft PR | _(inline prompt — [claude-async-prompt.md](claude-async-prompt.md), injected by a hook)_ |
| **`syncme`** | Pulls `claude-async`, applies migrations, runs web + mobile for manual testing, summarises changes, waits for sign-off, then guides merge + release across Supabase / Vercel / Expo EAS | `.claude/skills/sync-and-release/` |

---

## Getting Started (one-time per clone)

```bash
pnpm install
git config core.hooksPath .githooks    # enable the Closes #N commit hook
supabase start                         # local Postgres + Auth + Storage
pnpm db:reset                          # apply migrations + seed a facility fixture
```

The repo ships Claude Code hooks (in `.claude/settings.json`): a SessionStart
"behind origin" check, the `toil` prompt injector, and a mobile `versionCode`
release guard. They activate automatically.

---

## 1. Daily Intake — Triage Issues

Pull latest first, then process open issues.

```bash
git pull --ff-only
```

Tell Claude **"triage"** — it fetches open issues on
[evanda/cmc](https://github.com/evanda/cmc/issues), groups them by phase (§11),
asks about judgment calls, consolidates duplicates, and ensures each has a
structured body and the right label.

Skill: `.claude/skills/triage/`

---

## 2. Async Routine — Implement an Issue

Tell Claude **"toil"** (or run it overnight). It works on `claude-async`, picks a
current-phase issue, implements it across the right workspaces, adds a Supabase
migration if the schema changes, verifies (`pnpm -r lint typecheck test`),
commits, pushes, and updates one aggregate draft PR against `main`. Full spec:
[claude-async-prompt.md](claude-async-prompt.md).

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

Skill: `.claude/skills/sync-and-release/`

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

## Parallel work — git worktrees

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

---

## 5. Merge and Close Issues

The PR description contains `Closes #N` for every internal issue addressed —
merging closes them all automatically.

```bash
gh pr merge <N> --repo evanda/cmc --squash --delete-branch
git checkout main && git pull --ff-only
```

For your own commits, reference the issue in the subject:

```bash
git commit -m "fix: location CRUD missing floor_id validation (#42)"
```
