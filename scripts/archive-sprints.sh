#!/bin/bash
set -euo pipefail

# Usage: ./scripts/archive-sprints.sh
# status: done인 스프린트를 docs/sprint/archive/로 이동

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPRINT_DIR="$REPO_ROOT/docs/sprint"
ARCHIVE_DIR="$SPRINT_DIR/archive"

mkdir -p "$ARCHIVE_DIR"

MOVED=0

for f in "$SPRINT_DIR"/SPRINT-*.md; do
  [ -f "$f" ] || continue
  status=$(awk 'NR==1 && /^---$/{in_fm=1;next} in_fm && /^---$/{exit} in_fm && /^status:/{sub(/^status:[ ]*/, ""); print; exit}' "$f")
  if [ "$status" = "done" ]; then
    filename=$(basename "$f")
    mv "$f" "$ARCHIVE_DIR/$filename"
    echo "  📦 $filename → archive/"
    MOVED=$((MOVED + 1))
  fi
done

if [ "$MOVED" -eq 0 ]; then
  echo "아카이브할 스프린트가 없습니다."
else
  echo ""
  echo "✅ ${MOVED}개 스프린트 아카이브 완료"
fi
