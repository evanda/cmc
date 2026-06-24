---
name: sync-and-release
description: Guides the full claude-async PR review cycle for the CMMS monorepo — pull branch, apply Supabase migrations, run web (Vercel target) + mobile (Expo) for manual testing, summarize changes, merge PR, then release across three surfaces — Supabase migrations, web on Vercel, and mobile via Expo EAS → Play.
triggers:
  - syncme
---
# Sync-and-Release Skill (syncme)

Adapted from `evanda/bub`. Same review cycle — pull the overnight `claude-async`
PR, build/run for manual testing, then (when the user is satisfied) merge, bump
versions, and release — retargeted to this **monorepo** with **three release
surfaces**:

- **Backend** — Supabase migrations (`supabase db push`)
- **Web** — Vercel
- **Mobile** — Expo **EAS** → Google Play (App Store later)

Covers **WORKFLOW.md §3–6**. Work through the phases **in order**; each ends with
a user gate — do not run ahead.

> **Branch model & worktrees carry over from bub unchanged.** Overnight work
> accumulates on `claude-async` under one draft PR. Parallel sessions use
> `git worktree` (see WORKFLOW.md § Parallel work) — nothing about that changed.

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

Note the PR number (call it `#PR`) and open it for the user:

```bash
gh pr view #PR --repo evanda/cmc --web
```

### 1c. Summarise what changed

```bash
git log --oneline main..claude-async
git diff --stat main...claude-async
```

Read the PR body and cross-reference it with the commit log. Produce a concise,
human-readable summary structured as:

```
## What changed
- Issue #N — [one-sentence description of what was implemented]

## Surfaces to test manually
- Web (apps/web): [what specifically to exercise]
- Mobile (apps/mobile): [only if the Expo app was touched]
- Map / loader: [only if spatial layers/POIs changed]

## Schema / migrations
- [list any new files under supabase/migrations/, or "none"]

## What the automated tests cover
[Which test files changed across workspaces and what each asserts]

## What the tests do NOT cover (must verify by hand)
[UI behaviour, RLS/permission boundaries, map rendering, platform diffs]
```

**Flag migrations loudly** — they gate both testing (Phase 2) and release
(Phase 6A). Present this summary **before** building anything.

---

## Phase 2 — Build & Run

Ask the user which surfaces to test before building (web, mobile, or both).
Default to web (the Phase-1 MVP surface). Then:

### 2a. Apply migrations first (if any)

If the diff added anything under `supabase/migrations/`, the app won't behave
correctly until the local/preview database has them. Apply to a **local or
branch** database — never production at this stage:

```bash
# Local stack (preferred for testing):
supabase start            # if not already running
supabase db reset         # re-applies all migrations + seed onto the local DB
# — or, against a throwaway/preview project:
# supabase db push
```

> Re-seed afterwards if the change needs fixture data:
> `pnpm db:seed <facility-fixture>` (the `reset && seed <name>` dev workflow,
> plan §7.6).

### 2b. Web (apps/web) — choose where to test, and advise the user explicitly

Three targets, all on the **same single Supabase project** (backend behaviour is
identical; the choice is frontend build + env). **Pick the right one and tell the
user exactly which URL to open and how to reach it — every time, never assume
localhost:**

- **Vercel preview** (default for the gate) — the PR's `*.vercel.app` URL. Real
  prod build + env; **required** for auth/invite-redirect/Site-URL/env/build-output
  changes. Get it once the Vercel check is green:
  ```bash
  gh pr checks <PR> --repo evanda/cmc
  gh pr view <PR> --repo evanda/cmc --json comments \
    -q '.comments[].body' | grep -ioE 'https://[a-z0-9-]+\.vercel\.app' | tail -1
  ```
  If the build isn't done, tell the user to wait for the check — don't silently
  fall back to localhost.
