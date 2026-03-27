# 리뷰 큐 분리 + 배치 리뷰 최적화 설계안

## 현재 구조

```
[task slot 1]  TASK-A task → TASK-A review → TASK-A merge → TASK-C task → ...
[task slot 2]  TASK-B task → TASK-B review → TASK-B merge → TASK-D task → ...
```

- task 슬롯이 review + merge 끝날 때까지 **블로킹**
- review는 task와 1:1 순차 실행
- `maxParallel: 2`면 동시 claude 프로세스 최대 2개

### 문제점
- task 완료 후 review 대기 시간 동안 슬롯이 놀고 있음
- review는 haiku로 빠르지만, 그래도 30~60초 소요
- task 10개를 돌리면 review 대기만으로 5~10분 낭비

## 개선 구조

### Phase 1: 큐 분리 (task queue / review queue)

```
[task queue]     slot1: TASK-A → TASK-C → TASK-E → ...
                 slot2: TASK-B → TASK-D → TASK-F → ...

[review queue]   slot1: TASK-A review → TASK-D review → ...
                 slot2: TASK-B review → TASK-E review → ...

[merge]          순차 (git 충돌 방지)
```

- task 완료 → review queue에 추가 → task 슬롯은 즉시 다음 태스크 시작
- review queue는 별도 슬롯으로 병렬 실행
- merge는 순차 (같은 브랜치에 머지하므로 충돌 방지)

#### 설정

```json
{
  "maxParallel": {
    "task": 2,
    "review": 2
  }
}
```

- 최대 동시 claude 프로세스: task 2 + review 2 = **4개**
- 메모리/CPU 부담이 크면 review를 1로 줄이면 됨

#### 구현 포인트

**orchestrate.sh 변경:**
- `RUNNING` 배열을 `RUNNING_TASKS`와 `RUNNING_REVIEWS`로 분리
- `process_signals_for_task()`에서 task-done → review queue에 추가 (기존: 즉시 review 시작)
- 메인 루프에서 review queue도 dispatch
- `can_dispatch()`를 task/review 별로 분리

**signal 흐름:**
```
task-done → review queue에 등록 (파일: .orchestration/review-queue/TASK-XXX)
review 슬롯 비면 → review queue에서 꺼내서 실행
review-approved → merge (순차)
review-rejected → retry queue 또는 failed
```

**TaskRunnerManager 변경 (개별 실행):**
- 기존: task.on("close") → startReview() (순차)
- 변경 없음 — 개별 실행은 1개 태스크만 처리하므로 큐 분리 불필요

### Phase 2: 배치 리뷰

여러 태스크의 diff를 모아서 한 번의 claude 호출로 리뷰.

#### 묶는 기준: 개수 + 타임아웃

```
review queue에 태스크 도착
  → 3개 모이면 → 즉시 배치 리뷰
  → 30초 타임아웃 → 있는 것만 배치 리뷰 (1~2개라도 실행)
```

- 빠른 태스크가 느린 태스크 기다리느라 블로킹 안 됨
- 태스크가 1개만 있어도 30초 후 단독 리뷰

#### 설정

```json
{
  "batchReview": {
    "enabled": true,
    "maxBatchSize": 3,
    "timeoutSeconds": 30
  }
}
```

#### 배치 리뷰 프롬프트

```markdown
아래 N개 태스크의 코드 변경을 리뷰해라.
각 태스크별로 승인/수정요청을 개별 판단해라.

## TASK-A: {title}
### 완료 조건
{criteria}
### 변경 내용 (git diff)
{diff_A}

## TASK-B: {title}
### 완료 조건
{criteria}
### 변경 내용 (git diff)
{diff_B}

## 결과 형식
각 태스크별로 아래 형식으로 작성:
TASK-A: 승인 | 수정요청
(상세 피드백)
TASK-B: 승인 | 수정요청
(상세 피드백)
```

#### 결과 파싱

리뷰어 응답에서 태스크별 승인/수정요청을 파싱:
```bash
# 응답 예시:
# TASK-A: 승인
# 코드 품질 양호, 완료 조건 충족
# TASK-B: 수정요청
# slice(0,5)가 아니라 slice(0,10)이어야 함

for task_id in "${batch[@]}"; do
  verdict=$(grep "^${task_id}:" "$review_result" | head -1)
  if echo "$verdict" | grep -q "승인"; then
    signal_create "$SIGNAL_DIR" "$task_id" "review-approved"
  else
    signal_create "$SIGNAL_DIR" "$task_id" "review-rejected"
    # 해당 태스크의 피드백 추출하여 파일로 저장
  fi
done
```

#### 리스크 & 완화

| 리스크 | 완화 방안 |
|--------|----------|
| 리뷰어가 태스크 A/B 결과를 혼동 | 프롬프트에 명확한 구분자 + 결과 형식 강제 |
| 배치 내 한 태스크가 매우 큰 diff | maxBatchSize를 줄이거나, diff 크기 기준으로 배치 분리 |
| 파싱 실패 | fallback: 전체를 수정요청으로 처리하고 개별 리뷰로 재시도 |
| 배치 리뷰 비용이 개별보다 비쌈 | context caching으로 상쇄 — 시스템 프롬프트/역할 프롬프트가 캐시됨 |

## 비용/시간 비교

### 예시: 태스크 6개 실행 (maxParallel task=2, review=2)

**현재 (순차 리뷰):**
```
시간: task(3분) + review(1분) + merge(10초) = 4분 10초 per task
      × 3 라운드 (2개씩) = ~12분 30초
리뷰 비용: 6 × $0.09 = $0.54
```

**Phase 1 (큐 분리):**
```
시간: task 6개 → 3라운드 × 3분 = 9분
      review 6개 → 3라운드 × 1분 = 3분 (task와 병렬)
      총: ~9분 (review가 task 뒤에서 병렬 처리)
리뷰 비용: 6 × $0.09 = $0.54 (동일)
절약: ~3분 30초 (28%)
```

**Phase 2 (배치 리뷰, 3개씩):**
```
시간: task 동일 9분
      review 2회 × 1.5분 = 3분 (task와 병렬)
      총: ~9분
리뷰 비용: 2 × $0.12 = $0.24 (55% 절약)
절약: 시간 동일 + 비용 $0.30 절약
```

## 구현 우선순위

| 순서 | 내용 | 효과 | 난이도 |
|------|------|------|--------|
| 1 | review queue 분리 (Phase 1) | 시간 28% 절약 | 중간 |
| 2 | 배치 리뷰 (Phase 2) | 비용 55% 절약 | 높음 |
| 3 | review 스킵 옵션 | 단순 태스크 시간 50% 절약 | 낮음 |

**Phase 1부터 구현 권장.** orchestrate.sh의 메인 루프만 수정하면 됨. Phase 2는 프롬프트 설계 + 파싱 로직이 필요하므로 이후 진행.
