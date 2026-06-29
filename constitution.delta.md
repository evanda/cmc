# Constitution delta — cmc

Repo-specific overrides and additions layered on the shared
`knowledge/constitution.md`. Keep this to genuine, stack-specific deltas; general
rules belong upstream (see the `promote-learning` litmus tests).

## Additional risk surfaces
- Any change to **Supabase RLS policies, auth, or roles** (under `supabase/`) is
  `risk:security` even if it looks cosmetic — these are the tenancy/access boundary.
- **Cost tracking** (work-order costs, vendor billing) is `risk:money`.
- **DB migrations** under `supabase/` touch persisted data — treat as `risk:data`.

## Stack-specific rules
- All DB migrations must be **reversible** and reviewed before merge.
- **Single-tenant invariant:** nothing church-specific is hardcoded. Church
  identity/branding/campus data live in `org_settings`/`facilities` and seed data
  only — never in code (plan §7.6).
- The **data model in plan §6** is the schema source of truth; follow the
  **phase order in plan §11**.
- **Ask before** adding dependencies not named in the plan.

## Cartridge
- Release cartridge: `release-web`

## Local notes
<!-- Instance-specific gotchas. e.g. "our webhook sends cents, not dollars." -->
