#!/bin/bash
# auto-improve.sh
# Picks up pending requests, analyzes dependencies via Claude,
# creates tasks in parallel for independent requests, sequential for dependent ones
# Usage: bash scripts/auto-improve.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUESTS_DIR="$PROJECT_ROOT/docs/requests"
ORCHESTRATE="$PROJECT_ROOT/scripts/orchestrate.sh"
COLLECT_REQUESTS="$PROJECT_ROOT/scripts/collect-requests.sh"
ANALYZE_DEPS="$PROJECT_ROOT/scripts/analyze-dependencies.sh"

SLEEP_INTERVAL=${SLEEP_INTERVAL:-30}
STOP_FLAG="$PROJECT_ROOT/.auto-improve-stop"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Check if graceful stop was requested
check_stop_flag() {
  if [[ -f "$STOP_FLAG" ]]; then
    log "Stop flag detected ($STOP_FLAG). Shutting down gracefully..."
    rm -f "$STOP_FLAG"
    exit 0
  fi
}

# Update request status in markdown frontmatter
update_status() {
  local file="$1"
  local new_status="$2"

  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^status: .*/status: ${new_status}/" "$file"
  else
    sed -i "s/^status: .*/status: ${new_status}/" "$file"
  fi
  log "Updated $(basename "$file") -> status: $new_status"
}

# Extract frontmatter field value
get_field() {
  local file="$1"
  local field="$2"
  grep "^${field}:" "$file" | head -1 | sed "s/^${field}: *//"
}

# Get body content (after frontmatter)
get_body() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$file"
}

