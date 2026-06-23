#!/usr/bin/env bash
# SessionStart hook: fetch origin and warn (loudly) if the local branch is
# behind its upstream, so Claude can offer to sync before doing any work.
# Emits nothing when up to date — silence on the happy path.
#
# Carried over from evanda/bub unchanged — it is stack-agnostic.

dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$dir" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Refresh remote tracking refs. Quiet + short timeout so a slow/offline remote
# never stalls session startup.
git fetch --quiet 2>/dev/null

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
[ -z "$upstream" ] && exit 0

behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null)
[ -z "$behind" ] && behind=0
[ "$behind" -gt 0 ] || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
ctx="The local branch '$branch' is $behind commit(s) BEHIND its upstream $upstream. Before doing ANY other work this session, show the user a BIG, impossible-to-miss warning (e.g. a fenced banner) stating the branch is $behind commit(s) behind $upstream, and ASK whether to sync to latest (git pull --ff-only) before proceeding. The user almost always wants to sync, but wait for their confirmation."

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"},"systemMessage":"⚠️  Local branch is %s commit(s) behind %s — Claude will offer to sync."}\n' "$ctx" "$behind" "$upstream"
exit 0
