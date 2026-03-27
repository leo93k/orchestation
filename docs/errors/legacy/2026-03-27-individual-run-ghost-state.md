# 개별 실행 완료 후 UI "실행 중" 고스트 상태 (2026-03-27)

## 요약
태스크 상세 페이지에서 "실행" 버튼으로 TASK-251을 개별 실행. Claude가 작업을 성공적으로 완료하고 `task-done` signal까지 생성했으나, UI는 "태스크 실행 중..." 상태에 머물고 태스크 status도 "Pending" 그대로 유지됨. 실제 프로세스는 이미 종료된 상태.

## 증상
- 로그탭: Claude 작업 완료 + `task-done signal` 생성까지 정상 기록 (32줄)
- UI 배너: "태스크 실행 중..." (파란색 스피너) 계속 표시
- 태스크 status: "Pending" (변경 안 됨)
- 프로세스: `ps aux`에 안 잡힘 (이미 종료)

## 근본 원인

### 1. 태스크 status 미갱신 (Pending → in_progress → done 전이 누락)

개별 실행 흐름(`POST /api/tasks/[id]/run`)은 `taskRunnerManager.run(id)`만 호출하고, **태스크 파일의 status를 in_progress로 변경하지 않는다.**

반면 orchestrate.sh의 `start_task()`는 `sed_inplace`로 status를 `in_progress`로 바꾸고 git commit까지 한다. 개별 실행에는 이 로직이 없음.

| 동작 | orchestrate.sh | 개별 실행 (UI) |
|------|---------------|---------------|
| status → in_progress | O (sed + git commit) | **X** |
| job-task.sh 실행 | O | O |
| signal 처리 (task-done → done) | O (process_signals_for_task) | **X** |
| status → done/failed | O | **X** |

### 2. task-done signal을 처리하는 주체가 없음

`job-task.sh`는 완료 시 `.orchestration/signals/TASK-251-task-done` 파일을 생성한다. 이 signal을 읽고 처리하는 것은 `orchestrate.sh`의 `process_signals_for_task()` 함수인데, **개별 실행 시에는 orchestrate.sh가 돌고 있지 않으므로 signal이 방치된다.**

`TaskRunnerManager`는 프로세스 exit code만 보고 상태를 판단한다(code 0 → completed, 그 외 → failed). 하지만 이 상태는 **메모리에만 존재**하며, 태스크 파일이나 git에 반영되지 않는다.

### 3. UI 완료 감지가 WebSocket `done` 이벤트에만 의존

프론트엔드의 `handleRunStatusChange`는 WebSocket의 `{ type: "status", status: "completed" }` 메시지를 받아야 runStatus를 갱신한다. 이 이벤트는 `TaskRunnerManager`의 `done:{taskId}` emit → WebSocket 서버 → 프론트엔드 순서로 전달되는데, 이 체인 중 하나라도 끊기면 UI가 "실행 중"에 갇힌다.

가능한 단절 지점:
- `job-task.sh`가 stream-json CONV_FILE 버그(Bug 2)로 exit code ≠ 0으로 종료
- `TaskRunnerManager`가 "failed"로 emit하지만, WebSocket 연결이 이미 끊긴 상태
- 페이지 새로고침 시 TaskRunnerManager 메모리가 유지되지만, WebSocket은 새로 연결 → 이미 emit된 done 이벤트를 놓침

### 4. 페이지 새로고침 시 상태 복구 불가

페이지 로드 시 `GET /api/tasks/[id]/run`으로 상태를 확인하지만, TaskRunnerManager의 in-memory 상태가 "completed"/"failed"여도 **프론트엔드 초기 상태는 이를 반영하지 않는다.** 프론트엔드의 runStatus 초기값이 페이지 로드 시 API 응답과 동기화되지 않으면 "idle"로 시작해 배너가 사라지거나, 이전 "running" 상태가 남아 고스트가 된다.

## 문제의 영향
- 사용자가 작업 완료를 인지하지 못함
- 태스크 status가 Pending 그대로 → 다음 파이프라인 실행 시 중복 실행 가능
- task-done signal 파일이 방치 → orchestrate.sh 재실행 시 예상치 못한 동작

## 개선안

### 1. (즉시) TaskRunnerManager에 태스크 파일 status 갱신 추가

`proc.on("close")` 핸들러에서 exit code에 따라 태스크 파일의 status를 직접 갱신한다:

```typescript
proc.on("close", (code: number | null) => {
  state.exitCode = code ?? 1;
  state.status = code === 0 ? "completed" : "failed";
  state.finishedAt = new Date().toISOString();

  // 태스크 파일 status 갱신
  updateTaskFileStatus(taskId, code === 0 ? "done" : "failed");

  // task-done/task-failed signal 파일 정리
  cleanupSignalFiles(taskId);

  this.events.emit(`done:${taskId}`, state.status);
});
```

### 2. (즉시) 개별 실행 시 status → in_progress 전이 추가

`POST /api/tasks/[id]/run`에서 `taskRunnerManager.run()` 호출 전에 태스크 파일의 status를 in_progress로 변경:

```typescript
// branch/worktree 자동 추가 후
const raw = fs.readFileSync(taskFile, "utf-8");
const updated = raw.replace(/^status:\s*.+$/m, "status: in_progress");
fs.writeFileSync(taskFile, updated, "utf-8");
```

### 3. (다음) 프론트엔드 상태 복구 로직 추가

페이지 로드 시 `GET /api/tasks/[id]/run` 응답의 status를 runStatus 초기값으로 반영:

```typescript
useEffect(() => {
  fetch(`/api/tasks/${id}/run`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "running") setRunStatus("running");
      else if (data.status === "completed") setRunStatus("completed");
      else if (data.status === "failed") setRunStatus("failed");
    });
}, [id]);
```

### 4. (다음) WebSocket 단절 시 폴링 fallback

WebSocket 연결이 끊기면 `GET /api/tasks/[id]/run`을 주기적으로 폴링하여 완료 상태를 감지:

```typescript
// WebSocket onclose 시
const pollInterval = setInterval(async () => {
  const res = await fetch(`/api/tasks/${id}/run`);
  const data = await res.json();
  if (data.status === "completed" || data.status === "failed") {
    handleRunStatusChange(data.status);
    clearInterval(pollInterval);
  }
}, 3000);
```

### 5. (나중) signal 파일과 TaskRunnerManager 통합

개별 실행 시에도 signal 파일을 TaskRunnerManager가 처리하도록 통합. 현재 signal 기반(orchestrate.sh)과 프로세스 exit 기반(TaskRunnerManager)이 이원화되어 있어 동작이 불일치함.

## 우선순위

| 순서 | 개선안 | 효과 | 난이도 |
|------|--------|------|--------|
| 1 | status → in_progress 전이 | 상태 추적 정상화 | 낮음 |
| 2 | close 시 status 갱신 | 완료/실패 반영 | 낮음 |
| 3 | 페이지 로드 시 상태 복구 | 새로고침 후 정확한 상태 | 낮음 |
| 4 | WebSocket fallback 폴링 | 연결 단절 대응 | 중간 |
| 5 | signal 처리 통합 | 이원화 해소 | 높음 |
