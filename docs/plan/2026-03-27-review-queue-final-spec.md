# 리뷰 큐 분리 + 배치 리뷰 최적화 — 최종 설계 명세

> 설계1 + 설계2 10라운드 리뷰 합의 결과 (2026-03-27)

---

## 1. 배경 및 문제

현재 구조에서 task 슬롯이 review + merge 완료까지 블로킹되어 유휴 시간이 발생한다.

```
[현재] task slot이 review 끝날 때까지 대기
  slot1: TASK-A task → TASK-A review → TASK-A merge → TASK-C task → ...
  slot2: TASK-B task → TASK-B review → TASK-B merge → TASK-D task → ...
```

- review는 haiku로 30~60초이지만, task 10개 기준 review 대기만 5~10분 낭비
- review 비용도 개별 호출 시 비효율적

## 2. 아키텍처

```
┌──────────────────────────────────────────────────────┐
│                 orchestrate.sh 메인 루프               │
│                                                        │
│  ┌──────────┐     task-done      ┌───────────────┐    │
│  │task queue │ ────────────────→ │ review queue   │    │
│  │ slot 1~N  │                   │ (배치 수집)     │    │
│  └──────────┘                   └──────┬────────┘    │
│                                         │             │
│                            count≥max    │  timeout    │
│                            ─────────────┤─────────    │
│                                         ▼             │
│                                ┌───────────────┐      │
│                                │ batch review   │      │
│                                │ (1~N개 묶음)    │      │
│                                └──────┬────────┘      │
│                                       │               │
│                           approved    │  rejected     │
│                           ┌───────────┤──────┐        │
│                           ▼           ▼      │        │
│                    ┌───────────┐  ┌────────┐ │        │
│                    │merge(lock)│  │retry/  │ │        │
│                    │ 순차 실행  │  │ failed │ │        │
│                    └───────────┘  └────────┘ │        │
└──────────────────────────────────────────────────────┘
```

- **2단 큐**: task queue → review queue (merge는 별도 큐 없이 lockfile 직렬화)
- task 완료 → review queue에 추가 → task 슬롯은 즉시 다음 태스크 시작
- review queue에서 배치 수집 → 조건 충족 시 배치 리뷰 실행
- merge는 `ln -s` symlink 기반 lock으로 순차 처리

## 3. 파일 구조

```
.orchestration/
├── signals/              # 기존 signal 시스템 (변경 없음)
│   ├── TASK-XXX-task-done
│   ├── TASK-XXX-task-failed
│   └── ...
├── review-queue/         # [신규] 리뷰 대기 큐
│   ├── TASK-XXX          # 내용: "retry:0" 또는 "retry:1:solo"
│   └── TASK-YYY
├── feedback/             # [신규] 리뷰 피드백 저장
│   ├── TASK-XXX.verdict  # "승인" 또는 "수정요청"
│   └── TASK-XXX.md       # 피드백 본문
├── profile-active        # [신규] "night" 또는 "day" (atomic write)
├── .merge-lock           # [신규] symlink lock → target = PID
└── config.json           # 기존 + batchReview 설정 추가
```

## 4. config.json 추가 필드

```json
{
  "reviewQueueEnabled": true,
  "maxParallel": {
    "task": 2,
    "review": 2
  },
  "batchReview": {
    "enabled": true,
    "gracePeriodSeconds": 5,
    "profiles": {
      "night": { "maxBatchSize": 5, "timeoutSeconds": 120 },
      "day": { "maxBatchSize": 3, "timeoutSeconds": 30 }
    }
  },
  "reservedReviewSlots": 1
}
```

- `reviewQueueEnabled: false` → 기존 순차 로직(task-done → 즉시 review → merge)으로 롤백
- `maxBatchSize: 1`로 시작하여 안정화 후 3으로 올림 (Phase 통합)
- `reservedReviewSlots`: review 큐가 비어있으면 task에 동적 양보

## 5. 프로세스 슬롯 관리

```
MAX_CLAUDE_PROCS = maxParallel.task + maxParallel.review  (기본 4)
RESERVED_REVIEW = reservedReviewSlots                      (기본 1)

can_dispatch_task():
  review 큐가 비어있으면 → effective_reserved = 0 (양보)
  available = MAX_CLAUDE_PROCS - effective_reserved - running_reviews
  running_tasks < available

can_dispatch_review():
  available = MAX_CLAUDE_PROCS - running_tasks
  최소 RESERVED_REVIEW 보장
  running_reviews < available
```

## 6. 배치 수집 로직

