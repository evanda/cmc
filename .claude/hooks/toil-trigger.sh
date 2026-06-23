#!/bin/bash
# Trigger: if the user submits 'toil', inject the claude-async routine prompt.
input=$(cat)

if echo "$input" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const p = JSON.parse(d).prompt || '';
      process.exit(/\btoil\b/i.test(p) ? 0 : 1);
    } catch(e) { process.exit(1); }
  });
" 2>/dev/null; then
  echo "=== toil trigger: injecting claude-async-prompt.md ==="
  cat "$CLAUDE_PROJECT_DIR/claude-async-prompt.md"
fi
