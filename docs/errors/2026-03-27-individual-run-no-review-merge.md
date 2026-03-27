# 개별 실행 시 리뷰/머지 미실행 및 Signal 경합 위험 (2026-03-27)

## 요약
UI에서 "실행" 버튼으로 태스크를 개별 실행하면 `job-task.sh`만 실행되고, 리뷰(`job-review.sh`) → 머지 → status 갱신이 전혀 수행되지 않는다. 작업 결과가 `task/task-XXX` 브랜치에 남아있지만 main에 머지되지 않고, 태스크 status도 Pending 그대로 방치된다.

또한, 개별 실행이 생성한 signal 파일과 orchestrate.sh의 signal 처리 간 경합 위험이 존재한다.

## 문제 상황 (TASK-251 사례)
1. UI에서 TASK-251 "실행" 클릭
2. `job-task.sh` 실행 → Claude가 sidebar.tsx 수정 → 커밋 `d6fd8ab` 생성
3. `task-done` signal 파일 생성
4. **여기서 끝.** 리뷰/머지/status 갱신 없음
5. `task/task-251` 브랜치에 커밋이 있지만 main에 미반영
6. status: Pending 그대로

## 근본 원인

### 개별 실행과 파이프라인의 lifecycle 불일치

orchestrate.sh는 태스크의 전체 lifecycle을 관리한다:

```
pending → in_progress → [job-task.sh] → task-done signal
  → [job-review.sh] → review-approved signal → merge → done
```

개별 실행(TaskRunnerManager)은 첫 단계만 실행한다:

```
pending → [job-task.sh] → (끝)
```

리뷰, 머지, status 전이는 모두 orchestrate.sh의 `process_signals_for_task()` 함수가 담당하는데, 개별 실행 시에는 이 함수가 호출되지 않는다.

### Signal 경합 위험

개별 실행과 파이프라인이 signal 파일(`.orchestration/signals/`)을 공유한다:

| 시나리오 | 위험 |
|----------|------|
| 개별 실행 완료 → signal 방치 → orchestrate.sh 시작 | orchestrate가 이전 signal을 처리하여 예상치 못한 review/merge 발생 |
| 개별 실행 중 → orchestrate.sh 시작 | 동일 태스크의 signal을 누가 먼저 읽느냐에 따라 결과 달라짐 |
| orchestrate.sh 실행 중 → UI에서 개별 실행 시도 | 현재는 409로 차단하지만, signal 잔여물은 정리 안 됨 |

현재 `POST /api/tasks/[id]/run`에서 `orchestrationManager.isRunning()` 체크로 동시 실행은 막고 있으나, **signal 파일 잔여물에 의한 간접 경합**은 방어하지 못한다.

## 문제의 영향
- 개별 실행한 태스크의 코드가 main에 반영되지 않음 (수동 머지 필요)
- status가 갱신되지 않아 파이프라인 재실행 시 중복 실행 가능
- 방치된 signal 파일이 이후 orchestrate.sh 동작에 간섭

## 개선안

### 1. 개별 실행 경로에서 signal 파일을 사용하지 않는 직접 체이닝 (권장)

TaskRunnerManager가 프로세스 exit code 기반으로 다음 단계를 직접 실행한다. signal 파일을 전혀 건드리지 않으므로 orchestrate.sh와 충돌 가능성이 제로.

```
TaskRunnerManager.run(taskId)
  │
  ├─ status → in_progress (태스크 파일 직접 갱신)
  ├─ spawn job-task.sh (signal 생성 억제)
  │
  └─ proc.on("close", code === 0)
      ├─ spawn job-review.sh (signal 생성 억제)
      │
      └─ review.on("close", code === 0)
          ├─ spawn scripts/lib/merge-task.sh TASK-XXX
          └─ status → done (태스크 파일 직접 갱신)
```

#### 구현 포인트

**a) job-task.sh / job-review.sh에 signal 억제 모드 추가**

환경변수 `SKIP_SIGNAL=1`을 설정하면 signal 파일을 생성하지 않고 exit code만으로 결과를 전달:

```bash
# job-task.sh EXIT trap 수정
if [ "${SKIP_SIGNAL:-}" != "1" ]; then
  signal_create "$SIGNAL_DIR" "$TASK_ID" "task-done"
fi
```