```bash
dispatch_reviews() {
  local profile=$(read_active_profile)
  local max_batch=$(jq -r ".batchReview.profiles.${profile}.maxBatchSize" "$CONFIG")
  local timeout=$(jq -r ".batchReview.profiles.${profile}.timeoutSeconds" "$CONFIG")
  local grace=$(jq -r ".batchReview.gracePeriodSeconds" "$CONFIG")

  # bash 3.x 호환: mapfile/readarray 사용 금지
  local queue_files=()
  while IFS= read -r f; do
    queue_files+=("$f")
  done < <(ls -t .orchestration/review-queue/ 2>/dev/null)

  local queue_size=${#queue_files[@]}
  [ "$queue_size" -eq 0 ] && return

  # solo 마커 태스크 → 배치에서 제외, 즉시 개별 실행
  for qf in "${queue_files[@]}"; do
    if grep -q ":solo$" "$qf"; then
      local tid=$(basename "$qf")
      start_review_batch "$tid"
      rm -f "$qf"
      return
    fi
  done

  # 배치 판단
  local oldest_age=$(file_age "${queue_files[0]}")

  if [ "$queue_size" -ge "$max_batch" ]; then
    # 최대 크기 도달 → 즉시 배치
    collect_and_review "${queue_files[@]:0:$max_batch}"
  elif [ "$queue_size" -eq 1 ] && [ "$oldest_age" -lt "$grace" ]; then
    # 1개 + grace period 미경과 → 대기
    return
  elif [ "$oldest_age" -ge "$timeout" ]; then
    # 타임아웃 경과 → 있는 만큼 배치
    collect_and_review "${queue_files[@]}"
  fi
}
```

## 7. 리뷰 프롬프트 (개별/배치 통일)

```markdown
아래 태스크의 코드 변경을 리뷰해라.
각 태스크별로 아래 형식으로 결과를 작성해라.

===REVIEW:{task_id}:START===
verdict: 승인 | 수정요청
(상세 피드백)
===REVIEW:{task_id}:END===

{{#each tasks}}
## {{task_id}}: {{title}}
### 완료 조건
{{criteria}}
### 변경 내용 (git diff)
{{diff}}
{{/each}}
```

- 개별 리뷰(1개)도 동일 포맷 사용 → 파싱 로직 단일화

## 8. 리뷰 결과 처리

### verdict/feedback 파싱

```bash
process_verdict() {
  local task_id="$1" review_output="$2"
  local section
  section=$(sed -n "/===REVIEW:${task_id}:START===/,/===REVIEW:${task_id}:END===/p" "$review_output")

  # verdict 추출 → 파일 저장
  local verdict=$(echo "$section" | grep "^verdict:" | head -1 | sed 's/^verdict: *//')
  echo "$verdict" > ".orchestration/feedback/${task_id}.verdict"

  # 피드백 본문 추출 → 파일 저장 (구분자 + verdict 줄 제거)
  echo "$section" | grep -v "===REVIEW:" | grep -v "^verdict:" \
    > ".orchestration/feedback/${task_id}.md"

  # signal 생성
  if [ "$verdict" = "승인" ]; then
    signal_create "$SIGNAL_DIR" "$task_id" "review-approved"
  else
    signal_create "$SIGNAL_DIR" "$task_id" "review-rejected"
  fi
}
```

### 부분 성공 처리

```bash
process_batch_result() {
  local parsed=0 failed=()
  for task_id in "${batch[@]}"; do
    if grep -q "===REVIEW:${task_id}:START===" "$review_output"; then
      process_verdict "$task_id" "$review_output"
      ((parsed++))
    else
      failed+=("$task_id")
    fi
  done
  # 파싱 실패한 것만 재큐잉
  for task_id in "${failed[@]}"; do
    enqueue_review "$task_id"
    log_warn "배치 파싱 실패: $task_id → 재큐잉"
  done
}
```

### 재큐잉 (최대 1회, 이후 solo 강제)

```bash
enqueue_review() {
  local task_id="$1"
  local qf=".orchestration/review-queue/${task_id}"
  local count=0
  [ -f "$qf" ] && count=$(cut -d: -f2 "$qf")
  if [ "$count" -ge 1 ]; then
    echo "retry:$((count+1)):solo" > "$qf"  # solo → 배치 제외
  else
    echo "retry:$((count+1))" > "$qf"
  fi
}
```

### retry 워커 피드백 주입

```markdown
## 이전 리뷰 피드백
{.orchestration/feedback/TASK-XXX.md 내용}

위 피드백을 반영하여 코드를 수정해라.
```

## 9. Merge Lock (macOS 호환)

`ln -s` symlink 기반 atomic lock. flock이 없는 macOS 대응.

```bash
acquire_merge_lock() {
  local lock=".orchestration/.merge-lock"
  while ! ln -s "$$" "$lock" 2>/dev/null; do
    local owner=$(readlink "$lock" 2>/dev/null)
    if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
      rm -f "$lock"  # stale lock 제거
    else
      sleep 1
    fi
  done
}

release_merge_lock() {
  rm -f ".orchestration/.merge-lock"
}
```

