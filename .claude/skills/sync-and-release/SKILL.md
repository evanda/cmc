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

## Standing Rules (apply to ALL development, not just syncme)

1. **Open a PR immediately on the first push to any feature branch.** Don't wait
   until a "batch" is done. The PR is what triggers Vercel to build a preview —
   without it, there is no testable URL.

2. **Always give the user the Vercel preview URL** after any push. Fetch it from
   PR comments via `mcp__github__pull_request_read` (method `get_comments`) —
   look for the Vercel bot comment containing the `*.vercel.app` URL. Retry after
   ~30 s if the build hasn't finished. Never say "Vercel will pick it up" and
   stop — either give the URL or give the PR link with an explicit ETA.

3. **Never end a session without a working preview URL.** If the build is still
   running, say so, give the PR link, and offer to wait.

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

### 2c. Choose where to test — and tell the user exactly where

There are three test targets. **You must pick the right one for the change and
tell the user explicitly, every time: which URL to open and what to do to reach
it.** Never leave them to guess or assume localhost. All three hit the **same
single Supabase project**, so backend behaviour (RLS, data, migrations,
functions) is identical — the choice is about the *frontend build + environment*.

| Target | URL | Use when |
|--------|-----|----------|
| **Vercel preview** (default for the gate) | the PR's `*.vercel.app` preview | Real prod build + prod env. **Required** for anything touching auth/invite redirects, Site URL, env vars, or build output (chunking). |
| **Local dev** | `http://localhost:5173` (`pnpm --filter web dev`) | Pure UI / map / client-logic changes with no prod-only behaviour; fast iteration; or when no preview is available. |
| **Vercel prod** | the production domain (`main`) | AFTER merge only — verify what actually shipped. |

**Get the preview URL** — Vercel posts the `*.vercel.app` URL as a comment on
the PR once the build finishes. Fetch the latest PR comments from the GitHub API
and grep for the preview link:

```bash
PR=<number>
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/evanda/cmc/issues/${PR}/comments" \
  | jq -r '.[].body' \
  | grep -oE 'https://cmc-[a-z0-9]+-[a-z0-9-]+\.vercel\.app' \
  | tail -1
```

The preview URL contains a short hash and is NOT derivable from the branch name
(e.g. `https://cmc-kfnzwt4ax-church-maintenance-coordinator.vercel.app`).
Do NOT guess or construct a URL — always fetch it.

**IMPORTANT — always surface the URL directly to the user.** Do not tell them
to "check the PR". Print the full `https://` URL so they can click immediately.
If no comment has appeared yet, tell the user to wait for the Vercel build and
provide the URL once it appears.

If the build isn't done, **tell the user to wait for the Vercel check to go
green**, then give them the URL anyway (it won't serve until the build lands).

**For local instead:**

```bash
pnpm --filter web dev   # runs at http://localhost:5173
```

**Auth / invite / redirect flows (#39-style):** the test origin must be in
Supabase → Auth → URL Configuration → **Redirect URLs**, and the `invite-user`
function's `SITE_URL` must match the origin. For a Vercel preview, the user (or
the #41 owner) must add that preview URL (+ `/accept-invite`) to the allowlist
**before** testing. For local, the function falls back to `127.0.0.1:5173`. If
the change touches these flows, say so and name the exact origin to allowlist.

**Shared-backend caveat — state this when relevant:** local, preview, and prod
all share ONE Supabase project. Test data you create (work orders, invited
users) appears everywhere, and a migration applies to all three. Flag any
destructive test before the user runs it.

---

## Phase 3 — User Testing Gate

**Stop here.** Give the user:
1. **The exact clickable URL** — no "see the PR", no "check Vercel". Print the full `https://` URL.
2. **Why this target** (one line).
3. **The test checklist** (repeat the "Surfaces to test manually" bullets from Phase 1).

Format it like this so nothing is buried:

> **Test here:** [Open preview](<URL fetched from GitHub API above>) (Vercel preview — real prod build)
>
> Here's what to check:
> - [bullet]
> - [bullet]
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

**Before presenting merge commands, YOU MUST verify all of the following — silently fix
any issues before asking the user to do anything:**

1. `pnpm -r typecheck` — must pass clean
2. `pnpm -r test` — must pass clean
3. `git rebase origin/main` — branch must be on top of main (no conflicts)
4. `mcp__github__pull_request_read(get)` — `mergeable_state` must be `clean` (not `dirty`, `unstable`, or `draft`)
5. Vercel build — fetch PR comments and confirm the build is `Ready`, not `Building`

If any check fails, fix it, push, and re-verify before presenting the merge command.
Never hand the user a merge command for a dirty, draft, or build-failing PR.

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

**The tag must point to a commit already on GitHub.** The user pushes `main` from
their own machine after the merge; if Claude creates a local-only commit and tags it,
the SHA doesn't exist on the remote and `git push origin release/vX.Y.Z` fails with
"src refspec does not match any."

Correct sequence:

1. `git fetch origin main && git reset --hard origin/main` — ensure local HEAD = remote HEAD.
2. Set author: `git config user.email noreply@anthropic.com && git config user.name Claude`
3. Tag HEAD directly (the squash-merge commit GitHub already has). Skip the version-bump
   commit — bump `package.json` in the next PR instead, or omit the bump entirely.
4. Tell the user to push **only the tag** — `main` is already up to date from the merge.

```bash
git fetch origin main && git reset --hard origin/main
git config user.email noreply@anthropic.com && git config user.name Claude
git tag release/vX.Y.Z
```

Then tell the user to run:

```bash
git push origin release/vX.Y.Z
```

Do **not** ask them to push `main` — it is already on GitHub from the merge step.

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