**b) TaskRunnerManager에 lifecycle 체이닝 추가**

```typescript
// task-runner-manager.ts
run(taskId: string): { success: boolean; error?: string } {
  // ... 기존 spawn 로직 ...
  // SKIP_SIGNAL=1 환경변수 추가
  proc = spawn("bash", [scriptPath, taskId, signalDir], {
    env: { ...process.env, SKIP_SIGNAL: "1" },
    // ...
  });

  proc.on("close", (code) => {
    if (code === 0) {
      this.startReview(taskId);  // 다음 단계
    } else {
      this.updateTaskFile(taskId, "failed");
    }
  });
}

private startReview(taskId: string) {
  const reviewProc = spawn("bash", [reviewScript, taskId, signalDir], {
    env: { ...process.env, SKIP_SIGNAL: "1" },
  });

  reviewProc.on("close", (code) => {
    if (code === 0) {
      this.mergeAndComplete(taskId);
    } else {
      this.updateTaskFile(taskId, "failed");
    }
  });
}

private mergeAndComplete(taskId: string) {
  const mergeProc = spawn("bash", [mergeScript, taskId]);
  mergeProc.on("close", (code) => {
    this.updateTaskFile(taskId, code === 0 ? "done" : "failed");
    this.events.emit(`done:${taskId}`, code === 0 ? "completed" : "failed");
  });
}
```

**c) merge 로직을 독립 스크립트로 분리**

현재 orchestrate.sh 내부의 `_merge_and_done()` 함수를 `scripts/lib/merge-task.sh`로 추출하여 양쪽에서 재사용:

```bash
#!/bin/bash
# scripts/lib/merge-task.sh
# Usage: merge-task.sh TASK-XXX
# worktree 브랜치를 main에 머지하고 worktree를 정리한다.

TASK_ID="$1"
# ... branch 파싱, git merge, worktree 정리 ...
```

### 2. UI에 실행 모드 선택 제공 (선택)

사용자가 "실행만" vs "실행+리뷰+머지"를 선택할 수 있도록 UI 옵션 추가:

```
[▶ 실행] [▶ 실행 → 머지]
```

- **실행**: job-task.sh만 실행 (현재 동작, 코드 확인 후 수동 머지 시)
- **실행 → 머지**: full lifecycle (자동 리뷰 + 머지)

### 3. signal 파일 잔여물 정리 (안전장치)

개별 실행 완료/실패 시 해당 태스크의 signal 파일을 모두 정리:

```typescript
private cleanupSignals(taskId: string) {
  const patterns = ["task-done", "task-failed", "task-rejected",
                    "review-approved", "review-rejected", "stop-request"];
  for (const p of patterns) {
    const f = path.join(signalDir, `${taskId}-${p}`);
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
}
```

orchestrate.sh 시작 시에도 stale signal 감지 로직을 추가하여 방어:

```bash
# orchestrate.sh 시작 시
for sf in "$SIGNAL_DIR"/*; do
  task_id=$(basename "$sf" | sed 's/-task-.*//;s/-review-.*//')
  status=$(grep '^status:' "$(find_file "$task_id")" | awk '{print $2}')
  if [ "$status" = "pending" ] || [ "$status" = "stopped" ]; then
    echo "⚠️  stale signal 정리: $(basename "$sf")"
    rm -f "$sf"
  fi
done
```

## 설계 원칙

```
개별 실행 = exit code 기반 (signal 파일 사용 안 함)
파이프라인 = signal 파일 기반 (기존 유지)
두 경로는 signal 파일을 공유하지 않으므로 경합 없음
```

## 우선순위

| 순서 | 개선안 | 효과 | 난이도 |
|------|--------|------|--------|
| 1 | SKIP_SIGNAL + 직접 체이닝 | 개별 실행 full lifecycle 완성 | 중간 |
| 2 | merge 스크립트 분리 | orchestrate.sh와 로직 재사용 | 낮음 |
| 3 | signal 잔여물 정리 | 경합 위험 제거 | 낮음 |
| 4 | UI 실행 모드 선택 | 사용자 유연성 | 낮음 |
