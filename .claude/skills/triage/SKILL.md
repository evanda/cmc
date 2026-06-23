---
name: triage
description: Reviews open issues on evanda/cmc, consolidates duplicates/fragments, fleshes out thin issues with structured bodies, and applies phase + type labels so the backlog stays clean and phase-ordered.
triggers:
  - triage
---
# Triage Skill

Grooms the `evanda/cmc` backlog: reads every open issue, consolidates overlapping
ones, fleshes out vague or thin issues with structured bodies, and ensures each
has the right phase label. The output is a clean, actionable backlog where every
issue clearly belongs to a phase and has enough detail to be picked up by `toil`.

---

## Step 1: Fetch issues and read the plan

```
mcp__github__list_issues(owner="evanda", repo="cmc", state="OPEN")
Read facility-maintenance-app-plan.md   # §11 = phase order; §6 = schema
```

---

## Step 2: Group and flag

Scan all open issues and produce a short internal inventory:

- **Duplicates / fragments** — issues that cover the same ground or together form
  one coherent task. Note which to consolidate and which to close as duplicates.
- **Already covered by the plan** — if the plan's deliverable for a phase already
  implies this work, note it so the issue body can reference the right section.
- **Scope concerns** — issues that conflict with a key design rule (see below);
  flag with a brief note rather than silently closing.

Key design rules to check against:
- **Phase order (§11):** work that skips ahead and would block a lower-phase
  deliverable is a scope risk — flag it.
- **Single-tenant / church-agnostic (§7.6):** anything that would hardcode
  church-specific values in code (vs. `org_settings`) — flag it.
- **Schema contract (§6):** changes inconsistent with the data model — flag it.
- **Out-of-scope domains (§13):** room booking, full GL/accounting, IoT sensors —
  flag as out-of-scope for v1.

---

## Step 3: Confirm with the user

Before making any changes, show a brief summary:

- Issues you'll consolidate (which survive, which close as duplicates)
- Issues you'll flesh out (currently thin/vague)
- Issues you're flagging for scope concerns, with a one-line reason

Use `AskUserQuestion` for anything genuinely ambiguous. Then proceed.

---

## Step 4: Consolidate duplicates

For issues being merged into a canonical one:
1. Update the canonical issue body to incorporate any useful detail from the others.
2. Close the duplicates with a comment:
   ```
   mcp__github__add_issue_comment(owner="evanda", repo="cmc", issue_number=N,
     body="Closing as duplicate of #M.")
   mcp__github__issue_write(owner="evanda", repo="cmc", issue_number=N,
     state="closed")
   ```

---

## Step 5: Flesh out thin issues

For each issue that lacks a structured body, update it using this template.
When an issue already has a good body, only fill in the missing sections.

```markdown
**Phase:** [0 / 1 / 2 / 3 / 4 — per plan §11]

## What & why
[One paragraph: what this delivers and why it matters at this phase.]

## Technical notes
- **Schema / migration:** [tables or columns affected; `supabase/migrations/`]
- **Shared (`packages/shared`):** [types, validation, or business logic]
- **Web (`apps/web`):** [components, routes, query hooks]
- **Mobile / Loader:** [only if this phase touches those apps]

## Checklist
- [ ] Migration in `supabase/migrations/`
- [ ] Types in `packages/shared/src/types/`
- [ ] RLS policies updated
- [ ] Web UI / query hooks
- [ ] Unit tests
```

Omit sections that don't apply (e.g. no migration needed → drop that line).

---

## Step 6: Apply labels

Create labels if they don't exist yet (`gh label create … --repo evanda/cmc`),
then apply the right ones to each issue:

| Label | Color | Meaning |
|-------|-------|---------|
| `phase-0` | `#0075ca` | Foundation |
| `phase-1` | `#0075ca` | MVP |
| `phase-2` | `#0075ca` | Spatial |
| `phase-3` | `#0075ca` | Proactive |
| `phase-4` | `#0075ca` | Insight & mobile |
| `bug` | `#d73a4a` | Something is broken |
| `feature` | `#a2eeef` | New capability |
| `housekeeping` | `#e4e669` | Chores, deps, cleanup |
| `architecture` | `#f9d0c4` | Structural / cross-cutting |
| `future` | `#cfd3d7` | Deferred — not in current phases |

```
mcp__github__issue_write(owner="evanda", repo="cmc", issue_number=N,
  body="<updated body>", labels=["phase-0", "feature"])
```

---

## Step 7: Report

Post a brief summary of what was done:
- Issues consolidated (which survived, which were closed as duplicates)
- Issues fleshed out
- Issues flagged (and why — awaiting user decision)
