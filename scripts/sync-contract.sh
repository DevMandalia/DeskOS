#!/usr/bin/env bash
# Copy the canonical DeskOS contract/ module into the private desk, or --check
# that the two copies match.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

pkg_name=""
if [[ -f "$ROOT/package.json" ]]; then
  pkg_name="$(node -p "require('$ROOT/package.json').name" 2>/dev/null || true)"
fi

find_dir() {
  local candidate
  for candidate in "$@"; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done
  return 1
}

OSS=""
PRIVATE=""

if [[ "$pkg_name" == "deskos" ]]; then
  OSS="$ROOT"
  PRIVATE="$(find_dir "${DECISION_DESK_ROOT:-}" "$ROOT/../decision-desk" || true)"
elif [[ "$pkg_name" == "decision-desk" ]]; then
  PRIVATE="$ROOT"
  OSS="$(find_dir "${DESKOS_ROOT:-}" "$ROOT/../decision-desk-oss" || true)"
else
  echo "sync-contract: unknown package at $ROOT (expected deskos or decision-desk)" >&2
  exit 1
fi

if [[ -z "$OSS" || ! -d "$OSS/contract" ]]; then
  echo "sync-contract: DeskOS contract/ not found" >&2
  exit 1
fi

SRC="$OSS/contract"
SCRIPT_SRC="$OSS/scripts/sync-contract.sh"

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src/" "$dest/"
  else
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$src"/. "$dest/"
  fi
}

if [[ "${1:-}" == "--check" ]]; then
  if [[ -z "$PRIVATE" ]]; then
    echo "sync-contract: private desk checkout not found; skipping drift check"
    exit 0
  fi
  fail=0
  if ! diff -rq "$SRC" "$PRIVATE/contract"; then
    fail=1
  fi
  if ! diff -q "$SCRIPT_SRC" "$PRIVATE/scripts/sync-contract.sh"; then
    fail=1
  fi
  if [[ "$fail" -ne 0 ]]; then
    echo "sync-contract: copies have drifted. From DeskOS run: bash scripts/sync-contract.sh" >&2
    exit 1
  fi
  echo "sync-contract: DeskOS and private desk contract copies match"
  exit 0
fi

if [[ -z "$PRIVATE" ]]; then
  echo "sync-contract: private desk checkout not found" >&2
  exit 1
fi

mkdir -p "$PRIVATE/scripts"
copy_tree "$SRC" "$PRIVATE/contract"
cp "$SCRIPT_SRC" "$PRIVATE/scripts/sync-contract.sh"
chmod +x "$PRIVATE/scripts/sync-contract.sh" "$SCRIPT_SRC"
echo "sync-contract: copied $SRC -> $PRIVATE/contract"