## 10. Night/Day 프로파일 전환

- night-worker.sh가 시작/종료 시 `profile-active` 파일을 atomic write로 갱신
- orchestrate.sh는 매 iteration마다 읽기만 함 (시간 하드코딩 없음)
- 안전장치: night 모드에서 7시~22시 사이면 자동 day 복귀

```bash
# night-worker.sh에서
echo "night" > .orchestration/profile-active.tmp
mv .orchestration/profile-active.tmp .orchestration/profile-active

# orchestrate.sh에서
read_active_profile() {
  local pf=".orchestration/profile-active"
  if [ -f "$pf" ]; then
    local current_hour=$(date +%H)
    local profile=$(cat "$pf")
    if [ "$profile" = "night" ] && [ "$current_hour" -ge 7 ] && [ "$current_hour" -lt 22 ]; then
      echo "day" > "$pf.tmp" && mv "$pf.tmp" "$pf"
      echo "day"
      return
    fi
    echo "$profile"
  else
    echo "day"
  fi
}
```

## 11. 중복 태스크 조기 탈출

워커가 작업 시작 직후 코드를 확인하여 이미 구현되어 있으면 즉시 종료하는 메커니즘.

### 배경

TASK-252(done)와 TASK-256(stopped)처럼 동일한 작업이 중복 생성될 수 있다. dispatch 단계에서 문자열 비교로 걸러내는 건 정확도가 낮고, LLM을 부르면 본말전도. 워커가 실제 코드를 보고 판단하는 게 가장 정확하고 심플하다.

### 흐름

```
워커 시작 → 코드 확인 → 이미 구현됨?
  → YES: task-duplicate signal → orchestrate.sh가 rejected 처리 (리뷰 스킵)
  → NO: 정상 작업 진행
```

### 워커 프롬프트 추가

기존 task 프롬프트 상단에 한 블록 추가:

```markdown
## 사전 확인 (필수)
작업 시작 전, 현재 코드베이스를 확인하여 이 태스크의 완료 조건이 **이미 충족되어 있는지** 판단해라.
이미 구현되어 있다면:
1. 어떤 코드에서 확인했는지 간단히 기록
2. `task-duplicate` signal을 생성하고 즉시 종료

이미 구현되어 있지 않은 경우에만 작업을 진행해라.
```

### signal 처리

```bash
# orchestrate.sh의 signal 처리에 추가
process_signals_for_task() {
  local task_id="$1"
  # ... 기존 signal 처리 ...

  if signal_exists "$SIGNAL_DIR" "$task_id" "task-duplicate"; then
    signal_consume "$SIGNAL_DIR" "$task_id" "task-duplicate"
    update_task_status "$task_id" "rejected"
    log_info "$task_id: 중복 태스크 — 이미 구현됨 (리뷰 스킵)"
    # review queue에 추가하지 않음
    return
  fi
}
```

### 비용/시간

- 워커가 코드 읽고 판단: **10~15초**, haiku 기준 $0.01~0.02
- 전체 작업 실행(1~3분 + 리뷰 30초~1분) 대비 무시 가능
- 중복이 아닌 정상 태스크에는 추가 지연 거의 없음 (확인 후 바로 작업 진행)

### 설계 결정 근거

| 대안 | 기각 사유 |
|------|----------|
| dispatch 전 title/scope 비교 | 문자열 비교로는 "2depth 토글 arrow 추가" vs "토글 기능 추가" 같은 유사도 판단 불가 |
| dispatch 전 LLM 호출로 중복 체크 | 중복 체크에 LLM 비용 발생 → 본말전도 |
| 워커 조기 탈출 (채택) | 실제 코드를 보고 판단하므로 정확, 프롬프트 한 줄 + signal 하나로 구현 |

## 12. 크로스플랫폼 헬퍼

```bash
# lib/common.sh에 추가
file_age() {
  local file="$1"
  if [ "$(uname)" = "Darwin" ]; then
    echo $(( $(date +%s) - $(stat -f %m "$file") ))
  else
    echo $(( $(date +%s) - $(stat -c %Y "$file") ))
  fi
}
```

## 12. 핵심 함수 목록

