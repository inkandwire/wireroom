#!/bin/sh
# Run the claim gate with a node found without relying on the caller's PATH.
# Call form: sh scripts/run-claimgate.sh   (POSIX sh, no network, no dependency)
# Override: NODE=/path/to/node sh scripts/run-claimgate.sh
# Log: .kiro/hook-logs/claim-gate.log (git-ignored)

# Go to the repo root (parent of this script's directory).
cd "$(dirname "$0")/.." || exit 1

LOG_DIR=".kiro/hook-logs"
LOG_FILE="$LOG_DIR/claim-gate.log"

# Print the newest executable file among the given candidates (version sort).
# An unmatched glob stays literal, so every candidate is tested with -x.
pick_newest() {
  found=""
  for candidate in "$@"; do
    if [ -f "$candidate" ] && [ -x "$candidate" ]; then
      found="$found$candidate
"
    fi
  done
  [ -n "$found" ] || return 1
  if newest=$(printf '%s' "$found" | sort -V 2>/dev/null); then
    :
  else
    newest=$(printf '%s' "$found" | sort)
  fi
  printf '%s\n' "$newest" | tail -n 1
}

find_node() {
  # 1. node already on PATH
  if found_node=$(command -v node 2>/dev/null) && [ -x "$found_node" ]; then
    printf '%s\n' "$found_node"
    return 0
  fi
  # 2. explicit override
  if [ -n "${NODE:-}" ] && [ -x "$NODE" ]; then
    printf '%s\n' "$NODE"
    return 0
  fi
  # 3. common fixed locations
  for fixed in /usr/local/bin/node /opt/homebrew/bin/node; do
    if [ -x "$fixed" ]; then
      printf '%s\n' "$fixed"
      return 0
    fi
  done
  # 4. version-manager globs, newest match wins
  for pattern in \
    "/home/*/.local/share/mise/installs/node/*/bin/node" \
    "/home/*/.nvm/versions/node/*/bin/node" \
    "/home/*/.volta/bin/node" \
    "${HOME:-/nonexistent}/.local/share/mise/installs/node/*/bin/node"; do
    # shellcheck disable=SC2086
    if picked=$(pick_newest $pattern); then
      printf '%s\n' "$picked"
      return 0
    fi
  done
  return 1
}

# Append a UTC-stamped entry; the text comes from the file given as $1.
write_log() {
  mkdir -p "$LOG_DIR" 2>/dev/null || return 0
  {
    printf 'claim-gate %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    cat "$1"
  } >> "$LOG_FILE" 2>/dev/null
  return 0
}

TMP_OUT=$(mktemp) || exit 1

NODE_BIN=$(find_node)
if [ -z "$NODE_BIN" ]; then
  echo "claim gate: node not found" > "$TMP_OUT"
  write_log "$TMP_OUT"
  rm -f "$TMP_OUT"
  echo "claim gate: node not found" >&2
  exit 127
fi

PATH="$(dirname "$NODE_BIN"):$PATH"
export PATH

node_modules/.bin/vite-node src/cli/claimgate.ts drafts > "$TMP_OUT" 2>&1
GATE_CODE=$?

write_log "$TMP_OUT"
cat "$TMP_OUT"
rm -f "$TMP_OUT"
exit "$GATE_CODE"
