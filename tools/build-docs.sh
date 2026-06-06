#!/usr/bin/env bash
# Regenerate a .docx alongside every .md in docs/.
# Usage: tools/build-docs.sh          (build all)
#        tools/build-docs.sh FILE.md  (build one)
set -euo pipefail
cd "$(dirname "$0")/.."

build() { python3 tools/md2docx.py "$1"; }

if [[ $# -ge 1 ]]; then
  build "$1"
else
  shopt -s nullglob
  for f in docs/*.md; do
    [[ "$(basename "$f")" == "README.md" ]] && continue
    build "$f"
  done
fi
