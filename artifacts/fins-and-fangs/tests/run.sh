#!/bin/sh
# Runs every rules check for the Fins & Fangs games. Needs Node 18 or newer; no packages to install.
# Each file prints a line ending in "ok" when it passes, or "FAILED".
cd "$(dirname "$0")" || exit 1
status=0
for f in *.test.mjs; do
  echo "== $f"
  out=$(node "$f" 2>&1) || status=1
  echo "$out" | tail -n 3
  echo "$out" | grep -q "FAIL" && status=1
done
exit $status