| 함수 | 파일 | 역할 |
|------|------|------|
| `enqueue_review()` | orchestrate.sh | review-queue에 태스크 등록 |
| `dispatch_reviews()` | orchestrate.sh | 배치 수집 + 리뷰 실행 판단 |
| `start_review_batch()` | orchestrate.sh | 배치 리뷰 프롬프트 생성 + claude 호출 |
| `process_verdict()` | orchestrate.sh | 구분자 파싱 → verdict/feedback 파일 생성 → signal |
| `process_batch_result()` | orchestrate.sh | 부분 성공 처리 + 실패 태스크 재큐잉 |
| `acquire_merge_lock()` | lib/merge-task.sh | `ln -s` 기반 lock 획득 |
| `release_merge_lock()` | lib/merge-task.sh | lock 해제 |
| `read_active_profile()` | orchestrate.sh | profile-active 읽기 + 자동 day 복귀 |
| `file_age()` | lib/common.sh | 크로스플랫폼 파일 age 계산 |
| `can_dispatch_task()` | orchestrate.sh | task 슬롯 가용 판단 (review 큐 비면 양보) |
| `can_dispatch_review()` | orchestrate.sh | review 슬롯 가용 판단 (최소 1슬롯 보장) |

## 13. 구현 순서

| 단계 | 내용 | 비고 |
|------|------|------|
| 0 | `reviewQueueEnabled` 롤백 플래그 추가 | config.json |
| 1 | `file_age()`, `acquire/release_merge_lock()` 헬퍼 | lib/common.sh, lib/merge-task.sh |
| 2 | `RUNNING_TASKS` / `RUNNING_REVIEWS` 분리 | orchestrate.sh 메인 루프 |
| 3 | `enqueue_review()` + `dispatch_reviews()` (maxBatchSize:1) | 큐 분리 완성 |
| 4 | 리뷰 프롬프트 구분자 포맷 + `process_verdict()` | 파싱 로직 |
| 5 | `process_batch_result()` 부분 성공 + 재큐잉 | 에러 처리 |
| 6 | `profile-active` 시스템 + night-worker 연동 | night/day 전환 |
| 7 | maxBatchSize:3으로 올려 배치 리뷰 활성화 | Phase 2 전환 |
| 8 | E2E 테스트 | 아래 시나리오 참조 |

## 14. E2E 테스트 시나리오

| # | 시나리오 | 검증 포인트 |
|---|---------|-----------|
| 1 | task 2개 동시 완료 → 배치 리뷰 | 2개가 하나의 리뷰로 묶이는지 |
| 2 | task 1개 완료 → timeout 후 단독 리뷰 | grace period + timeout 동작 |
| 3 | 배치 리뷰 중 1개 파싱 실패 | 부분 성공 + 재큐잉 동작 |
| 4 | 재큐잉된 태스크 → solo 개별 리뷰 | solo 마커 동작 |
| 5 | merge 2개 동시 요청 | symlink lockfile 직렬화 |
| 6 | night-worker 시작/종료 | profile-active 전환 |
| 7 | night 모드에서 7시 경과 | 자동 day 복귀 |
| 8 | `reviewQueueEnabled: false` | 기존 순차 로직으로 롤백 |

## 15. 비용/시간 예상 (태스크 6개 기준)

| 방식 | 시간 | 리뷰 비용 | 절약 |
|------|------|----------|------|
| 현재 (순차) | ~12분 30초 | $0.54 | — |
| Phase 1 (큐 분리, batch:1) | ~9분 | $0.54 | 시간 28% |
| Phase 2 (배치 리뷰, batch:3) | ~9분 | $0.24 | 시간 28% + 비용 55% |

## 16. 설계 결정 근거 (라운드별 추적)

| 결정 사항 | 합의 라운드 | 핵심 논거 |
|-----------|-----------|----------|
| 2단 큐 (3단 아닌 이유) | R2 | merge 10초 → 별도 큐 오버헤드 > 이익 |
| symlink lock (mkdir/flock 아닌 이유) | R4 | macOS atomic, stale 감지 가능, flock 미탑재 |
| 고정 구분자 (JSON/UUID 아닌 이유) | R4, R7 | JSON → 리뷰 품질 하락, UUID → 파싱 복잡, 고정 구분자 충돌 확률 무시 |
| count-timeout 단일 (wait-all 제거) | R2 | wait-all → stuck 태스크 시 전체 블로킹 위험 |
| profile signal 파일 (config 직접 수정 아닌 이유) | R6 | config.json 동시 접근 → partial write 위험 |
| Phase 통합 (batch:1부터) | R2 | 이중 구현 방지, 코드 경로 단일화 |
| 리뷰 포맷 항상 통일 (분기 아닌 이유) | R8 | 코드 경로 2개 → 동기화 부담, 구분자 2줄 오버헤드 무시 가능 |
| verdict/feedback 파일 분리 | R8 | echo 반환 패턴 → 가독성 저하, 파일 기반이 signal 시스템과 일관 |
| review 보장 슬롯 동적 양보 | R6 | 큐 빈 상태에서 task 슬롯 1개 낭비 방지 |
| 재큐잉 1회 → solo 강제 | R7 | 무한 재큐잉 → 배치 파싱 반복 실패 방지 |

---

**서명:**
- 설계1: 합의 (Round 9)
- 설계2: 합의 (Round 10)
