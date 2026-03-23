#!/bin/bash
# analyze-dependencies.sh
# Uses Claude API to analyze dependencies between pending requests
# Input: request summaries via stdin (one per line: ID|TITLE|BODY_SUMMARY)
# Output: JSON-like structured output with independent/dependent grouping
# Usage: bash scripts/analyze-dependencies.sh < request_list.txt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [dependency-analyzer] $*" >&2
}

# Read request summaries from arguments
# Format: "REQ_ID1:TITLE1:BODY1\nREQ_ID2:TITLE2:BODY2\n..."
REQUEST_DATA="$1"

if [[ -z "$REQUEST_DATA" ]]; then
  log "No request data provided"
  echo "ERROR"
  exit 1
fi

# Count requests
REQ_COUNT=$(echo "$REQUEST_DATA" | wc -l | tr -d ' ')

# If only 1 request, it's trivially independent
if [[ "$REQ_COUNT" -le 1 ]]; then
  REQ_ID=$(echo "$REQUEST_DATA" | head -1 | cut -d'|' -f1)
  echo "INDEPENDENT:${REQ_ID}"
  exit 0
fi

log "Analyzing dependencies between $REQ_COUNT requests..."

# Build the prompt for Claude
ANALYSIS_PROMPT="너는 소프트웨어 태스크 의존성 분석 전문가다.

아래 개선 요청들이 서로 독립적인지, 의존적인지 판단해라.

독립적 = 서로 다른 파일/기능을 수정하므로 동시에 작업 가능
의존적 = 한 요청의 결과가 다른 요청의 입력이 되거나, 같은 파일/기능을 수정하여 충돌 가능

=== 요청 목록 ===
${REQUEST_DATA}
=== 끝 ===

반드시 다음 형식으로만 답변해라 (다른 텍스트 없이):
INDEPENDENT: REQ-001, REQ-003
DEPENDENT: REQ-002 -> REQ-004
DEPENDENT: REQ-005 -> REQ-006

규칙:
- INDEPENDENT 줄에는 다른 요청과 무관하게 병렬 처리 가능한 요청 ID를 쉼표로 나열
- DEPENDENT 줄에는 의존 관계가 있는 요청 쌍을 화살표(->)로 표시 (선행 -> 후행)
- 모든 요청 ID가 INDEPENDENT 또는 DEPENDENT에 반드시 1번 이상 포함되어야 함
- 의존 관계가 없으면 모든 요청을 INDEPENDENT에 넣어라"

ANALYSIS_RESULT=""
if command -v claude &>/dev/null; then
  ANALYSIS_RESULT=$(echo "$ANALYSIS_PROMPT" | claude --print --model claude-sonnet-4-6 2>/dev/null || echo "ERROR: Claude call failed")
else
  log "claude CLI not found, treating all as independent"
  # Fallback: all independent
  ALL_IDS=$(echo "$REQUEST_DATA" | cut -d'|' -f1 | tr '\n' ', ' | sed 's/,$//')
  echo "INDEPENDENT:${ALL_IDS}"
  exit 0
fi

if [[ "$ANALYSIS_RESULT" == ERROR* ]]; then
  log "Claude analysis failed, treating all as independent"
  ALL_IDS=$(echo "$REQUEST_DATA" | cut -d'|' -f1 | tr '\n' ', ' | sed 's/,$//')
  echo "INDEPENDENT:${ALL_IDS}"
  exit 0
fi

# Output the raw analysis result for parsing by the caller
echo "$ANALYSIS_RESULT"
