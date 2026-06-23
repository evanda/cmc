# Release — web (Vercel) + mobile (Expo EAS → Play) + Supabase

Use this skill whenever the user asks to:
- deploy the web app / ship to Vercel
- build a mobile release / ship to the Play Store
- push database migrations
- prepare or cut a release

There is **one** canonical release procedure, to avoid version-policy drift:
the **sync-and-release** skill. Releasing is **Phase 6** of that cycle and is
split across three surfaces, released in dependency order:

- **6A** Backend — Supabase migrations (`supabase db push`)
- **6B** Web — Vercel
- **6C** Mobile — Expo EAS → Play (version bump → release notes → `eas build`/`eas submit` → tag)

→ `.agents/skills/sync-and-release/SKILL.md` (Phase 6 — Release)

If the branch is already merged to `main` and tested, jump straight to Phase 6;
otherwise run the full `syncme` cycle from Phase 1.
