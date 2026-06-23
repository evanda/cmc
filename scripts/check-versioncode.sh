#!/usr/bin/env bash
# PreToolUse guard: blocks a mobile *release* build/submit when the Android
# versionCode in apps/mobile/app.json is not strictly greater than the highest
# versionCode already shipped (recorded by the release/mobile-* git tags).
#
# The Play Store rejects any upload whose versionCode <= the last one, so this
# catches the "forgot to bump versionCode" duplicate-rejection before the build.
#
# Adapted from evanda/bub (which read android/app/build.gradle and tagged
# release/v*). This monorepo ships mobile via Expo/EAS, so:
#   - the versionCode lives in apps/mobile/app.json -> expo.android.versionCode
#   - release commands are `eas build` / `eas submit`
#   - mobile releases are tagged `release/mobile-vX.Y.Z` (web uses release/web-*)
#
# NOTE: if you let EAS manage the versionCode remotely (eas.json
# `"autoIncrement": true` / a "remote" appVersionSource), app.json won't carry a
# local versionCode — this guard then no-ops and EAS owns monotonicity. It only
# gates when you manage versionCode locally in app.json.
#
# Wired in .claude/settings.json as a PreToolUse hook on Bash. It reads the
# tool-call JSON on stdin, self-gates to release commands, and exits 0 (allow)
# for everything else. Exit 2 blocks the tool call and shows stderr to Claude.

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
APP_JSON="$ROOT/apps/mobile/app.json"

# Read the whole hook payload. We only need to know whether the command is a
# mobile release, so grepping the raw JSON for the keywords is enough — no jq.
input="$(cat || true)"

# Only gate an ACTUAL mobile release: an `eas build` / `eas submit`, optionally
# fenced to a production profile. Matching bare keywords anywhere would
# false-positive on commands that merely MENTION eas (e.g. grepping these docs),
# so require the `eas` CLI verb.
case "$input" in
  *"eas build"*|*"eas submit"* ) ;;
  *) exit 0 ;;  # not a mobile release — allow
esac

# app.json must be readable, otherwise don't get in the way (not scaffolded yet).
[ -f "$APP_JSON" ] || exit 0

# Pull expo.android.versionCode out of app.json. Use node for robust JSON
# parsing (the value may be nested / formatted any number of ways).
current="$(node -e "
  try {
    const j = require('$APP_JSON');
    const vc = j && j.expo && j.expo.android && j.expo.android.versionCode;
    if (Number.isInteger(vc)) process.stdout.write(String(vc));
  } catch (e) {}
" 2>/dev/null || true)"
# No locally-managed versionCode (likely EAS-remote) — nothing to guard.
[ -n "$current" ] || exit 0

# Highest versionCode across all PREVIOUSLY-shipped release/mobile-* tags. A tag
# that points at HEAD is the in-flight release being prepared (the
# sync-and-release skill tags before building) — it isn't "shipped" yet, so
# exclude it. Otherwise tagging release/mobile-vX.Y.Z then building that same
# commit would see its own versionCode as already shipped and block the build.
head_sha="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
max=0
while IFS= read -r tag; do
  [ -n "$tag" ] || continue
  tag_sha="$(git -C "$ROOT" rev-list -n1 "$tag" 2>/dev/null || true)"
  [ -n "$head_sha" ] && [ "$tag_sha" = "$head_sha" ] && continue
  vc="$(git -C "$ROOT" show "$tag:apps/mobile/app.json" 2>/dev/null \
        | node -e "
            let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
              try { const j=JSON.parse(d); const v=j&&j.expo&&j.expo.android&&j.expo.android.versionCode;
                    if (Number.isInteger(v)) process.stdout.write(String(v)); } catch(e){}
            });" 2>/dev/null || true)"
  [ -n "$vc" ] || continue
  [ "$vc" -gt "$max" ] && max="$vc"
done < <(git -C "$ROOT" tag --list 'release/mobile-*')

if [ "$current" -le "$max" ]; then
  cat >&2 <<EOF
versionCode guard: apps/mobile/app.json expo.android.versionCode is $current, but
$max has already shipped (per release/mobile-* tags). The Play Store rejects
uploads with versionCode <= the last one. Bump expo.android.versionCode to
$((max + 1)) (and expo.version + apps/mobile/package.json version, kept in sync)
before building a mobile release. See WORKFLOW.md § 6C.
EOF
  exit 2
fi

exit 0
