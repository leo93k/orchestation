#!/bin/bash
# common.sh — 공통 유틸리티 함수
# YAML frontmatter 파싱, 템플릿 렌더링 등 여러 스크립트에서 공유하는 함수 모음

# ── 템플릿 디렉토리 (common.sh 기준: scripts/lib/ → ../../template) ──
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/template"

# ── 템플릿 파일 읽기 + 변수 치환 ─────────────────────
# 인자: $1=template/ 기준 상대 경로 (예: "prompt/worker-task.md")
#       나머지 인자: KEY=VALUE 쌍 (예: task_filename="TASK-001.md" task_content="...")
# 출력: 치환된 내용을 stdout으로 출력
#
# 멀티라인 value 지원: python을 사용하여 안전하게 치환
render_template() {
  local tpl_path="$1"
  shift

  local content
  content=$(cat "$TEMPLATE_DIR/$tpl_path")

  # python3이 있으면 안전한 멀티라인 치환, 없으면 단순 bash 치환
  if command -v python3 &>/dev/null; then
    local py_script='
import sys
content = sys.stdin.read()
for arg in sys.argv[1:]:
    eq = arg.index("=")
    key = "{{" + arg[:eq] + "}}"
    val = arg[eq+1:]
    content = content.replace(key, val)
sys.stdout.write(content)
'
    echo "$content" | python3 -c "$py_script" "$@"
  else
    # fallback: bash 내장 치환 (줄바꿈 포함 값은 깨질 수 있음)
    for pair in "$@"; do
      local key="${pair%%=*}"
      local value="${pair#*=}"
      content="${content//\{\{${key}\}\}/${value}}"
    done
    echo "$content"
  fi
}

# ── YAML frontmatter 필드 읽기 ─────────────────────────
# 인자: $1=파일경로, $2=필드명
# 출력: 해당 필드의 값 (없으면 빈 문자열)
get_field() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { sub("^"key":[ ]*", ""); print; exit }
  ' "$1"
}

# ── YAML frontmatter 리스트 필드 읽기 ──────────────────
# 인자: $1=파일경로, $2=필드명
# 출력: 리스트 항목을 한 줄씩 출력
get_list() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { in_list=1; next }
    in_list && /^ +- / { sub(/^ +- /, ""); print; next }
    in_list && /^[^ ]/ { exit }
  ' "$1"
}
