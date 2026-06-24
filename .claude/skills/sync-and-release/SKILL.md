---
name: sync-and-release
description: Guides the full claude-async PR review cycle — pull branch, run CI checks, start the web dev server, summarize changes for manual testing, merge PR, push Supabase migrations, and cut a Vercel + Expo EAS release.
triggers:
  - syncme
---
# Sync-and-Release Skill

Covers **WORKFLOW.md §3–6**: pull the overnight `claude-async` PR, build and
run for manual testing, then (when the user is satisfied) merge, push database
migrations, and cut a release.

---

## Execution Guide for Agents

**Trigger:** the user saying "syncme" (alone or with context like "syncme
please") should invoke this skill automatically.

Work through the phases below **in order**. Each phase ends with a user gate
before proceeding — do not run ahead.

---

## Phase 1 — Pull & Summarise

### 1a. Sync the branch

```bash
git fetch origin
git checkout claude-async
git pull --ff-only origin claude-async
pnpm install
```

If `git pull` refuses (diverged history), rebase instead:

```bash
git rebase origin/main
```

### 1b. Find the open PR

```bash
gh pr list --repo evanda/cmc --head claude-async
```

Note the PR number (call it `#PR`). Open it for the user:

```bash
gh pr view #PR --repo evanda/cmc --web
```

### 1c. Summarise what changed

```bash
git log --oneline main..claude-async
git diff --stat main...claude-async
```

Read the PR body (`gh pr view #PR --repo evanda/cmc`) and cross-reference with
the commit log. Produce a concise human-readable summary:

```
## What changed
- Issue #N — [one-sentence description of what was implemented]
- Issue #M — [one-sentence description]

## Surfaces to test manually
- [web route / component]: [what specifically to exercise]

## What the automated tests cover
[Bullet: which test files changed and what each asserts]

## What the tests do NOT cover (must verify by hand)
[Bullet: UI behaviour, RLS edge cases, Supabase interactions]
```

Present this summary **before starting any build or server**.

---

## Phase 2 — Build & Run

### 2a. Type-check + lint across the monorepo

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Report any failures immediately. Do not proceed to the dev server if
typecheck fails — fix it or surface the error to the user.

### 2b. Check for pending Supabase migrations

```bash
supabase db diff          # shows schema drift vs local migration files
# or, to see unapplied migration files:
supabase migration list
```

If there are pending migrations, note them for Phase 6.

### 2c. Start the web dev server

```bash
pnpm --filter web dev &
```

Tell the user the app is at `http://localhost:5173` and to use it for
manual testing.

---

## Phase 3 — User Testing Gate

**Stop here.** Tell the user:

> The web app is running at http://localhost:5173. Here's what to check:
> [repeat the "Surfaces to test manually" bullets from Phase 1]
>
> Reply **"looks good"** (or describe any issues) when you're done.

If the user reports a bug, help diagnose and fix it. **Push the fix to
`origin/claude-async` before continuing** — any commits left only on the local
branch will be orphaned when the PR is squash-merged:

```bash
git push origin claude-async
```

Return to this testing gate after any fix.

---

## Phase 4 — Merge the PR

Only proceed after the user explicitly approves ("looks good", "merge it", etc.).

> **The merge is a USER-RUN step.** Merging a PR to `main` (and deleting the
> branch) is a destructive default-branch action — present the commands for the
> user to run, then continue once they confirm the merge landed.

**Before merging, push any commits made during testing:**

```bash
git push origin claude-async
```

Then merge:

```bash
gh pr merge #PR --repo evanda/cmc --squash --delete-branch
git checkout main
git pull --ff-only
```

Confirm the merge succeeded and report which issues were auto-closed
(look for `Closes #N` in the PR description).

**Safety net — close stragglers.** GitHub only auto-closes on a closing keyword
(`Closes/Fixes/Resolves #N`); a bare `#N` reference does not. After merging,
cross-check every issue the PR addressed against the still-open list and close
any that were fully delivered but didn't auto-close:

```bash
# Issues referenced anywhere in the PR body, still open after merge:
gh pr view #PR --repo evanda/cmc --json body -q '.body' | grep -oE '#[0-9]+' | sort -u
gh issue list --repo evanda/cmc --state open --assignee '*' --json number,title
```

For each that the merge fully resolved:
`gh issue close <N> --repo evanda/cmc --comment "Delivered in PR #<PR> (merged)."`
Leave issues only partially addressed open (and note what remains).

---

## Phase 5 — Push Supabase Migrations

If Phase 2 found pending migrations, push them now:

```bash
supabase db push
```

Confirm the migrations applied cleanly. If there are errors, surface them to
the user before proceeding.

For a remote Supabase project (not local):

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

---

## Phase 6 — Version Bump & Release

Ask the user: **"Ready to cut a release?"** before proceeding. (They may want
to batch multiple PRs before releasing.)

### 6a. Determine the next version

```bash
git tag --list "release/v*" --sort=-version:refname | head -5
```

Increment the **patch** component by default (e.g. 0.1.0 → 0.1.1). Ask the
user only if a minor or major bump is warranted by the scope of changes.

### 6b. Bump version

Update `version` in the root `package.json`. If individual apps have their own
`package.json` versions, keep them in sync.

```bash
# Confirm everything agrees
node -e "const p=require('./package.json'); console.log(p.version)"
```

Show the user a diff before committing.

### 6c. Generate release notes

```bash
git log --oneline <LAST_TAG>..HEAD
```

Collect the **"User-facing summary"** lines from `## 4. Release Notes Draft`
in each internal issue that was just merged.

### 6d. Commit and tag

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: release vX.Y.Z

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git tag release/vX.Y.Z
```

Do **not** push — the user pushes manually.

### 6e. Web release (Vercel)

Vercel deploys automatically when `main` is pushed — no manual step needed.
After the user pushes, confirm the deployment completed:

```bash
gh run list --repo evanda/cmc --branch main   # if CI is wired
# or check the Vercel dashboard directly
```

### 6f. Mobile release (Expo EAS) — when apps/mobile exists

```bash
# Build for Android (and iOS when configured)
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android --latest
```

Skip this step if `apps/mobile` has not been scaffolded yet.

### 6g. Report

Tell the user:
- Release version and tag
- Vercel deployment status (or "auto-deploys on push")
- EAS build status (if applicable)
- Release notes copy ready to paste
- Reminder: push `main` and the tag

```bash
git push origin main
git push origin release/vX.Y.Z
```