- **Local** — `pnpm --filter web dev` (http://localhost:5173). Pure UI/map/client
  changes, fast iteration, or no preview available.
- **Vercel prod** (`main` domain) — AFTER merge only, to verify what shipped.

**Auth/invite/redirect flows:** the test origin must be in Supabase → Auth →
Redirect URLs and match the function's `SITE_URL`; for a Vercel preview, that URL
(+ `/accept-invite`) must be allowlisted first. For local it falls back to
`127.0.0.1:5173`. Name the exact origin to allowlist when the change touches these.

**Shared-backend caveat:** test data + migrations are shared across local/preview/
prod (one Supabase project) — flag destructive tests.

### 2c. Mobile (apps/mobile) — only if requested / touched

```bash
pnpm --filter mobile start     # Expo dev server; press a (Android) / w (web)
# Native dev client on a device/emulator:
# pnpm --filter mobile android
```

The single MapLibre map renders in a WebView for v1 (plan §7.2) — if the change
touches the map, verify it on mobile, not just web.

Tell the user both surfaces are ready and repeat the manual-test list.

---

## Phase 3 — User Testing Gate

**Stop here.** Tell the user **the exact URL you chose in 2b and how to reach it**
(e.g. "wait for the Vercel check on PR #N to go green, then open `https://…vercel.app`"
— or "run `pnpm --filter web dev` and open http://localhost:5173"). Then:

> Testing on **<the URL you chose>** (<one line: why this target + how you got there>).
> Here's what to check manually:
> [repeat the "Surfaces to test manually" bullets from Phase 1]
>
> Reply **"looks good"** (or describe any issues) when you're done.

If the user reports a bug, help diagnose and fix it. **Push the fix to
`origin/claude-async` before continuing** — commits left only on the local branch
are orphaned when the PR is squash-merged and the branch deleted:

```bash
git push origin claude-async
```

Re-run the relevant build after any fix, then return to the testing gate.

---

## Phase 4 — Merge the PR

Only proceed after the user explicitly approves ("looks good", "merge it", etc.).

> **The merge is a USER-RUN step.** Merging a PR to `main` (and deleting the
> branch) is a destructive default-branch action — the Claude Code safety
> classifier will **deny** an agent-issued `gh pr merge`. Don't try to execute
> it; **present the commands for the user to run** and continue once they confirm
> the merge landed (`gh pr view <PR> --json state` → `MERGED`).

**Before merging, push any commits made during testing:**

```bash
git push origin claude-async
```

Then (user runs):

```bash
gh pr merge #PR --repo evanda/cmc --squash --delete-branch
git checkout main
git pull --ff-only
```

Confirm the merge succeeded and report which issues were auto-closed (look for
`Closes #N` / `Closes evanda/cmc-feedback#N` in the PR description).

**Safety net — close stragglers.** GitHub only auto-closes on a closing keyword
(`Closes/Fixes/Resolves #N`); a bare `#N` reference does not. After merging,
cross-check the issues the PR addressed against the still-open list and close any
fully-delivered ones that didn't auto-close
(`gh issue close <N> --repo evanda/cmc --comment "Delivered in PR #<PR> (merged)."`),
leaving partially-addressed issues open.

---

## Phase 5 — Close External Feedback Issues

Check each merged internal issue's body for a **Public Feedback** section linking
to `evanda/cmc-feedback` issues. If the PR carried `Closes evanda/cmc-feedback#N`,
GitHub already closed them — verify. For any that didn't auto-close:

```bash
gh issue comment <FEEDBACK_N> --repo evanda/cmc-feedback \
  --body "This shipped in CMC vX.Y.Z! [one-sentence summary from the issue's Release Notes Draft]. Thanks — closing this out."
gh issue close <FEEDBACK_N> --repo evanda/cmc-feedback
```

Skip this phase if none of the merged issues reference public feedback.

---

## Phase 6 — Release

Ask the user: **"Ready to cut a release?"** and **which surfaces** — a change may
be web-only, mobile-only, or both, and a schema change must ship to Supabase
regardless. Release in dependency order: **6A backend → 6B web → 6C mobile**, so
the database is ready before the clients that depend on it deploy.

### 6A. Backend — Supabase migrations (do this first if schema changed)

```bash
# Review what will change against the linked production project:
supabase db diff --linked          # or: supabase migration list --linked
# Apply the migrations to production:
supabase db push
```

> Migrations are **forward-only and ordered** — push them before deploying any
> web/mobile build that reads the new schema, or the live clients will 500
> against columns/tables that don't exist yet. If a migration is destructive,
> confirm with the user before pushing.

### 6B. Web — Vercel

The web app's "version" is informational (no Play-style monotonic constraint).
Vercel deploys per commit:

- **Default:** merging to `main` triggers Vercel's production deploy
  automatically — confirm the deployment went green in the Vercel dashboard.
- **Manual / out-of-band:** `vercel --prod` from `apps/web` (or
  `pnpm --filter web build` then `vercel deploy --prebuilt --prod`).

Bump `apps/web/package.json` "version" if you tag web releases. Tag:

```bash
git tag release/web-vX.Y.Z
```

### 6C. Mobile — Expo EAS → Google Play

This surface carries the Play-Store version discipline ported from bub.

**6C-i. Determine the next version**

```bash
git tag --list "release/mobile-v*" --sort=-version:refname | head -5
```

Increment **expo.version** by the **patch** component by default (e.g. 1.2.3 →
1.2.4); bump exactly one step — never jump (e.g. straight to 1.3.0) without
explicit instruction. Ask the user only if a minor/major bump is warranted.
**expo.android.versionCode** always increments by exactly +1 over the last
shipped one.

> The `check-versioncode.sh` PreToolUse hook blocks an `eas build`/`eas submit`
> release if `apps/mobile/app.json` → `expo.android.versionCode` isn't strictly
> greater than every `release/mobile-*` tag — so a stale versionCode fails fast
> rather than at Play upload. (If you let EAS manage versionCode remotely via
> `eas.json` autoIncrement, the guard no-ops and EAS owns monotonicity.)

**6C-ii. Bump versions in sync**

| File | Field(s) |
|------|----------|
| `apps/mobile/app.json` | `expo.version`, `expo.android.versionCode` (+1) [, `expo.ios.buildNumber` once iOS ships] |
| `apps/mobile/package.json` | `"version"` (= `expo.version`) |

```bash
pnpm check-versions     # guards apps/mobile package.json == app.json expo.version
```

Show the user a diff before committing.

**6C-iii. Release notes**

```bash
git log --oneline <LAST_MOBILE_TAG>..HEAD
```

Collect the **"User-facing summary"** lines from `## 4. Release Notes Draft` in
each internal issue merged into this release; summarise to ≤500 chars for the Play
Console "What's new" field.

**6C-iv. Commit + tag**

```bash
git add apps/mobile/app.json apps/mobile/package.json
git commit -m "$(cat <<'EOF'
chore: release mobile vX.Y.Z (versionCode N)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git tag release/mobile-vX.Y.Z
```

Do **not** push — the user pushes. (Tag-then-build is fine: `check-versioncode.sh`
excludes a `release/mobile-*` tag pointing at HEAD from the "already shipped" set.)

**6C-v. Build + submit via EAS**

```bash
eas build --platform android --profile production    # produces the AAB on EAS
eas submit --platform android --latest               # uploads to Play (or upload the AAB by hand)
```

> EAS builds remotely; there's no local Gradle/bundletool/emulator dance to
> manage (the bub AAB-vs-APK and adb gotchas don't apply here). If you want an
> on-device sanity check first, `eas build --profile preview` and install the APK
> on a device.

**6C-vi. Report**

Tell the user:
- EAS build URL + artifact (AAB)
- `expo.version` and `expo.android.versionCode`
- Release-notes copy (ready to paste into Play Console "What's new")
- Reminder to push `main` and the tag:

```bash
git push origin main
git push origin release/mobile-vX.Y.Z
```

---

## Quick-reference

| Surface | Version source | Deploy | Tag |
|---------|----------------|--------|-----|
| Backend | `supabase/migrations/*` | `supabase db push` | (shared release commit) |
| Web | `apps/web/package.json` | Vercel (auto on `main`) or `vercel --prod` | `release/web-vX.Y.Z` |
| Mobile | `apps/mobile/app.json` (`expo.version` + `android.versionCode`) | `eas build` → `eas submit` | `release/mobile-vX.Y.Z` |

Release order always: **migrations → web → mobile**.