# Evaluate a single request via Claude (accept/reject)
# Returns the eval result text; sets EVAL_DECISION global
evaluate_request() {
  local req_id="$1"
  local req_title="$2"
  local req_priority="$3"
  local req_body="$4"

  local eval_prompt="너는 소프트웨어 개발 태스크 매니저다.

아래 개선 요청을 분석하고, 실행 가능한지 판단해라.

요청 ID: $req_id
제목: $req_title
우선순위: $req_priority
내용: $req_body

판단 기준:
- 요청이 구체적인가? (어떤 파일, 어떤 기능, 어떤 변경인지 파악 가능한가?)
- 범위가 명확한가? (하나의 태스크로 완료할 수 있는 크기인가?)
- 모호하거나 추상적인가? (\"좋게 해줘\", \"개선해줘\" 같은 표현만 있는가?)

반드시 다음 형식으로만 답변해라:
DECISION: accept 또는 reject
REASON: 한줄 사유
TASK_TITLE: (accept일 경우) 태스크 제목
TASK_DESCRIPTION: (accept일 경우) 구체적인 완료 조건 목록"

  local eval_result=""
  if command -v claude &>/dev/null; then
    eval_result=$(echo "$eval_prompt" | claude --print --model claude-sonnet-4-6 2>/dev/null || echo "DECISION: reject
REASON: Claude 호출 실패")
  else
    eval_result="DECISION: reject
REASON: claude CLI not found"
  fi

  echo "$eval_result"
}

# Calculate next TASK ID
get_next_task_id() {
  local offset="${1:-0}"
  local max_num
  max_num=$(find "$PROJECT_ROOT/docs/task" -name "TASK-*.md" | sed 's/.*TASK-0*//' | sed 's/-.*//' | sort -n | tail -1)
  if [[ -z "$max_num" ]]; then
    max_num=0
  fi
  printf "%03d" $(( 10#$max_num + 1 + offset ))
}

# Create a task file from an accepted request
# Args: req_file req_id req_title req_priority req_body eval_result [depends_on_task_id]
create_task() {
  local req_id="$1"
  local req_title="$2"
  local req_priority="$3"
  local req_body="$4"
  local eval_result="$5"
  local task_num="$6"
  local depends_on="${7:-}"

  local task_title
  task_title=$(echo "$eval_result" | grep "^TASK_TITLE:" | head -1 | sed 's/TASK_TITLE: *//')
  local task_desc
  task_desc=$(echo "$eval_result" | sed -n '/^TASK_DESCRIPTION:/,$ p' | tail -n +2)

  local task_id="TASK-${task_num}"
  local task_slug
  task_slug=$(echo "$task_title" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g' | cut -c1-30)
  local task_file="$PROJECT_ROOT/docs/task/${task_id}-${task_slug}.md"

  # Build depends_on field
  local depends_field="[]"
  if [[ -n "$depends_on" ]]; then
    depends_field="[${depends_on}]"
  fi

  cat > "$task_file" << TASKEOF
---
id: ${task_id}
title: ${task_title}
status: backlog
priority: ${req_priority}
sprint:
depends_on: ${depends_field}
branch: task/${task_id}-${task_slug}
worktree: ../repo-wt-${task_id}
role: general
reviewer_role: reviewer-general
---

# ${task_id}: ${task_title}

## 원본 요청

- Request: ${req_id}
- 제목: ${req_title}
- 내용: ${req_body}

## 완료 조건

${task_desc}
TASKEOF

  log "Created $task_id: $task_title (depends_on: ${depends_field})"
  echo "$task_file"
}

# ──────────────────────────────────────────────────────────
# Main daemon loop
# ──────────────────────────────────────────────────────────

log "Auto-improve daemon started (parallel mode)"
log "Watching: $REQUESTS_DIR"
log "Sleep interval: ${SLEEP_INTERVAL}s"

while true; do
  check_stop_flag

  # ── Step 1: Collect ALL pending requests ──
  PENDING_LINES=""
  if [[ -d "$REQUESTS_DIR" ]]; then
    PENDING_LINES=$(bash "$COLLECT_REQUESTS" "$REQUESTS_DIR" 2>/dev/null || true)
  fi

  if [[ -z "$PENDING_LINES" || "$PENDING_LINES" == "[]" ]]; then
    log "No pending requests. Sleeping..."
    sleep "$SLEEP_INTERVAL"
    continue
  fi

  # Parse collected requests into arrays
  declare -a REQ_FILES=()
  declare -a REQ_IDS=()
  declare -a REQ_TITLES=()
  declare -a REQ_PRIORITIES=()
  declare -a REQ_BODIES=()

  while IFS='|' read -r file id title priority; do
    [[ -z "$file" ]] && continue
    REQ_FILES+=("$file")
    REQ_IDS+=("$id")
    REQ_TITLES+=("$title")
    REQ_PRIORITIES+=("$priority")
    REQ_BODIES+=("$(get_body "$file")")
  done <<< "$PENDING_LINES"

  TOTAL_COUNT=${#REQ_IDS[@]}
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Found $TOTAL_COUNT pending request(s): ${REQ_IDS[*]}"

  # ── Step 2: Evaluate each request (accept/reject) ──
  declare -a ACCEPTED_INDICES=()
  declare -a EVAL_RESULTS=()

  for i in "${!REQ_IDS[@]}"; do
    check_stop_flag

    log "Evaluating ${REQ_IDS[$i]}: ${REQ_TITLES[$i]}..."
    update_status "${REQ_FILES[$i]}" "in_progress"

    eval_result=$(evaluate_request "${REQ_IDS[$i]}" "${REQ_TITLES[$i]}" "${REQ_PRIORITIES[$i]}" "${REQ_BODIES[$i]}")
    EVAL_RESULTS+=("$eval_result")

    decision=$(echo "$eval_result" | grep "^DECISION:" | head -1 | sed 's/DECISION: *//')

    if [[ "$decision" != "accept" ]]; then
      reject_reason=$(echo "$eval_result" | grep "^REASON:" | head -1 | sed 's/REASON: *//')
      update_status "${REQ_FILES[$i]}" "rejected"

      echo "" >> "${REQ_FILES[$i]}"
      echo "---" >> "${REQ_FILES[$i]}"
      echo "**거절 사유:** $reject_reason" >> "${REQ_FILES[$i]}"
      echo "**거절 시각:** $(date '+%Y-%m-%d %H:%M:%S')" >> "${REQ_FILES[$i]}"

      log "Rejected ${REQ_IDS[$i]}: $reject_reason"
    else
      log "Accepted ${REQ_IDS[$i]}"
      ACCEPTED_INDICES+=("$i")
    fi
  done

  ACCEPTED_COUNT=${#ACCEPTED_INDICES[@]}

  if [[ $ACCEPTED_COUNT -eq 0 ]]; then
    log "All requests rejected. Continuing..."
    unset REQ_FILES REQ_IDS REQ_TITLES REQ_PRIORITIES REQ_BODIES EVAL_RESULTS ACCEPTED_INDICES
    sleep 2
    continue
  fi

  log "$ACCEPTED_COUNT request(s) accepted out of $TOTAL_COUNT"

  # ── Step 3: Dependency analysis (only if multiple accepted requests) ──
  declare -a INDEPENDENT_INDICES=()
  declare -a DEPENDENT_PAIRS=()

  if [[ $ACCEPTED_COUNT -le 1 ]]; then
    # Single request: trivially independent
    INDEPENDENT_INDICES=("${ACCEPTED_INDICES[@]}")
    log "Single accepted request — no dependency analysis needed"
  else
    # Build request summary for dependency analysis
    REQ_SUMMARY=""
    for idx in "${ACCEPTED_INDICES[@]}"; do
      body_oneline=$(echo "${REQ_BODIES[$idx]}" | tr '\n' ' ' | cut -c1-200)
      REQ_SUMMARY+="${REQ_IDS[$idx]}|${REQ_TITLES[$idx]}|${body_oneline}"$'\n'
    done
    REQ_SUMMARY=$(echo "$REQ_SUMMARY" | sed '/^$/d')

    log "Analyzing dependencies between ${ACCEPTED_COUNT} requests via Claude..."

    ANALYSIS_OUTPUT=$(bash "$ANALYZE_DEPS" "$REQ_SUMMARY" 2>/dev/null || echo "ERROR")

    if [[ "$ANALYSIS_OUTPUT" == "ERROR" ]]; then
      log "Dependency analysis failed — treating all as independent"
      INDEPENDENT_INDICES=("${ACCEPTED_INDICES[@]}")
    else
      log "Dependency analysis result:"
      echo "$ANALYSIS_OUTPUT" | while IFS= read -r line; do
        log "  $line"
      done

      # Parse INDEPENDENT line
      INDEP_LINE=$(echo "$ANALYSIS_OUTPUT" | grep "^INDEPENDENT:" | head -1 | sed 's/^INDEPENDENT: *//' || true)

      if [[ -n "$INDEP_LINE" ]]; then
        # Map request IDs back to indices
        IFS=',' read -ra INDEP_IDS <<< "$INDEP_LINE"
        for indep_id_raw in "${INDEP_IDS[@]}"; do
          indep_id=$(echo "$indep_id_raw" | tr -d ' ')
          for idx in "${ACCEPTED_INDICES[@]}"; do
            if [[ "${REQ_IDS[$idx]}" == "$indep_id" ]]; then
              INDEPENDENT_INDICES+=("$idx")
              break
            fi
          done
        done
      fi

      # Parse DEPENDENT lines
      while IFS= read -r dep_line; do
        [[ -z "$dep_line" ]] && continue
        dep_content=$(echo "$dep_line" | sed 's/^DEPENDENT: *//')
        DEPENDENT_PAIRS+=("$dep_content")

        # Extract IDs from dependent pairs that aren't already in independent
        from_id=$(echo "$dep_content" | sed 's/ *->.*$//' | tr -d ' ')
        to_id=$(echo "$dep_content" | sed 's/^.*-> *//' | tr -d ' ')

        for dep_id in "$from_id" "$to_id"; do
          found=false
          for existing in "${INDEPENDENT_INDICES[@]+"${INDEPENDENT_INDICES[@]}"}"; do
            if [[ "${REQ_IDS[$existing]}" == "$dep_id" ]]; then
              found=true
              break
            fi
          done
          # Dependent IDs are handled separately, not added to independent
        done
      done <<< "$(echo "$ANALYSIS_OUTPUT" | grep "^DEPENDENT:" || true)"

      # If no independent requests found, fall back to all independent
      if [[ ${#INDEPENDENT_INDICES[@]} -eq 0 && ${#DEPENDENT_PAIRS[@]} -eq 0 ]]; then
        log "No clear dependency info — treating all as independent"
        INDEPENDENT_INDICES=("${ACCEPTED_INDICES[@]}")
      fi
    fi
  fi

  # ── Step 4: Create tasks for independent requests (batch 0, parallel) ──
  INDEP_COUNT=${#INDEPENDENT_INDICES[@]}
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Processing plan:"
  log "  병렬 처리 (independent): $INDEP_COUNT request(s)"
  log "  순차 처리 (dependent):   ${#DEPENDENT_PAIRS[@]} pair(s)"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  CREATED_TASK_FILES=()
  CREATED_TASK_IDS=()
  INDEPENDENT_REQ_FILES=()

  if [[ $INDEP_COUNT -gt 0 ]]; then
    log "▶ Creating $INDEP_COUNT task(s) for parallel processing..."

    task_offset=0
    for idx in "${INDEPENDENT_INDICES[@]}"; do
      task_num=$(get_next_task_id "$task_offset")
      task_file=$(create_task \
        "${REQ_IDS[$idx]}" \
        "${REQ_TITLES[$idx]}" \
        "${REQ_PRIORITIES[$idx]}" \
        "${REQ_BODIES[$idx]}" \
        "${EVAL_RESULTS[$idx]}" \
        "$task_num")

      CREATED_TASK_FILES+=("$task_file")
      CREATED_TASK_IDS+=("TASK-${task_num}")
      INDEPENDENT_REQ_FILES+=("${REQ_FILES[$idx]}")
      task_offset=$((task_offset + 1))
    done

    # Git commit all independent tasks at once
    cd "$PROJECT_ROOT"
    for tf in "${CREATED_TASK_FILES[@]}"; do
      git add "$tf" 2>/dev/null || true
    done
    BATCH_LABEL=$(IFS=,; echo "${CREATED_TASK_IDS[*]}")
    git commit -m "feat(${BATCH_LABEL}): auto-generated parallel tasks" 2>/dev/null || true

    # Run orchestrate.sh once — all independent tasks are in backlog with no deps
    # orchestrate.sh will pick them all up in batch 0 and run them in parallel
    if [[ -x "$ORCHESTRATE" ]]; then
      log "Running orchestration for parallel batch: ${CREATED_TASK_IDS[*]}"
      bash "$ORCHESTRATE" 2>&1 | while IFS= read -r line; do
        log "[orchestrate] $line"
      done || {
        log "Warning: Orchestration had errors for parallel batch"
      }
    fi

    # Mark independent requests as done
    for req_file in "${INDEPENDENT_REQ_FILES[@]}"; do
      update_status "$req_file" "done"
    done

    log "✅ Parallel batch completed: ${CREATED_TASK_IDS[*]}"
  fi

  # ── Step 5: Handle dependent requests sequentially ──
  if [[ ${#DEPENDENT_PAIRS[@]} -gt 0 ]]; then
    log "▶ Processing ${#DEPENDENT_PAIRS[@]} dependent pair(s) sequentially..."

    # Collect all dependent request IDs (deduplicated, ordered)
    declare -a DEP_ORDER=()
    for pair in "${DEPENDENT_PAIRS[@]}"; do
      from_id=$(echo "$pair" | sed 's/ *->.*$//' | tr -d ' ')
      to_id=$(echo "$pair" | sed 's/^.*-> *//' | tr -d ' ')

      # Add from_id if not already in order
      found=false
      for existing in "${DEP_ORDER[@]+"${DEP_ORDER[@]}"}"; do
        [[ "$existing" == "$from_id" ]] && found=true && break
      done
      [[ "$found" == false ]] && DEP_ORDER+=("$from_id")

      # Add to_id if not already in order
      found=false
      for existing in "${DEP_ORDER[@]+"${DEP_ORDER[@]}"}"; do
        [[ "$existing" == "$to_id" ]] && found=true && break
      done
      [[ "$found" == false ]] && DEP_ORDER+=("$to_id")
    done

    # Process each dependent request in order
    PREV_TASK_ID=""
    for dep_req_id in "${DEP_ORDER[@]}"; do
      check_stop_flag

      # Find the index for this request
      dep_idx=""
      for idx in "${ACCEPTED_INDICES[@]}"; do
        if [[ "${REQ_IDS[$idx]}" == "$dep_req_id" ]]; then
          dep_idx="$idx"
          break
        fi
      done

      # Skip if already processed as independent
      already_done=false
      for ind_idx in "${INDEPENDENT_INDICES[@]+"${INDEPENDENT_INDICES[@]}"}"; do
        if [[ "$ind_idx" == "$dep_idx" ]]; then
          already_done=true
          break
        fi
      done
      [[ "$already_done" == true ]] && continue

      if [[ -z "$dep_idx" ]]; then
        log "Warning: Could not find request $dep_req_id in accepted list, skipping"
        continue
      fi

      log "Sequential: processing $dep_req_id (depends on: ${PREV_TASK_ID:-none})"

      task_num=$(get_next_task_id 0)
      depends_arg=""
      if [[ -n "$PREV_TASK_ID" ]]; then
        depends_arg="$PREV_TASK_ID"
      fi

      task_file=$(create_task \
        "${REQ_IDS[$dep_idx]}" \
        "${REQ_TITLES[$dep_idx]}" \
        "${REQ_PRIORITIES[$dep_idx]}" \
        "${REQ_BODIES[$dep_idx]}" \
        "${EVAL_RESULTS[$dep_idx]}" \
        "$task_num" \
        "$depends_arg")

      local_task_id="TASK-${task_num}"

      cd "$PROJECT_ROOT"
      git add "$task_file" 2>/dev/null || true
      git commit -m "feat(${local_task_id}): auto-generated from ${dep_req_id} (sequential)" 2>/dev/null || true

      if [[ -x "$ORCHESTRATE" ]]; then
        log "Running orchestration for sequential task: $local_task_id..."
        bash "$ORCHESTRATE" 2>&1 | while IFS= read -r line; do
          log "[orchestrate] $line"
        done || {
          log "Warning: Orchestration had errors for $local_task_id"
        }
      fi

      update_status "${REQ_FILES[$dep_idx]}" "done"
      log "✅ Sequential task completed: $dep_req_id → $local_task_id"

      PREV_TASK_ID="$local_task_id"
    done

    unset DEP_ORDER
  fi

  # ── Step 6: Summary log ──
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Batch processing summary:"
  log "  Total requests processed: $TOTAL_COUNT"
  log "  Accepted: $ACCEPTED_COUNT"
  log "  Rejected: $((TOTAL_COUNT - ACCEPTED_COUNT))"
  if [[ $INDEP_COUNT -gt 0 ]]; then
    log "  Parallel (independent): $INDEP_COUNT → ${CREATED_TASK_IDS[*]}"
  fi
  if [[ ${#DEPENDENT_PAIRS[@]} -gt 0 ]]; then
    log "  Sequential (dependent): ${#DEPENDENT_PAIRS[@]} pair(s)"
  fi
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Cleanup arrays for next iteration
  unset REQ_FILES REQ_IDS REQ_TITLES REQ_PRIORITIES REQ_BODIES
  unset EVAL_RESULTS ACCEPTED_INDICES INDEPENDENT_INDICES DEPENDENT_PAIRS
  unset CREATED_TASK_FILES CREATED_TASK_IDS INDEPENDENT_REQ_FILES

  sleep 2
done
