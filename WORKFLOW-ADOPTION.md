# Workflow Adoption — port from `evanda/bub`

**Goal:** replicate the **triage / toil / sync-and-release** workflow from the `evanda/bub`
repo into this repo, adapted to this project's stack. Delete this file once the port lands.

## Step 1 — Study the source (read-only; never modify bub)
The bub repo is checked out locally at **`/home/evanda/dev/prj/bub`**. Read it there — do
not write to it. Find the workflow's docs, commands, and scripts; likely homes:
- Workflow docs: `docs/`, `docs/workflows/`, `README`, `CONTRIBUTING`, `CLAUDE.md`, `AGENTS.md`
- Agent config / slash commands: `.claude/`, `.claude/commands/`
- Backing scripts: `scripts/`, `Makefile`, `justfile`, root `package.json` scripts
Locate the **triage**, **toil**, and **sync-and-release** pieces specifically. Summarize
what each does and which files implement it *before* changing anything in this repo.

> Suggested first pass: `ls -R /home/evanda/dev/prj/bub | grep -iE 'triage|toil|sync|release|workflow'`
> and read the matching files, plus bub's `CLAUDE.md`, `Makefile`/`justfile`, and `package.json` scripts.

## Step 2 — Map the differences (bub → this repo)
Verify each row against the actual bub files; the right-hand column is this project (see the
project plan). Cells marked “confirm” are inferred — check bub before relying on them.

| Concern        | bub (confirm against repo)            | this repo                                                        |
|----------------|----------------------------------------|-----------------------------------------------------------------|
| App type       | Bible-study app + Holy-Land atlas      | CMMS — facility maintenance, web + mobile                        |
| Repo layout    | single app (confirm)                   | monorepo: `apps/web`, `apps/mobile`, `apps/loader`, `packages/shared` |
| Web release    | Vercel (confirm)                       | Vercel                                                           |
| Mobile release | Android via Google Play Developer API  | Expo **EAS** → Play (App Store later)                            |
| Backend release| n/a (confirm)                          | **Supabase** migrations (`supabase db push`)                    |
| Parallel work  | `git worktree` sessions                | same — carry over unchanged                                      |

## Step 3 — Adapt, don't copy verbatim
- **triage:** keep the structure and command name; retarget labels/categories to facilities
  work, and tie triage to the phase plan (plan §11).
- **toil:** retarget routine chores to the monorepo — lint/typecheck/test per workspace,
  dependency updates, Supabase migration hygiene, Expo/EAS housekeeping.
- **sync-and-release:** split release into **web (Vercel)** and **mobile (Expo EAS → Play)**,
  add a **Supabase migration** step to the release path, and keep the git-sync / worktree
  parts intact.
- Preserve the *shape* and command names from bub wherever sensible so the muscle memory
  transfers; only diverge where the stack genuinely differs.

## Step 4 — Land it
- Mirror bub's conventions for where docs/commands/scripts live.
- Wire scripts into the root `package.json` / `Makefile` so they work across the monorepo.
- Add a short "Workflow" section to `CLAUDE.md` summarizing the adopted commands.
- Open a PR titled **"Adopt triage/toil/sync-and-release workflow from bub"** with your
  Step-1 summary in the description so the mapping is reviewable.

