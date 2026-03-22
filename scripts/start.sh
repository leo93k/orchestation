SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 이전 결과 초기화
bash "${SCRIPT_DIR}/clean.sh"

if [ "$#" -gt 0 ]; then
  TARGETS="$@"
else
  # 파일명에서 번호 추출 (prompt*.md, _prompt*.md는 제외)
  TARGETS=$(ls "$ROOT_DIR"/docs/prompts/prompt*.md 2>/dev/null | sed 's/.*prompt\([0-9]*\)\.md/\1/' | sort -n | tr '\n' ' ')
  if [ -z "$TARGETS" ]; then
    echo "docs/prompts/prompt*.md 파일이 없습니다."
    exit 1
  fi
fi

FIRST=true
COUNT=0
for i in $TARGETS; do
  if [ ! -f "$ROOT_DIR/docs/prompts/prompt${i}.md" ]; then
    echo "docs/prompts/prompt${i}.md 파일이 없습니다. 건너뜁니다."
    continue
  fi

  DONE_FLAG="$ROOT_DIR/prompt${i}/spec/.done"
  rm -f "$DONE_FLAG"
  CMD="bash '${SCRIPT_DIR}/run.sh' ${i} && touch '${DONE_FLAG}'"
  if [ "$FIRST" = true ]; then
    # 첫 번째: 현재 세션을 수평 분할(위/아래), 아래에서 실행
    osascript -e "tell application \"iTerm\"
      tell current window
        tell current session
          set bottomPane to (split horizontally with default profile)
          tell bottomPane
            write text \"$CMD\"
          end tell
        end tell
      end tell
    end tell"
    FIRST=false
  else
    # 나머지: 아래 패널에서 세로 분할
    osascript -e "tell application \"iTerm\"
      tell current window
        tell current session
          set newPane to (split vertically with default profile)
          tell newPane
            write text \"$CMD\"
          end tell
        end tell
      end tell
    end tell"
  fi
  COUNT=$((COUNT + 1))
done

# 모든 프롬프트 완료 대기 후 리포트 생성
echo "⏳ ${COUNT}개 프롬프트 완료 대기 중..."
while true; do
  DONE=0
  for i in $TARGETS; do
    [ -f "$ROOT_DIR/prompt${i}/spec/.done" ] && DONE=$((DONE + 1))
  done
  if [ "$DONE" -ge "$COUNT" ]; then
    break
  fi
  sleep 5
done

echo "✅ 모든 프롬프트 완료. 리포트 생성 중..."
bash "${SCRIPT_DIR}/report.sh"    